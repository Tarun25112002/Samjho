import {
  defaultExpectedTimeSeconds,
  pastPaperLabel,
  publicationBlockers,
  writeQuestionInputSchema,
  type ImportRowError,
  type IngestPastPaperInput,
  type IngestPastPaperResult,
  type WriteQuestionInput,
} from "@samjho/contracts";
import type { z } from "zod";

import { NotFoundError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { questionAdminRepository } from "../questions/question.admin.repository.js";
import { hashQuestionContent } from "../questions/question.admin.service.js";
import {
  pastPaperRepository,
  type PaperIdentity,
  type PastPaperRow,
} from "./past-paper.repository.js";

/**
 * Ingesting one previous-year paper.
 *
 * This is `question.import.service.ts` with the provenance moved from the row to
 * the file header, and it keeps that service's three rules for the same reasons:
 * every row is validated before any is written, the write is all-or-nothing, and
 * duplicates are rejected rather than merged.
 *
 * ## Why provenance is stamped, not carried
 *
 * A paper file says once which paper it is. The service then writes that year,
 * sitting, code, set and licence onto every question in the file, and refuses a
 * row that tries to supply its own `source`.
 *
 * The alternative — provenance repeated per row, as the general importer does —
 * is thirty-eight independent chances for one question to claim it came from a
 * different paper than the file it is in. Those five fields are the R2 legal
 * record (docs/07): they exist so that "where did this come from" has one
 * answer, and a format that lets a row disagree with its own file is a format
 * that will eventually produce a wrong one. Stamping also means a corrected
 * header fixes the whole paper, rather than thirty-eight rows individually.
 *
 * ## Why an unregistered paper is created rather than rejected
 *
 * The registry is a backlog, not a gate. Someone who has the 2013 Compartment
 * paper in front of them should be able to load it without first filling in a
 * form describing it — the file already describes it. So identity is matched
 * against the registry and the row is created when it is missing, which makes
 * "register everything first" a convenience for planning rather than a step in
 * the way of the actual work.
 *
 * ## What the file may not decide
 *
 * The *status* of what it writes, beyond asking for it: `PUBLISHED` still has to
 * clear `publicationBlockers`, which means a file that says nothing about
 * licensing produces drafts a human clears, not live board questions nobody
 * reviewed. That gate is the whole reason `licenceStatus` defaults to
 * `NEEDS_REVIEW` in the contract.
 */

/** Fields the row owns as envelope; everything else is the question itself. */
const rowEnvelopeKeys = new Set(["questionNumber", "chapter", "topics"]);

interface Prepared {
  index: number;
  ref: string;
  chapterId: string;
  input: WriteQuestionInput;
  contentHash: string;
}

export const pastPaperIngestService = {
  async ingest(input: IngestPastPaperInput, authorId: string): Promise<IngestPastPaperResult> {
    const subject = await prisma.subject.findUnique({
      where: { id: input.subjectId },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    const identity = {
      subjectId: input.subjectId,
      year: input.paper.year,
      examSession: input.paper.examSession,
      paperCode: input.paper.paperCode,
      setCode: input.paper.setCode,
    };

    const existingPaper = await resolvePaper(identity, input);
    const paperLabel = pastPaperLabel({
      ...input.paper,
      // The registry keeps the region when the file omits it, so a second load
      // against an already-claimed paper is not reported under a shorter name
      // than the first one was.
      region: input.paper.region ?? existingPaper?.region ?? null,
    });

    // Counted before anything is written, so a dry run reports the same "12
    // already on this paper" that the real run will start from. This is how a
    // second pass over a corrected file is read: 12 already there, 26 to write.
    const alreadyOnPaper = existingPaper
      ? ((await pastPaperRepository.countsByPaper([existingPaper.id])).get(existingPaper.id)
          ?.imported ?? 0)
      : 0;

    const chapters = await prisma.chapter.findMany({
      where: { subjectId: input.subjectId },
      select: { id: true, slug: true, topics: { select: { id: true, slug: true } } },
    });
    const chapterBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]));

    const errors: ImportRowError[] = [];
    const prepared: Prepared[] = [];
    const seenHashes = new Map<string, number>();
    const seenNumbers = new Map<string, number>();

    for (const [index, row] of input.rows.entries()) {
      const ref = row.questionNumber;
      const issues: ImportRowError["issues"] = [];

      // The rejection the stamping rule above depends on. Silently discarding it
      // would be worse than failing: the file's author believes they set the
      // provenance, and the question would carry the header's instead.
      if ("source" in row) {
        issues.push({
          path: "source",
          message:
            "a paper row may not carry its own source — provenance comes from the paper header",
        });
      }

      // Two rows claiming to be Q12 is a copy-paste in the file, and the number
      // is what a student is shown and what a re-ingest lines up against, so it
      // has to be unique within the paper before it is written to it.
      const duplicateNumber = seenNumbers.get(ref);
      if (duplicateNumber !== undefined) {
        issues.push({
          path: "questionNumber",
          message: `question ${ref} also appears at row ${String(duplicateNumber)}`,
        });
      }

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

      seenNumbers.set(ref, index);

      if (issues.length > 0) {
        errors.push({ row: index, ref, issues });
        continue;
      }

      const candidate: Record<string, unknown> = {
        chapterId: chapter?.id,
        topicIds,
        source: sourceStamp(input, ref, paperLabel),
      };
      for (const [key, value] of Object.entries(row)) {
        if (!rowEnvelopeKeys.has(key)) candidate[key] = value;
      }

      // The second parse, against the same schema a typed-in question faces —
      // which is why the row schema is loose. One validator for a question,
      // however it entered the system.
      const parsed = writeQuestionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({ row: index, ref, issues: toIssues(parsed.error) });
        continue;
      }

      if (input.status === "PUBLISHED") {
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
          issues: [
            { path: "body", message: `identical to row ${String(duplicateOf)} in this file` },
          ],
        });
        continue;
      }

      seenHashes.set(contentHash, index);
      prepared.push({ index, ref, chapterId: chapter?.id ?? "", input: parsed.data, contentHash });
    }

    // One query for the file rather than one per row. Re-running an ingest is
    // the single most likely way this endpoint is used twice, so this branch is
    // the normal case on a second pass, not an edge one.
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
        pastPaperId: existingPaper?.id ?? null,
        paperLabel,
        paperCreated: !existingPaper,
        total: input.rows.length,
        valid,
        written: 0,
        alreadyOnPaper,
        printedQuestionCount: printedCount(existingPaper, input),
        errors: errors.sort((a, b) => a.row - b.row),
      };
    }

    const pastPaperId = await prisma.$transaction(
      async (tx) => {
        const paperId = existingPaper
          ? (await fillPaperGaps(tx, existingPaper, input)).id
          : (
              await tx.pastPaper.create({
                data: {
                  subjectId: input.subjectId,
                  year: input.paper.year,
                  examSession: input.paper.examSession,
                  paperCode: input.paper.paperCode,
                  setCode: input.paper.setCode,
                  region: input.paper.region,
                  printedQuestionCount: input.paper.printedQuestionCount,
                  totalMarks: input.paper.totalMarks,
                  sourceUrl: input.paper.sourceUrl,
                  licenceStatus: input.licenceStatus,
                },
                select: { id: true },
              })
            ).id;

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

          // The link the loose provenance fields cannot provide. `createTree`
          // writes a source row for the question and one for each sub-part, and
          // both need the id — a sub-part left unlinked would drop out of the
          // coverage count the moment anyone counted source rows instead of
          // questions.
          await tx.questionSource.updateMany({
            where: { OR: [{ questionId: id }, { question: { parentId: id } }] },
            data: { pastPaperId: paperId },
          });

          if (input.status !== "DRAFT") {
            await questionAdminRepository.setStatus(tx, id, input.status);
          }
        }

        return paperId;
      },
      {
        // Same reasoning as bulk import: Prisma's five-second default will not
        // survive a paper's worth of question trees, and the all-or-nothing
        // promise is worth more than the lock time on a table only editors
        // write to.
        timeout: 120_000,
        maxWait: 10_000,
      },
    );

    logger.info(
      {
        subjectId: input.subjectId,
        pastPaperId,
        paper: paperLabel,
        count: prepared.length,
        status: input.status,
      },
      "Past paper ingested",
    );

    return {
      dryRun: false,
      pastPaperId,
      paperLabel,
      paperCreated: !existingPaper,
      total: input.rows.length,
      valid,
      written: prepared.length,
      alreadyOnPaper,
      printedQuestionCount: printedCount(existingPaper, input),
      errors: [],
    };
  },
};

