import type {
  AdminListQuestionsQuery,
  QuestionStatus,
  SubPartInput,
  WriteQuestionInput,
} from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/**
 * The contract enum and the Prisma enum have identical members — a fact asserted
 * by `src/test/enum-parity.test.ts` rather than assumed — so one alias serves
 * both sides of this file.
 */
type QuestionStatusValue = QuestionStatus;

/**
 * Question writes, and the reads that show an editor everything.
 *
 * A separate file from `question.repository.ts`, for the same reason the catalog
 * has two: the student repository's select is the enforcement point for the
 * answer-key rule, and the surest way to break that is to have a select in the
 * same file that deliberately includes `isCorrect` and `solution`. Two files,
 * two audiences, no shared constant that could wander from one to the other.
 *
 * Everything that writes runs inside a transaction. A question is a tree —
 * options, answer key, provenance, topic links, sub-parts each with their own
 * children — and a half-written tree is worse than no question at all: an MCQ
 * whose options failed to insert renders as an unanswerable stem, and nothing
 * about it looks broken in a list.
 */

const optionSelect = {
  id: true,
  label: true,
  body: true,
  isCorrect: true,
  orderIndex: true,
} satisfies Prisma.QuestionOptionSelect;

const assetSelect = {
  id: true,
  kind: true,
  url: true,
  altText: true,
  caption: true,
  orderIndex: true,
} satisfies Prisma.QuestionAssetSelect;

const answerSelect = {
  correctValue: true,
  acceptedValues: true,
  tolerance: true,
  unit: true,
  solution: true,
  explanation: true,
  markingScheme: true,
} satisfies Prisma.QuestionAnswerSelect;

const topicsSelect = {
  select: { isPrimary: true, topic: { select: { id: true, name: true, slug: true } } },
  orderBy: { isPrimary: "desc" as const },
};

/** Everything a question is, answer key included. Never used on a student path. */
const adminCoreSelect = {
  id: true,
  type: true,
  body: true,
  bodyHindi: true,
  marks: true,
  difficulty: true,
  bloomLevel: true,
  expectedTimeSeconds: true,
  status: true,
  version: true,
  contentHash: true,
  options: { select: optionSelect, orderBy: { orderIndex: "asc" } },
  assets: { select: assetSelect, orderBy: { orderIndex: "asc" } },
  answer: { select: answerSelect },
  topics: topicsSelect,
} satisfies Prisma.QuestionSelect;

export const adminQuestionSelect = {
  ...adminCoreSelect,
  subjectId: true,
  isContainer: true,
  parentId: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  chapter: { select: { id: true, name: true, slug: true, domain: true } },
  author: { select: { name: true } },
  source: {
    select: {
      sourceType: true,
      year: true,
      examSession: true,
      paperCode: true,
      setNumber: true,
      originalQuestionNumber: true,
      sourceUrl: true,
      licenceStatus: true,
      attributionText: true,
      reviewedAt: true,
      reviewNotes: true,
    },
  },
  subParts: {
    select: { ...adminCoreSelect, subPartIndex: true },
    orderBy: { subPartIndex: "asc" },
  },
} satisfies Prisma.QuestionSelect;

export type AdminQuestionRow = Prisma.QuestionGetPayload<{ select: typeof adminQuestionSelect }>;
export type AdminSubPartRow = AdminQuestionRow["subParts"][number];

export const adminQuestionSummarySelect = {
  id: true,
  type: true,
  body: true,
  marks: true,
  difficulty: true,
  status: true,
  version: true,
  isContainer: true,
  updatedAt: true,
  chapter: { select: { id: true, name: true } },
  source: { select: { licenceStatus: true, sourceType: true } },
  topics: {
    where: { isPrimary: true },
    select: { topic: { select: { id: true, name: true } } },
    take: 1,
  },
  _count: { select: { subParts: true } },
} satisfies Prisma.QuestionSelect;

export type AdminQuestionSummaryRow = Prisma.QuestionGetPayload<{
  select: typeof adminQuestionSummarySelect;
}>;

/**
 * The admin list is deliberately *not* filtered by `STUDENT_VISIBLE_QUESTION`.
 * Seeing drafts, questions in review and licence-restricted rows is the entire
 * job. What it does keep is `parentId: null` — a case study is one question in
 * every count a paper makes, and listing its sub-parts as peers would put four
 * rows on screen for one question and inflate every total on the dashboard.
 */
