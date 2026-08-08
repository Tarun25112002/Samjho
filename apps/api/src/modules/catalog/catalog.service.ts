import type { Board, SubjectSummary } from "@samjho/contracts";

import { catalogRepository, type EnrollableSubjectRow } from "./catalog.repository.js";

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
};

export function toSubjectSummary(row: EnrollableSubjectRow): SubjectSummary {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    slug: row.slug,
    variant: row.variant,
    classLevel: row.classLevel,
    theoryMarks: row.theoryMarks,
  };
}