/**
 * Which registry row this file belongs to, or null when there is not one yet.
 *
 * Two chances to match, in order:
 *
 *  1. **Exact identity** — the five columns of the unique index. The normal
 *     case, including every re-run of a file already loaded.
 *  2. **An unclaimed placeholder** for the sitting. The backlog seed registers
 *     one row per sitting with no paper code, meaning "this exam happened and we
 *     hold none of it"; the first real paper for that sitting fills it in rather
 *     than registering beside it. Without this step a seeded 26-year grid would
 *     keep a permanently empty shadow row for every year anyone worked on.
 *
 * A placeholder is claimed only when **no questions are filed against it**. A
 * row that has already collected questions without a paper code was collecting
 * them from *some* paper, and stamping a code onto it retroactively would label
 * those questions with a code they may not have come from — the same fabrication
 * this pipeline exists to avoid, arrived at by a helpful shortcut.
 */
async function resolvePaper(
  identity: PaperIdentity,
  input: IngestPastPaperInput,
): Promise<PastPaperRow | null> {
  const exact = await pastPaperRepository.findByIdentity(identity);
  if (exact) return exact;

  // A file with neither code nor set has the same identity as a placeholder, so
  // it would have matched exactly above. Reaching here with both absent means
  // the sitting has no registry row at all.
  if (input.paper.paperCode === null && input.paper.setCode === null) return null;

  const placeholder = await pastPaperRepository.findPlaceholder({
    subjectId: identity.subjectId,
    year: identity.year,
    examSession: identity.examSession,
  });
  if (!placeholder) return null;

  const counts = await pastPaperRepository.countsByPaper([placeholder.id]);
  return (counts.get(placeholder.id)?.imported ?? 0) === 0 ? placeholder : null;
}