function toAdminFilters(query: AdminListQuestionsQuery): Prisma.QuestionWhereInput {
  const where: Prisma.QuestionWhereInput = { parentId: null };

  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.chapterId) where.chapterId = query.chapterId;
  if (query.marks !== undefined) where.marks = query.marks;
  if (query.type) where.type = { in: query.type };
  if (query.difficulty) where.difficulty = { in: query.difficulty };
  if (query.status) where.status = { in: query.status };
  if (query.licenceStatus) where.source = { licenceStatus: { in: query.licenceStatus } };

  if (query.topicId) {
    where.OR = [
      { topics: { some: { topicId: query.topicId } } },
      { subParts: { some: { topics: { some: { topicId: query.topicId } } } } },
    ];
  }

  if (query.search) where.body = { contains: query.search, mode: "insensitive" };

  return where;
}

/** A question as the write path builds it, with ids already resolved. */
export interface ResolvedQuestionWrite {
  input: WriteQuestionInput;
  subjectId: string;
  authorId: string;
  /** Resolved from `expectedTimeSeconds ?? marks * 60` by the service. */
  expectedTimeSeconds: number;
  subPartTimes: number[];
  contentHash: string;
}

type Tx = Prisma.TransactionClient;

/**
 * Either the pooled client or a transaction client.
 *
 * The revision log accepts both on purpose: a status change writes its audit row
 * inside the same transaction as the status, while a content edit writes its own
 * after the write has committed (see the note in `questionAdminService.update`).
 */
type Client = Tx | typeof prisma;

