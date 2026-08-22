import {
  defaultExpectedTimeSeconds,
  publicationBlockers,
  writeQuestionInputSchema,
  type ImportQuestionsInput,
  type ImportResult,
  type ImportRowError,
  type WriteQuestionInput,
} from "@samjho/contracts";
import type { z } from "zod";

import { NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { hashQuestionContent } from "./question.admin.service.js";
import { questionAdminRepository } from "./question.admin.repository.js";

/**
 * Bulk import.
 *
 * The critical path for this product is not code, it is content: ~2,000
 * questions per subject, written from zero (docs/07 R1). Typing them one at a
 * time through a form is the fallback, not the plan — so this endpoint exists to
 * take a file a contractor produced, tell them precisely what is wrong with it,
 * and then write all of it or none of it.
 *
 * Three rules, each chosen for the way the alternative fails:
 *
 * **Validate every row before writing any.** Stopping at the first bad row
 * means a 200-row file takes 200 round trips to clean up. Reporting all of them
 * at once means one.
 *
 * **All or nothing.** A partial import leaves an editor holding a file and no
 * way to know which rows landed short of comparing by hand. Re-running a fixed
 * file is strictly cheaper than that.
 *
 * **Duplicates are rejected, not merged.** Re-running an import is the single
 * most likely way this endpoint gets used twice, and a question bank with the
 * same question in it three times is worse than one that is smaller — a student
 * meets it three times in one practice session and concludes the bank is thin.
 */

/** Everything except the fields the row itself carries for slug resolution. */
const rowEnvelopeKeys = new Set(["ref", "chapter", "topics"]);

interface Prepared {
  index: number;
  ref: string | null;
  chapterId: string;
  input: WriteQuestionInput;
  contentHash: string;
}

export const questionImportService = {
  async importQuestions(input: ImportQuestionsInput, authorId: string): Promise<ImportResult> {
    const subject = await prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    // One query for the whole file rather than one per row. At 200 rows the
    // difference is 400 round trips, which is the gap between "an import takes a
    // second" and "an import is something you start and walk away from".
    const chapters = await prisma.chapter.findMany({
      where: { subjectId: input.subjectId },
      select: { id: true, slug: true, topics: { select: { id: true, slug: true } } },
    });

    const chapterBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));

    const errors: ImportRowError[] = [];
    const prepared: Prepared[] = [];
    const seenHashes = new Map<string, number>();

    for (const [index, row] of input.rows.entries()) {
      const ref = typeof row.ref === "string" ? row.ref : null;
      const issues: ImportRowError["issues"] = [];

      const chapter = chapterBySlug.get(row.chapter);
      if (!chapter) {
        issues.push({
          path: "chapter",
          message: `unknown chapter slug "${row.chapter}" in this subject`,
        });
      }

      const topicIds: string[] = [];
      if (chapter) {
        const topicBySlug = new Map(chapter.topics.map((topic) => [topic.slug, topic.id]));

        for (const slug of row.topics) {
          const topicId = topicBySlug.get(slug);
          if (topicId) {
            topicIds.push(topicId);
          } else {
            issues.push({
              path: "topics",
              message: `unknown topic slug "${slug}" in chapter "${row.chapter}"`,
            });
          }
        }
      }

      if (issues.length > 0) {
        errors.push({ row: index, ref, issues });
        continue;
      }

      // The second parse, against the same schema a typed-in question faces.
      // Everything the row carried beyond the envelope is the question itself —
      // which is why the row schema is a loose object: a strict one would have
      // stripped all of it before we got here.
      const candidate: Record<string, unknown> = {
        chapterId: chapter?.id,
        topicIds,
      };
      for (const [key, value] of Object.entries(row)) {
        if (!rowEnvelopeKeys.has(key)) candidate[key] = value;
      }

      const parsed = writeQuestionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({ row: index, ref, issues: toIssues(parsed.error) });
        continue;
      }

      if (input.status === "PUBLISHED") {
        // Publishing straight from a file still has to clear the licensing gate.
        // Bulk entry is exactly where an unreviewed licence would otherwise slip
        // through two hundred at a time (docs/07 R2).
        const blockers = publicationBlockers({
          licenceStatus: parsed.data.source.licenceStatus,
          hasSolution: Boolean(parsed.data.answer?.solution),
          isContainer: parsed.data.subParts.length > 0,
        });

        if (blockers.length > 0) {
          errors.push({
            row: index,
            ref,
            issues: blockers.map((message) => ({ path: "status", message })),
          });
          continue;
        }
      }

      const contentHash = hashQuestionContent(parsed.data);
      const duplicateOf = seenHashes.get(contentHash);

      if (duplicateOf !== undefined) {
        errors.push({
          row: index,
          ref,
          issues: [{ path: "body", message: `identical to row ${duplicateOf} in this file` }],
        });
        continue;
      }

      seenHashes.set(contentHash, index);
      prepared.push({ index, ref, chapterId: chapter?.id ?? "", input: parsed.data, contentHash });
    }

    // Checked after the loop so it is one query rather than one per row.
    if (prepared.length > 0) {
      const existing = await prisma.question.findMany({
        where: {
          subjectId: input.subjectId,
          parentId: null,
          contentHash: { in: prepared.map((row) => row.contentHash) },
        },
        select: { id: true, contentHash: true },
      });

      const existingByHash = new Map(
        existing.map((question) => [question.contentHash ?? "", question.id]),
      );

      for (const row of prepared) {
        const clash = existingByHash.get(row.contentHash);
        if (clash) {
          errors.push({
            row: row.index,
            ref: row.ref,
            issues: [{ path: "body", message: `this question is already in the bank as ${clash}` }],
          });
        }
      }
    }

    const valid = input.rows.length - errors.length;

    if (errors.length > 0 || input.dryRun) {
      return {
        dryRun: input.dryRun,
        total: input.rows.length,
        valid,
        written: 0,
        errors: errors.sort((a, b) => a.row - b.row),
      };
    }

    await prisma.$transaction(
      async (tx) => {
        for (const row of prepared) {
          const id = await questionAdminRepository.createTree(
            tx,
            {
              input: row.input,
              subjectId: input.subjectId,
              authorId,
              expectedTimeSeconds:
                row.input.expectedTimeSeconds ?? defaultExpectedTimeSeconds(row.input.marks),
              subPartTimes: row.input.subParts.map(
                (part) => part.expectedTimeSeconds ?? defaultExpectedTimeSeconds(part.marks),
              ),
              contentHash: row.contentHash,
            },
            row.chapterId,
          );

          if (input.status !== "DRAFT") {
            await questionAdminRepository.setStatus(tx, id, input.status);
          }
        }
      },
      {
        // Prisma's default interactive-transaction timeout is five seconds,
        // which two hundred question trees will exceed. Raised deliberately
        // rather than by shrinking the batch, because the all-or-nothing promise
        // is worth more than the lock time on a table only editors write to.
        timeout: 120_000,
        maxWait: 10_000,
      },
    );

    logger.info(
      { subjectId: input.subjectId, count: prepared.length, status: input.status },
      "Bulk question import written",
    );

    return {
      dryRun: false,
      total: input.rows.length,
      valid,
      written: prepared.length,
      errors: [],
    };
  },
};

function toIssues(error: z.ZodError): ImportRowError["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
