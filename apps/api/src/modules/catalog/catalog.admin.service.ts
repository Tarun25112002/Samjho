import type {
  AdminChapter,
  AdminListSubjectsQuery,
  AdminSubject,
  AdminTopic,
  CreateChapterInput,
  CreateSubjectInput,
  CreateTopicInput,
  UpdateChapterInput,
  UpdateSubjectInput,
  UpdateTopicInput,
} from "@samjho/contracts";

import { ConflictError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import {
  catalogAdminRepository,
  type AdminChapterRow,
  type AdminSubjectRow,
  type AdminTopicRow,
} from "./catalog.admin.repository.js";

/**
 * Taxonomy editing.
 *
 * The interesting work here is not the CRUD — it is the three things the database
 * cannot say for itself:
 *
 *  - a unique-constraint violation is a 409 with the offending field named, not a
 *    500 with a Postgres error code;
 *  - a reorder must cover exactly the rows it claims to, no more and no fewer;
 *  - deactivating is the delete, and the caller is told what it affects.
 */

export const catalogAdminService = {
  async listSubjects(query: AdminListSubjectsQuery): Promise<AdminSubject[]> {
    const [rows, chapterCounts, questionCounts] = await Promise.all([
      catalogAdminRepository.listSubjects({
        ...(query.board === undefined ? {} : { board: query.board }),
        ...(query.classLevel === undefined ? {} : { classLevel: query.classLevel }),
        includeInactive: query.includeInactive,
      }),
      catalogAdminRepository.countChaptersBySubject(),
      catalogAdminRepository.countQuestionsBySubject(),
    ]);

    const chapterCountById = new Map(chapterCounts.map((row) => [row.subjectId, row.count]));
    const questionCountById = new Map(questionCounts.map((row) => [row.subjectId, row.count]));

    return rows.map((row) => ({
      ...toAdminSubject(row),
      chapterCount: chapterCountById.get(row.id) ?? 0,
      questionCount: questionCountById.get(row.id) ?? 0,
    }));
  },

  async createSubject(input: CreateSubjectInput): Promise<AdminSubject> {
    const orderIndex = await catalogAdminRepository.nextSubjectOrderIndex(
      input.board,
      input.classLevel,
    );

    const row = await guardUnique(
      () => catalogAdminRepository.createSubject(input, orderIndex),
      subjectConflictMessage,
    );

    return { ...toAdminSubject(row), chapterCount: 0, questionCount: 0 };
  },

  async updateSubject(id: string, input: UpdateSubjectInput): Promise<AdminSubject> {
    // Existence is checked before the write rather than inferred from Prisma's
    // P2025, so "no such subject" is a 404 with the resource named instead of a
    // generic failure — and so the update and the not-found path read the same
    // as every other module's.
    const existing = await catalogAdminRepository.findSubjectById(id);
    if (!existing) throw new NotFoundError("Subject");

    const row = await guardUnique(
      () => catalogAdminRepository.updateSubject(id, input),
      subjectConflictMessage,
    );

    const [chapterCounts, questionCounts] = await Promise.all([
      catalogAdminRepository.countChaptersBySubject(),
      catalogAdminRepository.countQuestionsBySubject(),
    ]);

    return {
      ...toAdminSubject(row),
      chapterCount: chapterCounts.find((c) => c.subjectId === id)?.count ?? 0,
      questionCount: questionCounts.find((c) => c.subjectId === id)?.count ?? 0,
    };
  },

  async listChapters(subjectId: string, includeInactive: boolean): Promise<AdminChapter[]> {
    const subject = await catalogAdminRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundError("Subject");

    const [rows, allCounts, publishedCounts] = await Promise.all([
      catalogAdminRepository.listChapters(subjectId, includeInactive),
      catalogAdminRepository.countQuestionsByChapter(subjectId, false),
      catalogAdminRepository.countQuestionsByChapter(subjectId, true),
    ]);

    const topicCounts = await Promise.all(
      rows.map((row) => catalogAdminRepository.countQuestionsByTopic(row.id)),
    );

    const allById = new Map(allCounts.map((row) => [row.chapterId, row.count]));
    const publishedById = new Map(publishedCounts.map((row) => [row.chapterId, row.count]));

    return rows.map((row, index) =>
      toAdminChapter(row, {
        questionCount: allById.get(row.id) ?? 0,
        publishedQuestionCount: publishedById.get(row.id) ?? 0,
        topicCounts: topicCounts[index] ?? [],
      }),
    );
  },

  async createChapter(subjectId: string, input: CreateChapterInput): Promise<AdminChapter> {
    const subject = await catalogAdminRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundError("Subject");

    const orderIndex =
      input.orderIndex ?? (await catalogAdminRepository.nextChapterOrderIndex(subjectId));

    const row = await guardUnique(
      () => catalogAdminRepository.createChapter(subjectId, input, orderIndex),
      chapterConflictMessage,
    );

    return toAdminChapter(row, {
      questionCount: 0,
      publishedQuestionCount: 0,
      topicCounts: [],
    });
  },

  async updateChapter(id: string, input: UpdateChapterInput): Promise<AdminChapter> {
    const existing = await catalogAdminRepository.findChapterById(id);
    if (!existing) throw new NotFoundError("Chapter");

    const row = await guardUnique(
      () => catalogAdminRepository.updateChapter(id, input),
      chapterConflictMessage,
    );

    return this.hydrateChapter(row);
  },

  async getChapter(id: string): Promise<AdminChapter> {
    const row = await catalogAdminRepository.findChapterById(id);
    if (!row) throw new NotFoundError("Chapter");
    return this.hydrateChapter(row);
  },

  async hydrateChapter(row: AdminChapterRow): Promise<AdminChapter> {
    const [allCounts, publishedCounts, topicCounts] = await Promise.all([
      catalogAdminRepository.countQuestionsByChapter(row.subjectId, false),
      catalogAdminRepository.countQuestionsByChapter(row.subjectId, true),
      catalogAdminRepository.countQuestionsByTopic(row.id),
    ]);

    return toAdminChapter(row, {
      questionCount: allCounts.find((c) => c.chapterId === row.id)?.count ?? 0,
      publishedQuestionCount: publishedCounts.find((c) => c.chapterId === row.id)?.count ?? 0,
      topicCounts,
    });
  },

  async reorderChapters(subjectId: string, orderedIds: string[]): Promise<AdminChapter[]> {
    const subject = await catalogAdminRepository.findSubjectById(subjectId);
    if (!subject) throw new NotFoundError("Subject");

    const existing = await catalogAdminRepository.chapterIdsFor(subjectId);
    assertCoversExactly(
      existing.map((row) => row.id),
      orderedIds,
      "chapter",
    );

    await catalogAdminRepository.reorderChapters(subjectId, orderedIds);
    return this.listChapters(subjectId, true);
  },

  async createTopic(chapterId: string, input: CreateTopicInput): Promise<AdminTopic> {
    const chapter = await catalogAdminRepository.findChapterById(chapterId);
    if (!chapter) throw new NotFoundError("Chapter");

    const orderIndex =
      input.orderIndex ?? (await catalogAdminRepository.nextTopicOrderIndex(chapterId));

    const row = await guardUnique(
      () => catalogAdminRepository.createTopic(chapterId, input, orderIndex),
      topicConflictMessage,
    );

    return { ...toAdminTopic(row), questionCount: 0 };
  },

  async updateTopic(id: string, input: UpdateTopicInput): Promise<AdminTopic> {
    const existing = await catalogAdminRepository.findTopicById(id);
    if (!existing) throw new NotFoundError("Topic");

    const row = await guardUnique(
      () => catalogAdminRepository.updateTopic(id, input),
      topicConflictMessage,
    );

    const counts = await catalogAdminRepository.countQuestionsByTopic(row.chapterId);
    return {
      ...toAdminTopic(row),
      questionCount: counts.find((c) => c.topicId === row.id)?.count ?? 0,
    };
  },

  async reorderTopics(chapterId: string, orderedIds: string[]): Promise<AdminChapter> {
    const chapter = await catalogAdminRepository.findChapterById(chapterId);
    if (!chapter) throw new NotFoundError("Chapter");

    const existing = await catalogAdminRepository.topicIdsFor(chapterId);
    assertCoversExactly(
      existing.map((row) => row.id),
      orderedIds,
      "topic",
    );

    await catalogAdminRepository.reorderTopics(chapterId, orderedIds);
    return this.getChapter(chapterId);
  },
};

/**
 * A reorder must name every sibling exactly once.
 *
 * Three failures are caught here, and the last is the one worth the code. A
 * duplicate id or a missing one produces a list with holes. But an id belonging
 * to *another subject* would, without this check, be silently updated by the
 * transaction's `where: { id, subjectId }` — Prisma raises P2025 and the whole
 * transaction rolls back, so the caller would see an opaque 500 for what is
 * really "that chapter is not yours to reorder". Naming it here makes it a 400
 * with a message an editor can act on.
 */
function assertCoversExactly(existingIds: string[], orderedIds: string[], label: string): void {
  const unique = new Set(orderedIds);

  if (unique.size !== orderedIds.length) {
    throw new ValidationError(`The ${label} order lists the same id more than once`, [
      { path: "body.orderedIds", message: `each ${label} may appear only once` },
    ]);
  }

  const existing = new Set(existingIds);
  const foreign = orderedIds.filter((id) => !existing.has(id));

  if (foreign.length > 0) {
    throw new ValidationError(`The ${label} order includes ids that do not belong here`, [
      { path: "body.orderedIds", message: `unknown ${label} ids: ${foreign.join(", ")}` },
    ]);
  }

  if (unique.size !== existing.size) {
    // Partial orders are rejected rather than appended, because "the ones you
    // did not mention keep their current index" produces collisions the moment
    // a new row was added between the client loading the list and saving it.
    throw new ValidationError(`The ${label} order must list every ${label}`, [
      {
        path: "body.orderedIds",
        message: `expected ${String(existing.size)} ids, received ${String(unique.size)}`,
      },
    ]);
  }
}

/**
 * Turn a unique-constraint violation into a 409 that names the field.
 *
 * Duck-typed on Prisma's `code` rather than `instanceof
 * PrismaClientKnownRequestError`. The codes are a documented, stable contract;
 * which classes the generated client re-exports has changed between major
 * versions. This also keeps the check working through the driver adapter, where
 * the error can be re-wrapped on its way up.
 */
interface PrismaErrorish {
  code: string;
  meta?: Record<string, unknown>;
  message?: string;
}

function asPrismaError(error: unknown): PrismaErrorish | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as { code?: unknown; meta?: unknown; message?: unknown };
  if (typeof candidate.code !== "string") return null;

  return {
    code: candidate.code,
    ...(typeof candidate.meta === "object" && candidate.meta !== null
      ? { meta: candidate.meta as Record<string, unknown> }
      : {}),
    ...(typeof candidate.message === "string" ? { message: candidate.message } : {}),
  };
}