export const questionAdminRepository = {
  async list(
    query: AdminListQuestionsQuery,
  ): Promise<{ rows: AdminQuestionSummaryRow[]; hasMore: boolean }> {
    const rows = await prisma.question.findMany({
      where: toAdminFilters(query),
      select: adminQuestionSummarySelect,
      // Most-recently-touched first: an editor's list is a work queue, and the
      // thing you were just editing being at the top is worth more than a stable
      // absolute order. The id tiebreak keeps the cursor deterministic when a
      // bulk import gives two hundred rows the same timestamp.
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    return { rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore };
  },

  findById(id: string): Promise<AdminQuestionRow | null> {
    return prisma.question.findUnique({ where: { id }, select: adminQuestionSelect });
  },

  /** Used by the service to decide whether an edit changed anything at all. */
  findWritableById(id: string) {
    return prisma.question.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        version: true,
        contentHash: true,
        subjectId: true,
        chapterId: true,
        isContainer: true,
        parentId: true,
      },
    });
  },

  listRevisions(questionId: string) {
    return prisma.questionRevision.findMany({
      where: { questionId },
      orderBy: { version: "desc" },
      take: 50,
      select: {
        id: true,
        version: true,
        diff: true,
        reason: true,
        createdAt: true,
        editedBy: { select: { name: true } },
      },
    });
  },

  /**
   * Create a question and its whole tree.
   *
   * `tx` is threaded through rather than opened here so that bulk import can put
   * two hundred creates inside one transaction and keep its all-or-nothing
   * promise. A repository method that opens its own transaction cannot be
   * composed into a larger one.
   */
  async createTree(tx: Tx, write: ResolvedQuestionWrite, chapterId: string): Promise<string> {
    const { input } = write;
    const isContainer = input.subParts.length > 0;

    const question = await tx.question.create({
      data: {
        subjectId: write.subjectId,
        chapterId,
        type: input.type,
        body: input.body,
        bodyHindi: input.bodyHindi,
        marks: input.marks,
        difficulty: input.difficulty,
        bloomLevel: input.bloomLevel,
        expectedTimeSeconds: write.expectedTimeSeconds,
        status: "DRAFT",
        isContainer,
        contentHash: write.contentHash,
        authorId: write.authorId,
      },
      select: { id: true },
    });

    await writeChildren(tx, question.id, input, input.topicIds);
    await writeSource(tx, question.id, input);

    for (const [index, part] of input.subParts.entries()) {
      await createSubPart(tx, {
        parentId: question.id,
        subjectId: write.subjectId,
        chapterId,
        authorId: write.authorId,
        index,
        part,
        expectedTimeSeconds: write.subPartTimes[index] ?? part.marks * 60,
        fallbackTopicIds: input.topicIds,
        parentSource: input.source,
      });
    }

    return question.id;
  },

  /**
   * Replace a question's content in place.
   *
   * Children are matched rather than wiped and rewritten: options by their
   * label, sub-parts by their position. The seed loader gets away with
   * delete-and-recreate because nothing points at its rows, but from Phase 5 a
   * `QuestionAttempt` records which option a student selected — and rebuilding
   * the options on every typo fix would orphan every one of those references
   * while the question still looked perfectly fine.
   */
  async updateTree(
    tx: Tx,
    id: string,
    write: ResolvedQuestionWrite,
    chapterId: string,
    version: number,
  ): Promise<void> {
    const { input } = write;
    const isContainer = input.subParts.length > 0;

    await tx.question.update({
      where: { id },
      data: {
        chapterId,
        type: input.type,
        body: input.body,
        bodyHindi: input.bodyHindi,
        marks: input.marks,
        difficulty: input.difficulty,
        bloomLevel: input.bloomLevel,
        expectedTimeSeconds: write.expectedTimeSeconds,
        isContainer,
        contentHash: write.contentHash,
        version,
      },
    });

    await writeChildren(tx, id, input, input.topicIds);
    await writeSource(tx, id, input);

    const existing = await tx.question.findMany({
      where: { parentId: id },
      select: { id: true, subPartIndex: true },
      orderBy: { subPartIndex: "asc" },
    });

    for (const [index, part] of input.subParts.entries()) {
      const match = existing.find((row) => row.subPartIndex === index);

      if (match) {
        await tx.question.update({
          where: { id: match.id },
          data: {
            type: part.type,
            body: part.body,
            bodyHindi: part.bodyHindi,
            marks: part.marks,
            difficulty: part.difficulty,
            bloomLevel: part.bloomLevel,
            expectedTimeSeconds: write.subPartTimes[index] ?? part.marks * 60,
            chapterId,
          },
        });

        await writeChildren(tx, match.id, part, part.topicIds ?? input.topicIds);
        await writeSource(tx, match.id, input);
      } else {
        await createSubPart(tx, {
          parentId: id,
          subjectId: write.subjectId,
          chapterId,
          authorId: write.authorId,
          index,
          part,
          expectedTimeSeconds: write.subPartTimes[index] ?? part.marks * 60,
          fallbackTopicIds: input.topicIds,
          parentSource: input.source,
        });
      }
    }

    // Sub-parts the editor removed. `onDelete: Cascade` on the self-relation
    // takes their own children with them.
    const removed = existing.filter((row) => (row.subPartIndex ?? 0) >= input.subParts.length);
    if (removed.length > 0) {
      await tx.question.deleteMany({ where: { id: { in: removed.map((row) => row.id) } } });
    }
  },

  /**
   * Move a question and its sub-parts to a new status.
   *
   * Sub-parts follow the container, always. They are never listed, never
   * selected for practice on their own and only ever rendered inside the case
   * study that owns them — but `Question.status` is read *by row* by the
   * practice-selection query in Phase 5 and the exam slot resolver in Phase 6,
   * so leaving them behind would mean a withdrawn case study whose parts are
   * still individually live.
   */
  async setStatus(tx: Tx, id: string, status: QuestionStatusValue): Promise<void> {
    await tx.question.updateMany({
      where: { OR: [{ id }, { parentId: id }] },
      data: { status },
    });

    if (status === "PUBLISHED") {
      // Stamped once and then left alone: it answers "when did students first
      // see this", which withdrawing and republishing does not change. Scoped by
      // `publishedAt: null` rather than by reading the row first, so two
      // concurrent publishes cannot race to overwrite each other's timestamp.
      await tx.question.updateMany({
        where: { OR: [{ id }, { parentId: id }], publishedAt: null },
        data: { publishedAt: new Date() },
      });
    }
  },

  async recordRevision(
    tx: Client,
    input: {
      questionId: string;
      version: number;
      diff: Prisma.InputJsonValue;
      reason: string | null;
      editedById: string;
    },
  ): Promise<void> {
    await tx.questionRevision.create({
      data: {
        questionId: input.questionId,
        version: input.version,
        diff: input.diff,
        reason: input.reason,
        editedById: input.editedById,
      },
    });
  },

  /**
   * The next entry number in this question's audit trail.
   *
   * Not `Question.version`: that identifies the content a student saw and only
   * moves when the content hash does, so a publish and a later withdrawal would
   * both want to be recorded at the same number and the second would collide on
   * `@@unique([questionId, version])`. This is a plain per-question sequence;
   * when the content version does move, it is recorded inside the diff.
   */
  async nextRevisionNumber(tx: Client, questionId: string): Promise<number> {
    const latest = await tx.questionRevision.findFirst({
      where: { questionId },
      orderBy: { version: "desc" },
      select: { version: true },
    });

    return (latest?.version ?? 0) + 1;
  },

  // ── Dashboard counts ──────────────────────────────────────────────────────

  countByStatus(subjectId: string) {
    return prisma.question.groupBy({
      by: ["status"],
      where: { subjectId, parentId: null },
      _count: { _all: true },
    });
  },

  countByLicenceStatus() {
    return prisma.questionSource.groupBy({
      by: ["licenceStatus"],
      where: { question: { parentId: null } },
      _count: { _all: true },
    });
  },

  countChaptersWithNoQuestions(subjectId: string): Promise<number> {
    return prisma.chapter.count({
      where: { subjectId, isActive: true, questions: { none: { parentId: null } } },
    });
  },

  countEditedSince(since: Date): Promise<number> {
    return prisma.question.count({ where: { parentId: null, updatedAt: { gte: since } } });
  },
};

