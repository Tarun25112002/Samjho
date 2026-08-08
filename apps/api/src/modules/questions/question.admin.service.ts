import { createHash } from "node:crypto";

import {
  canTransitionQuestionStatus,
  defaultExpectedTimeSeconds,
  markingStepSchema,
  publicationBlockers,
  QUESTION_STATUS_TRANSITIONS,
  type AdminListQuestionsQuery,
  type AdminQuestion,
  type AdminQuestionSummary,
  type AdminSubPart,
  type ChangeQuestionStatusInput,
  type MarkingStep,
  type Paginated,
  type QuestionRevision,
  type SubPartInput,
  type WriteQuestionInput,
} from "@samjho/contracts";
import { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import {
  questionAdminRepository,
  type AdminQuestionRow,
  type AdminQuestionSummaryRow,
  type AdminSubPartRow,
  type ResolvedQuestionWrite,
} from "./question.admin.repository.js";

/**
 * Authoring business logic: the three things the database and the schema between
 * them cannot decide.
 *
 *  1. **Whether the ids in a document belong together.** A question's topics
 *     must live in its chapter. Postgres will happily link a Maths topic to a
 *     Science question — both are valid foreign keys — and the damage does not
 *     show up until mastery is attributed to a topic the student never studied.
 *
 *  2. **Whether an edit changed anything.** `contentHash` turns that from a
 *     judgement call into a comparison, which is what makes it safe to save a
 *     form twice without inflating a version number that attempts are recorded
 *     against.
 *
 *  3. **Whether a status move is allowed, and whether publication is earned.**
 *     Publishing is a higher bar than saving: it is the point at which a
 *     licensing decision stops being optional (docs/07 R2).
 */

// ── Content hashing ──────────────────────────────────────────────────────────

/**
 * A stable fingerprint of everything a student actually answers against.
 *
 * Deliberately excludes `difficulty`, `bloomLevel` and `expectedTimeSeconds`.
 * Those are editorial metadata — retagging a question as HARD does not change
 * what it asks or what counts as right, so it should not bump a version that
 * past attempts are pinned to. It also excludes provenance, for the same reason:
 * correcting an attribution is not a change to the question.
 *
 * Key order is fixed by construction rather than by `JSON.stringify` of a
 * literal, because object key order is a property of how the object was built,
 * and two identical questions built by two code paths must hash the same.
 */
export function hashQuestionContent(input: WriteQuestionInput): string {
  const canonical = JSON.stringify([
    input.type,
    input.body,
    input.bodyHindi,
    input.marks,
    input.options.map((option) => [option.label, option.body, option.isCorrect]),
    input.assets.map((asset) => [asset.kind, asset.url, asset.altText, asset.caption]),
    answerFingerprint(input.answer),
    input.subParts.map((part) => [
      part.type,
      part.body,
      part.bodyHindi,
      part.marks,
      part.options.map((option) => [option.label, option.body, option.isCorrect]),
      part.assets.map((asset) => [asset.kind, asset.url, asset.altText, asset.caption]),
      answerFingerprint(part.answer),
    ]),
  ]);

  return createHash("sha256").update(canonical).digest("hex");
}

function answerFingerprint(answer: WriteQuestionInput["answer"]): unknown {
  if (!answer) return null;

  return [
    answer.correctValue,
    // Sorted: "9.8" then "9.80" and "9.80" then "9.8" are the same answer key,
    // and reordering the accepted values is not an edit anyone should have to
    // justify with a version bump.
    [...answer.acceptedValues].sort(),
    answer.tolerance,
    answer.unit,
    answer.solution,
    answer.explanation,
    answer.markingScheme?.map((step) => [step.step, step.marks, step.keyPoints]) ?? null,
  ];
}

// ── The service ──────────────────────────────────────────────────────────────

export const questionAdminService = {
  async list(query: AdminListQuestionsQuery): Promise<Paginated<AdminQuestionSummary>> {
    const { rows, hasMore } = await questionAdminRepository.list(query);
    const items = rows.map(toAdminQuestionSummary);

    return {
      items,
      pageInfo: { hasMore, nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null },
    };
  },

  async getById(id: string): Promise<AdminQuestion> {
    const row = await questionAdminRepository.findById(id);
    if (!row) throw new NotFoundError("Question");
    return toAdminQuestion(row);
  },

  async listRevisions(id: string): Promise<QuestionRevision[]> {
    const exists = await questionAdminRepository.findWritableById(id);
    if (!exists) throw new NotFoundError("Question");

    const rows = await questionAdminRepository.listRevisions(id);
    return rows.map(toQuestionRevision);
  },

  /**
   * Create a question. Always lands in `DRAFT`.
   *
   * Publication is a second, deliberate act even when the author is certain,
   * because it is the step that checks the licensing decision — and an endpoint
   * that could create-and-publish in one call is an endpoint that bulk import
   * would eventually be pointed at.
   */
  async create(input: WriteQuestionInput, authorId: string): Promise<AdminQuestion> {
    const chapter = await loadChapter(input.chapterId);
    await assertTopicsBelongToChapter(input, chapter.id);

    const write = await resolveWrite(input);

    const id = await prisma.$transaction((tx) =>
      questionAdminRepository.createTree(tx, { ...write, authorId }, chapter.id),
    );

    return this.getById(id);
  },

  /**
   * Replace a question's content.
   *
   * The version bumps only when the content hash moves. Re-saving an untouched
   * form, or correcting a typo in the review notes, leaves the version alone —
   * which matters because from Phase 5 every attempt records the version it saw,
   * and a version that changes for no reason makes that record meaningless.
   */
  async update(id: string, input: WriteQuestionInput, editorId: string): Promise<AdminQuestion> {
    const existing = await questionAdminRepository.findWritableById(id);
    if (!existing) throw new NotFoundError("Question");

    if (existing.parentId !== null) {
      // Guarded because a sub-part id in this route would otherwise create a
      // second, parentless copy of the question tree.
      throw new ValidationError("Edit the case study, not its sub-part on its own", [
        { path: "params.id", message: "this is a sub-part of a case study" },
      ]);
    }

    const chapter = await loadChapter(input.chapterId);
    await assertTopicsBelongToChapter(input, chapter.id);

    const before = await questionAdminRepository.findById(id);
    const write = await resolveWrite(input);
    const contentChanged = write.contentHash !== existing.contentHash;
    const version = contentChanged ? existing.version + 1 : existing.version;

    await prisma.$transaction((tx) =>
      questionAdminRepository.updateTree(
        tx,
        id,
        { ...write, authorId: editorId },
        chapter.id,
        version,
      ),
    );

    const after = await questionAdminRepository.findById(id);
    if (!after) throw new NotFoundError("Question");

    /*
     * Diffed from the stored rows on both sides rather than from the input
     * against a row. One description function, applied twice, cannot disagree
     * with itself about how to render an option list; two of them eventually
     * always do, and the symptom is an audit log reporting changes nobody made.
     *
     * The `after` read and the revision insert sit *outside* the write
     * transaction, for two reasons. The response needs that read anyway, so
     * doing it inside meant fetching the same tree twice. And a deeply nested
     * read inside a Prisma interactive transaction issues its relation queries
     * concurrently on the one connection that transaction holds, which `pg`
     * currently tolerates and deprecates — so the version that removes it would
     * have turned every question edit into a runtime error.
     *
     * The cost is a narrow window: a crash between the commit and this insert
     * loses one audit entry. The question's own `version` and `updatedAt` still
     * moved, so the change is not invisible — and trading that against a write
     * path that breaks on a dependency upgrade is not a close call.
     */
    const changes = diffQuestions(before, after);

    if (changes.length > 0) {
      await questionAdminRepository.recordRevision(prisma, {
        questionId: id,
        version: await questionAdminRepository.nextRevisionNumber(prisma, id),
        diff: changes as unknown as Prisma.InputJsonValue,
        reason: null,
        editedById: editorId,
      });
    }

    return toAdminQuestion(after);
  },

  /**
   * Move a question through its lifecycle.
   *
   * Separate from `update` on purpose. "Save my edits" and "let students see
   * this" are different decisions with different consequences, and folding the
   * second into the first means every save is a publish for anyone who forgets
   * to change a dropdown.
   */
  async changeStatus(
    id: string,
    input: ChangeQuestionStatusInput,
    editorId: string,
  ): Promise<AdminQuestion> {
    const row = await questionAdminRepository.findById(id);
    if (!row) throw new NotFoundError("Question");

    const from = row.status;
    const to = input.status;

    if (!canTransitionQuestionStatus(from, to)) {
      const allowed = QUESTION_STATUS_TRANSITIONS[from];
      throw new ConflictError(
        allowed.length === 0
          ? `A ${from.toLowerCase()} question cannot change status`
          : `A ${from.toLowerCase()} question can only move to ${allowed.join(", ").toLowerCase()}`,
        [{ path: "body.status", message: `${from} → ${to} is not a permitted move` }],
      );
    }

    if (to === "PUBLISHED") {
      const blockers = blockersFor(row);
      if (blockers.length > 0) {
        throw new ValidationError(
          "This question is not ready to be published",
          blockers.map((message) => ({ path: "body.status", message })),
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      await questionAdminRepository.setStatus(tx, id, to);

      await questionAdminRepository.recordRevision(tx, {
        questionId: id,
        version: await questionAdminRepository.nextRevisionNumber(tx, id),
        diff: [{ field: "status", from, to }] as unknown as Prisma.InputJsonValue,
        reason: input.reason,
        editedById: editorId,
      });
    });

    return this.getById(id);
  },
};

// ── Referential rules ────────────────────────────────────────────────────────

async function loadChapter(chapterId: string) {
  const chapter = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: { id: true, subjectId: true },
  });

  if (!chapter) {
    throw new ValidationError("That chapter does not exist", [
      { path: "body.chapterId", message: "unknown chapter" },
    ]);
  }

  return chapter;
}

