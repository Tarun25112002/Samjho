import {
  difficultySchema,
  questionTypeSchema,
  type Board,
  type ChapterDetail,
  type ChapterListResponse,
  type ChapterSummary,
  type QuestionCounts,
  type SubjectDetail,
  type SubjectSummary,
} from "@samjho/contracts";

import { NotFoundError } from "../../lib/errors.js";
import {
  catalogRepository,
  type ChapterRow,
  type EnrollableSubjectRow,
} from "./catalog.repository.js";

/**
 * Catalog business logic.
 *
 * This module exists in Phase 2 for one reason: the auth module needs to know
 * whether a set of subject ids is legitimate, and **a module must never reach
 * into another module's tables** (docs/02 §2). Auth calls this service; it does
 * not query `subject` itself. Thirty lines now is what keeps that seam real
 * instead of aspirational — the first time it gets crossed, it stops being a
 * boundary and starts being a comment.
 */

export interface ResolvedSubjects {
  subjects: SubjectSummary[];
  /** Ids that are not valid for this board and class level. */
  missingIds: string[];
}

export const catalogService = {
  /**
   * Resolve subject ids for enrolment, reporting which ones did not resolve.
   *
   * Returning the misses rather than throwing lets the caller build a validation
   * error naming the offending ids, which is what a form needs. A bare "invalid
   * subject" tells the student nothing about which chip to un-tick.
   */
  async resolveEnrollable(params: {
    subjectIds: string[];
    board: Board;
    classLevel: number;
  }): Promise<ResolvedSubjects> {
    const rows = await catalogRepository.findEnrollable({
      ids: params.subjectIds,
      board: params.board,
      classLevel: params.classLevel,
    });

    const found = new Set(rows.map((row) => row.id));

    return {
      subjects: rows.map(toSubjectSummary),
      missingIds: params.subjectIds.filter((id) => !found.has(id)),
    };
  },

  /** Hydrate ids the caller already knows are theirs — display, not validation. */
  async listByIds(subjectIds: string[]): Promise<SubjectSummary[]> {
    if (subjectIds.length === 0) return [];
    const rows = await catalogRepository.findByIds(subjectIds);
    return rows.map(toSubjectSummary);
  },

  async listSubjects(params: { board: Board; classLevel: number }): Promise<SubjectSummary[]> {
    const rows = await catalogRepository.listActive(params);
    return rows.map(toSubjectSummary);
  },

  async getSubject(idOrSlug: string): Promise<SubjectDetail> {
    const subject = await catalogRepository.findSubject(idOrSlug);
    if (!subject) throw new NotFoundError("Subject");

    const [chapterRows, questionCounts, topicCounts, byType, byDifficulty] = await Promise.all([
      catalogRepository.listChapters(subject.id),
      catalogRepository.countByChapter(subject.id),
      catalogRepository.countTopicsByChapter(subject.id),
      catalogRepository.countByType({ subjectId: subject.id }),
      catalogRepository.countByDifficulty({ subjectId: subject.id }),
    ]);

    const chapters = toChapterSummaries(chapterRows, questionCounts, topicCounts);

    return {
      ...toSubjectSummary(subject),
      syllabusYear: subject.syllabusYear,
      hasPractical: subject.hasPractical,
      internalMarks: subject.internalMarks,
      chapters,
      domains: distinctDomains(chapters),
      counts: toCounts(byType, byDifficulty),
    };
  },

  async listChapters(subjectIdOrSlug: string): Promise<ChapterListResponse> {
    const subject = await catalogRepository.findSubject(subjectIdOrSlug);
    if (!subject) throw new NotFoundError("Subject");

    const [chapterRows, questionCounts, topicCounts] = await Promise.all([
      catalogRepository.listChapters(subject.id),
      catalogRepository.countByChapter(subject.id),
      catalogRepository.countTopicsByChapter(subject.id),
    ]);

    const chapters = toChapterSummaries(chapterRows, questionCounts, topicCounts);
    return { chapters, domains: distinctDomains(chapters) };
  },

  async getChapter(idOrSlug: string): Promise<ChapterDetail> {
    const chapter = await catalogRepository.findChapter(idOrSlug);
    if (!chapter) throw new NotFoundError("Chapter");

    const [byType, byDifficulty, topicCounts] = await Promise.all([
      catalogRepository.countByType({ chapterId: chapter.id }),
      catalogRepository.countByDifficulty({ chapterId: chapter.id }),
      catalogRepository.countByTopic(chapter.id),
    ]);

    const counts = toCounts(byType, byDifficulty);
    const topicCountById = new Map(topicCounts.map((row) => [row.topicId, row.count]));

    return {
      id: chapter.id,
      name: chapter.name,
      slug: chapter.slug,
      orderIndex: chapter.orderIndex,
      ncertChapterNo: chapter.ncertChapterNo,
      domain: chapter.domain,
      questionCount: counts.total,
      topicCount: chapter.topics.length,
      subject: toSubjectSummary(chapter.subject),
      topics: chapter.topics.map((topic) => ({
        ...topic,
        questionCount: topicCountById.get(topic.id) ?? 0,
      })),
      counts,
    };
  },
};