/**
 * Which columns collided, as a lowercase haystack.
 *
 * Three sources, because where Prisma puts this depends on how it reached the
 * database. Its own query engine fills `meta.target` with a field-name array;
 * the `pg` driver adapter this project uses leaves `meta.target` undefined and
 * buries the fields in `meta.driverAdapterError.cause.constraint.fields`
 * instead. Reading only one of them is how a 409 quietly degrades to a vaguer
 * message after a driver change, with no test failing.
 *
 * The message is the last resort and is read *narrowly* — only the parenthesised
 * field list Prisma appends. The full message also embeds the rejected query,
 * which contains every column name in the payload, so matching against the whole
 * string would report "slug" for a conflict that had nothing to do with it.
 */
const FIELD_LIST = /unique constraint failed on the fields: \(([^)]*)\)/i;

function conflictTarget(error: PrismaErrorish): string {
  const parts: string[] = [];

  const target = error.meta?.["target"];
  if (Array.isArray(target)) parts.push(target.join(" "));
  else if (typeof target === "string") parts.push(target);

  const adapterFields = readAdapterConstraintFields(error.meta?.["driverAdapterError"]);
  if (adapterFields) parts.push(adapterFields);

  const fromMessage = error.message === undefined ? null : FIELD_LIST.exec(error.message)?.[1];
  if (fromMessage) parts.push(fromMessage);

  return parts.join(" ").toLowerCase();
}