/**
 * Every topic on the question — and on each sub-part — must live in the chapter
 * the question is filed under.
 *
 * The foreign key alone permits any topic in the database, so without this a
 * Science question can be tagged with a Maths topic. It renders fine, lists
 * fine, and quietly attributes the student's mastery to a topic they have never
 * opened. Bulk import makes this near-certain rather than hypothetical: a
 * mis-sorted spreadsheet column is one bad paste away.
 */
async function assertTopicsBelongToChapter(
  input: WriteQuestionInput,
  chapterId: string,
): Promise<void> {
  const requested = new Set(input.topicIds);
  for (const part of input.subParts) {
    for (const topicId of part.topicIds ?? []) requested.add(topicId);
  }

  const found = await prisma.topic.findMany({
    where: { id: { in: [...requested] }, chapterId },
    select: { id: true },
  });

  const valid = new Set(found.map((topic) => topic.id));
  const strays = [...requested].filter((topicId) => !valid.has(topicId));

  if (strays.length > 0) {
    throw new ValidationError("Those topics do not belong to this chapter", [
      {
        path: "body.topicIds",
        message: `not in this chapter: ${strays.join(", ")}`,
      },
    ]);
  }
}

async function resolveWrite(
  input: WriteQuestionInput,
): Promise<Omit<ResolvedQuestionWrite, "authorId">> {
  const chapter = await prisma.chapter.findUniqueOrThrow({
    where: { id: input.chapterId },
    select: { subjectId: true },
  });

  return {
    input,
    subjectId: chapter.subjectId,
    expectedTimeSeconds: input.expectedTimeSeconds ?? defaultExpectedTimeSeconds(input.marks),
    subPartTimes: input.subParts.map(
      (part: SubPartInput) => part.expectedTimeSeconds ?? defaultExpectedTimeSeconds(part.marks),
    ),
    contentHash: hashQuestionContent(input),
  };
}