/**
 * The provenance every question in the file gets.
 *
 * `originalQuestionNumber` is the one field that varies per row, and it is the
 * reason `questionNumber` is required in the ingest format where the general
 * importer's `ref` is optional: it is what a student is shown next to the
 * question and what an editor uses to find it in the PDF again.
 *
 * `attributionText` defaults to the paper's label plus that number, so the
 * adapted-and-attributed position (docs/07 Q6) is satisfied by construction
 * rather than by thirty-eight authors remembering to write a sentence.
 */
function sourceStamp(
  input: IngestPastPaperInput,
  questionNumber: string,
  paperLabel: string,
): Record<string, unknown> {
  return {
    sourceType: input.reproduction,
    year: input.paper.year,
    examSession: input.paper.examSession,
    paperCode: input.paper.paperCode,
    setNumber: input.paper.setCode,
    originalQuestionNumber: questionNumber,
    sourceUrl: input.paper.sourceUrl,
    licenceStatus: input.licenceStatus,
    attributionText: input.attributionText ?? `${paperLabel}, Q${questionNumber}`,
  };
}

/**
 * Fill in what the registry row does not know yet, and nothing else.
 *
 * Only nulls are written. A printed count already in the registry was put there
 * by a human holding the paper; a file's header is typed by whoever prepared the
 * file, and letting it overwrite the counted number would let a typo in one file
 * silently redefine the denominator every coverage figure for that paper is
 * measured against.
 *
 * This is also how a placeholder is claimed. `resolvePaper` decides *whether* a
 * row may take the file's paper code; writing it is the same null-filling as
 * every other field, so one function changes a registry row during an ingest
 * rather than two that have to agree with each other.
 */
async function fillPaperGaps(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  paper: PastPaperRow,
  input: IngestPastPaperInput,
): Promise<{ id: string }> {
  const data: Record<string, unknown> = {};

  if (paper.paperCode === null && input.paper.paperCode !== null) {
    data.paperCode = input.paper.paperCode;
  }
  if (paper.setCode === null && input.paper.setCode !== null) {
    data.setCode = input.paper.setCode;
  }
  if (paper.printedQuestionCount === null && input.paper.printedQuestionCount !== null) {
    data.printedQuestionCount = input.paper.printedQuestionCount;
  }
  if (paper.totalMarks === null && input.paper.totalMarks !== null) {
    data.totalMarks = input.paper.totalMarks;
  }
  if (paper.sourceUrl === null && input.paper.sourceUrl !== null) {
    data.sourceUrl = input.paper.sourceUrl;
  }
  if (paper.region === null && input.paper.region !== null) {
    data.region = input.paper.region;
  }

  if (Object.keys(data).length > 0) {
    await tx.pastPaper.update({ where: { id: paper.id }, data });
  }

  return { id: paper.id };
}

/** What the run will leave as the denominator: the registry's, else the file's. */
function printedCount(paper: PastPaperRow | null, input: IngestPastPaperInput): number | null {
  return paper?.printedQuestionCount ?? input.paper.printedQuestionCount;
}

function toIssues(error: z.ZodError): ImportRowError["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