function toChapterSummaries(
  rows: ChapterRow[],
  questionCounts: { chapterId: string; count: number }[],
  topicCounts: { chapterId: string; count: number }[],
): ChapterSummary[] {
  // `groupBy` only returns rows that have at least one match, so a chapter with
  // no published questions is simply absent from the result. Defaulting to zero
  // here is what stops it disappearing from the browse list entirely — an empty
  // chapter still needs to be visible, or a student cannot tell "nothing here
  // yet" from "this chapter is not in the syllabus".
  const questionCountById = new Map(questionCounts.map((row) => [row.chapterId, row.count]));
  const topicCountById = new Map(topicCounts.map((row) => [row.chapterId, row.count]));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    orderIndex: row.orderIndex,
    ncertChapterNo: row.ncertChapterNo,
    domain: row.domain,
    questionCount: questionCountById.get(row.id) ?? 0,
    topicCount: topicCountById.get(row.id) ?? 0,
  }));
}

/**
 * Domains present, in first-appearance order.
 *
 * Empty when the subject does not group its chapters — which is Maths, and is
 * the signal for the UI to render one flat list rather than invent a section
 * called "Other". A subject either groups everything or nothing.
 */
function distinctDomains(chapters: ChapterSummary[]): string[] {
  const seen = new Set<string>();
  for (const chapter of chapters) {
    if (chapter.domain !== null) seen.add(chapter.domain);
  }
  return [...seen];
}

/**
 * Tally into the full enum, zeros included.
 *
 * `groupBy` omits empty buckets, and a difficulty filter that silently offers
 * only the values that happen to exist is a filter that changes shape as content
 * is added. Rendering "Hard · 0" is more useful than rendering nothing: it tells
 * a student the category exists and is empty.
 */
function toCounts(
  byType: { type: string; count: number }[],
  byDifficulty: { difficulty: string; count: number }[],
): QuestionCounts {
  const typeCounts = new Map(byType.map((row) => [row.type, row.count]));
  const difficultyCounts = new Map(byDifficulty.map((row) => [row.difficulty, row.count]));

  return {
    total: byType.reduce((sum, row) => sum + row.count, 0),
    byType: questionTypeSchema.options.map((type) => ({
      type,
      count: typeCounts.get(type) ?? 0,
    })),
    byDifficulty: difficultySchema.options.map((difficulty) => ({
      difficulty,
      count: difficultyCounts.get(difficulty) ?? 0,
    })),
  };
}

export function toSubjectSummary(row: EnrollableSubjectRow): SubjectSummary {
  return {
    id: row.id,
    board: row.board,
    code: row.code,
    name: row.name,
    slug: row.slug,
    variant: row.variant,
    classLevel: row.classLevel,
    theoryMarks: row.theoryMarks,
  };
}