function blockersFor(row: AdminQuestionRow): string[] {
  return publicationBlockers({
    licenceStatus: row.source?.licenceStatus ?? "NEEDS_REVIEW",
    hasSolution: Boolean(row.answer?.solution),
    isContainer: row.isContainer,
  });
}

// ── Diffing ──────────────────────────────────────────────────────────────────

interface FieldChange {
  field: string;
  from: string | null;
  to: string | null;
}

/**
 * A question rendered as a flat map of readable strings.
 *
 * Strings rather than a faithful union of each field's type, because the only
 * consumer is a person asking "what did somebody change on the day a student
 * reported this answer was wrong". A structured diff would answer that no better
 * and would need a renderer of its own on every surface that shows it.
 */
function describe(row: AdminQuestionRow | null): Record<string, string | null> {
  if (!row) return {};

  return {
    type: row.type,
    body: row.body,
    bodyHindi: row.bodyHindi,
    marks: String(row.marks),
    difficulty: row.difficulty,
    bloomLevel: row.bloomLevel,
    expectedTimeSeconds: String(row.expectedTimeSeconds),
    chapter: row.chapter.name,
    topics: row.topics.map((link) => link.topic.name).join(", "),
    options: row.options
      .map((option) => `${option.label}. ${option.body}${option.isCorrect ? "  ✓" : ""}`)
      .join("\n"),
    correctValue: row.answer?.correctValue ?? null,
    acceptedValues: row.answer?.acceptedValues.join(" | ") ?? null,
    tolerance: row.answer?.tolerance === null ? null : String(row.answer?.tolerance ?? ""),
    unit: row.answer?.unit ?? null,
    solution: row.answer?.solution ?? null,
    explanation: row.answer?.explanation ?? null,
    markingScheme:
      parseMarkingScheme(row.answer?.markingScheme)
        ?.map((step) => `${step.marks}: ${step.step}`)
        .join("\n") ?? null,
    assets: row.assets.map((asset) => `${asset.kind} ${asset.url}`).join("\n"),
    sourceType: row.source?.sourceType ?? null,
    licenceStatus: row.source?.licenceStatus ?? null,
    attributionText: row.source?.attributionText ?? null,
    subParts: row.subParts
      .map((part) => `(${part.subPartIndex ?? 0}) [${part.marks}m] ${part.body}`)
      .join("\n"),
    version: String(row.version),
  };
}