// ── Child writes, shared by create and update ────────────────────────────────

interface ChildBearing {
  options: WriteQuestionInput["options"];
  assets: WriteQuestionInput["assets"];
  answer: WriteQuestionInput["answer"];
}

/**
 * Options, assets, topic links and the answer key.
 *
 * Options are upserted by label and the leftovers deleted, which preserves the
 * id of an option whose text was merely corrected. Assets and topic links have
 * no independent identity worth preserving — nothing references them — so they
 * are rewritten wholesale, which is both simpler and correct.
 */
async function writeChildren(
  tx: Tx,
  questionId: string,
  input: ChildBearing,
  topicIds: string[],
): Promise<void> {
  const labels = input.options.map((option) => option.label);

  for (const [index, option] of input.options.entries()) {
    await tx.questionOption.upsert({
      where: { questionId_label: { questionId, label: option.label } },
      create: {
        questionId,
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect,
        orderIndex: index,
      },
      update: { body: option.body, isCorrect: option.isCorrect, orderIndex: index },
    });
  }

  await tx.questionOption.deleteMany({ where: { questionId, label: { notIn: labels } } });

  await tx.questionAsset.deleteMany({ where: { questionId } });
  if (input.assets.length > 0) {
    await tx.questionAsset.createMany({
      data: input.assets.map((asset, index) => ({
        questionId,
        kind: asset.kind,
        url: asset.url,
        altText: asset.altText,
        caption: asset.caption,
        orderIndex: index,
      })),
    });
  }

  await tx.questionTopic.deleteMany({ where: { questionId } });
  await tx.questionTopic.createMany({
    // First in the list is the primary one — the contract makes "no primary" and
    // "two primaries" unrepresentable by encoding it as position, and this is
    // where that translates back into the database's flag.
    data: topicIds.map((topicId, index) => ({ questionId, topicId, isPrimary: index === 0 })),
  });

  if (input.answer) {
    const answer = input.answer;
    const data = {
      correctValue: answer.correctValue,
      acceptedValues: answer.acceptedValues,
      tolerance: answer.tolerance,
      unit: answer.unit,
      solution: answer.solution,
      explanation: answer.explanation,
      markingScheme: (answer.markingScheme ?? null) as Prisma.InputJsonValue,
    };

    await tx.questionAnswer.upsert({
      where: { questionId },
      create: { questionId, ...data },
      update: data,
    });
  } else {
    await tx.questionAnswer.deleteMany({ where: { questionId } });
  }
}

async function writeSource(
  tx: Tx,
  questionId: string,
  input: { source: WriteQuestionInput["source"] },
): Promise<void> {
  const data = {
    sourceType: input.source.sourceType,
    year: input.source.year,
    examSession: input.source.examSession,
    paperCode: input.source.paperCode,
    setNumber: input.source.setNumber,
    originalQuestionNumber: input.source.originalQuestionNumber,
    sourceUrl: input.source.sourceUrl,
    licenceStatus: input.source.licenceStatus,
    attributionText: input.source.attributionText,
    reviewNotes: input.source.reviewNotes,
  };

  await tx.questionSource.upsert({
    where: { questionId },
    create: { questionId, ...data },
    update: data,
  });
}

async function createSubPart(
  tx: Tx,
  ctx: {
    parentId: string;
    subjectId: string;
    chapterId: string;
    authorId: string;
    index: number;
    part: SubPartInput;
    expectedTimeSeconds: number;
    fallbackTopicIds: string[];
    parentSource: WriteQuestionInput["source"];
  },
): Promise<void> {
  const created = await tx.question.create({
    data: {
      subjectId: ctx.subjectId,
      chapterId: ctx.chapterId,
      parentId: ctx.parentId,
      subPartIndex: ctx.index,
      type: ctx.part.type,
      body: ctx.part.body,
      bodyHindi: ctx.part.bodyHindi,
      marks: ctx.part.marks,
      difficulty: ctx.part.difficulty,
      bloomLevel: ctx.part.bloomLevel,
      expectedTimeSeconds: ctx.expectedTimeSeconds,
      // A sub-part's status follows its parent's, always. It is never listed,
      // never selected for practice on its own, and only ever rendered inside
      // the case study that owns it — so a status of its own would be a second
      // switch that nothing reads and everyone eventually mis-sets.
      status: "DRAFT",
      isContainer: false,
      authorId: ctx.authorId,
    },
    select: { id: true },
  });

  await writeChildren(tx, created.id, ctx.part, ctx.part.topicIds ?? ctx.fallbackTopicIds);
  // Provenance is copied from the container rather than left null, so the
  // licence filter in `STUDENT_VISIBLE_QUESTION` means something on every row
  // rather than only on the ones a list happens to return.
  await writeSource(tx, created.id, { source: ctx.parentSource });
}