function readAdapterConstraintFields(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;

  const cause = (value as { cause?: unknown }).cause;
  if (typeof cause !== "object" || cause === null) return null;

  const constraint = (cause as { constraint?: unknown }).constraint;
  if (typeof constraint !== "object" || constraint === null) return null;

  const fields = (constraint as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return null;

  return fields.filter((field): field is string => typeof field === "string").join(" ");
}

async function guardUnique<T>(
  run: () => Promise<T>,
  describe: (target: string) => string,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const prismaError = asPrismaError(error);
    if (prismaError?.code === "P2002") {
      // Logged before translating, because the constraint name in the original
      // is the fastest way to tell which of a subject's two unique keys fired,
      // and the 409 the editor sees deliberately does not carry it.
      logger.debug({ target: prismaError.meta?.target }, "Unique constraint rejected a write");

      const message = describe(conflictTarget(prismaError));
      throw new ConflictError(message, [{ path: "body", message }]);
    }
    throw error;
  }
}

function subjectConflictMessage(target: string): string {
  if (target.includes("slug")) return "A subject with that slug already exists";
  return "A subject with that board, class, code and variant already exists";
}

function chapterConflictMessage(target: string): string {
  // Chapter slugs are unique *within a subject*, so the only unique key on this
  // table mentions the slug either way — but the check keeps the message honest
  // if another one is added.
  if (target.includes("slug")) return "This subject already has a chapter with that slug";
  return "That chapter already exists";
}