function diffQuestions(before: AdminQuestionRow | null, after: AdminQuestionRow): FieldChange[] {
  const left = describe(before);
  const right = describe(after);

  return Object.keys(right)
    .filter((field) => (left[field] ?? null) !== (right[field] ?? null))
    .map((field) => ({ field, from: left[field] ?? null, to: right[field] ?? null }));
}

// ── Serializers ──────────────────────────────────────────────────────────────

const markingSchemeSchema = z.array(markingStepSchema);

/**
 * `markingScheme` is a Json column, so what comes back is `unknown` as far as
 * correctness goes. Parsed rather than cast: a row written before the shape
 * settled, or by hand in a psql session, must degrade to "no marking scheme"
 * rather than crashing the editor that is trying to fix it.
 */
function parseMarkingScheme(value: unknown): MarkingStep[] | null {
  if (value === null || value === undefined) return null;
  const parsed = markingSchemeSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function toAdminCore(row: AdminQuestionRow | AdminSubPartRow) {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    bodyHindi: row.bodyHindi,
    marks: row.marks,
    difficulty: row.difficulty,
    bloomLevel: row.bloomLevel,
    expectedTimeSeconds: row.expectedTimeSeconds,
    status: row.status,
    version: row.version,
    options: row.options,
    assets: row.assets,
    answer: row.answer
      ? {
          correctValue: row.answer.correctValue,
          acceptedValues: row.answer.acceptedValues,
          tolerance: row.answer.tolerance,
          unit: row.answer.unit,
          solution: row.answer.solution,
          explanation: row.answer.explanation,
          markingScheme: parseMarkingScheme(row.answer.markingScheme),
        }
      : null,
    topics: row.topics.map((link) => ({
      id: link.topic.id,
      name: link.topic.name,
      slug: link.topic.slug,
      isPrimary: link.isPrimary,
    })),
  };
}

export function toAdminQuestion(row: AdminQuestionRow): AdminQuestion {
  return {
    ...toAdminCore(row),
    subjectId: row.subjectId,
    chapter: row.chapter,
    isContainer: row.isContainer,
    subParts: row.subParts.map(toAdminSubPart),
    source: row.source
      ? {
          ...row.source,
          reviewedAt: row.source.reviewedAt?.toISOString() ?? null,
        }
      : null,
    publicationBlockers: blockersFor(row),
    authorName: row.author?.name ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toAdminSubPart(row: AdminSubPartRow): AdminSubPart {
  return { ...toAdminCore(row), subPartIndex: row.subPartIndex ?? 0 };
}

export function toAdminQuestionSummary(row: AdminQuestionSummaryRow): AdminQuestionSummary {
  const primary = row.topics[0]?.topic ?? null;

  return {
    id: row.id,
    type: row.type,
    body: row.body,
    marks: row.marks,
    difficulty: row.difficulty,
    status: row.status,
    version: row.version,
    isContainer: row.isContainer,
    subPartCount: row._count.subParts,
    chapter: row.chapter,
    primaryTopic: primary ? { id: primary.id, name: primary.name } : null,
    licenceStatus: row.source?.licenceStatus ?? null,
    sourceType: row.source?.sourceType ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

const fieldChangeSchema = z.array(
  z.object({
    field: z.string(),
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
);

function toQuestionRevision(row: {
  id: string;
  version: number;
  diff: unknown;
  reason: string | null;
  createdAt: Date;
  editedBy: { name: string | null } | null;
}): QuestionRevision {
  const parsed = fieldChangeSchema.safeParse(row.diff);

  return {
    id: row.id,
    version: row.version,
    reason: row.reason,
    changes: parsed.success ? parsed.data : [],
    editedByName: row.editedBy?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
