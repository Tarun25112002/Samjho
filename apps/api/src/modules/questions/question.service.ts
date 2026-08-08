import type {
  ListQuestionsQuery,
  Paginated,
  StudentQuestion,
  StudentSubPart,
} from "@samjho/contracts";

import { NotFoundError } from "../../lib/errors.js";
import { questionRepository, type StudentQuestionRow } from "./question.repository.js";

/**
 * Question business logic.
 *
 * `toStudentQuestion` is the *only* serializer in this file, and it is named for
 * its audience rather than for its shape. Phase 4 adds `toAdminQuestion` beside
 * it as a genuinely separate function.
 *
 * Not `toQuestion(row, { includeAnswer })`. A boolean parameter gets passed
 * wrong exactly once, in one call site, and the resulting bug is invisible in
 * review — the response still validates, still renders, and merely contains the
 * answer to a question the student is about to attempt. Two functions cannot be
 * confused at a call site the way `true` and `false` can.
 */

export const questionService = {
  async list(query: ListQuestionsQuery): Promise<Paginated<StudentQuestion>> {
    const { rows, hasMore } = await questionRepository.list(query);
    const items = rows.map(toStudentQuestion);

    return {
      items,
      pageInfo: {
        hasMore,
        // The cursor is the last id of *this* page, so it is null on the last
        // page rather than pointing at nothing.
        nextCursor: hasMore ? (items.at(-1)?.id ?? null) : null,
      },
    };
  },

  async getById(id: string): Promise<StudentQuestion> {
    const row = await questionRepository.findById(id);
    if (!row) throw new NotFoundError("Question");
    return toStudentQuestion(row);
  },
};

export function toStudentQuestion(row: StudentQuestionRow): StudentQuestion {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    marks: row.marks,
    difficulty: row.difficulty,
    bloomLevel: row.bloomLevel,
    expectedTimeSeconds: row.expectedTimeSeconds,
    version: row.version,
    options: row.options,
    assets: row.assets,
    isContainer: row.isContainer,

    chapter: row.chapter,

    topics: row.topics.map((link) => ({
      id: link.topic.id,
      name: link.topic.name,
      slug: link.topic.slug,
      isPrimary: link.isPrimary,
    })),

    subParts: row.subParts.map(toStudentSubPart),

    provenance: row.source
      ? {
          sourceType: row.source.sourceType,
          year: row.source.year,
          examSession: row.source.examSession,
          setNumber: row.source.setNumber,
          attributionText: row.source.attributionText,
        }
      : null,
  };
}

function toStudentSubPart(row: StudentQuestionRow["subParts"][number]): StudentSubPart {
  return {
    id: row.id,
    type: row.type,
    body: row.body,
    marks: row.marks,
    difficulty: row.difficulty,
    bloomLevel: row.bloomLevel,
    expectedTimeSeconds: row.expectedTimeSeconds,
    version: row.version,
    options: row.options,
    assets: row.assets,
    // Non-null in the database for anything with a parent — enforced by the
    // `questions_subpart_index_present` CHECK constraint, so this fallback is
    // unreachable rather than defensive.
    subPartIndex: row.subPartIndex ?? 0,
  };
}