function topicConflictMessage(target: string): string {
  if (target.includes("slug")) return "This chapter already has a topic with that slug";
  return "That topic already exists";
}

function toAdminSubject(
  row: AdminSubjectRow,
): Omit<AdminSubject, "chapterCount" | "questionCount"> {
  return {
    id: row.id,
    board: row.board,
    classLevel: row.classLevel,
    code: row.code,
    name: row.name,
    slug: row.slug,
    variant: row.variant,
    theoryMarks: row.theoryMarks,
    hasPractical: row.hasPractical,
    internalMarks: row.internalMarks,
    syllabusYear: row.syllabusYear,
    isActive: row.isActive,
    orderIndex: row.orderIndex,
  };
}

function toAdminChapter(
  row: AdminChapterRow,
  counts: {
    questionCount: number;
    publishedQuestionCount: number;
    topicCounts: { topicId: string; count: number }[];
  },
): AdminChapter {
  const topicCountById = new Map(counts.topicCounts.map((c) => [c.topicId, c.count]));

  return {
    id: row.id,
    subjectId: row.subjectId,
    name: row.name,
    slug: row.slug,
    orderIndex: row.orderIndex,
    ncertChapterNo: row.ncertChapterNo,
    domain: row.domain,
    isActive: row.isActive,
    questionCount: counts.questionCount,
    publishedQuestionCount: counts.publishedQuestionCount,
    topics: row.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      slug: topic.slug,
      orderIndex: topic.orderIndex,
      isActive: topic.isActive,
      questionCount: topicCountById.get(topic.id) ?? 0,
    })),
  };
}

function toAdminTopic(row: AdminTopicRow): Omit<AdminTopic, "questionCount"> {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    orderIndex: row.orderIndex,
    isActive: row.isActive,
  };
}
