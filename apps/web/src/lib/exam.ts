import {
  examAttemptSchema,
  examAttemptSummarySchema,
  examPaperStructureSchema,
  examResultSchema,
  paginatedSchema,
  type ExamAttempt,
  type ExamAttemptSummary,
  type ExamPaperStructure,
  type ExamResult,
  type ListExamPapersQuery,
  type Paginated,
} from "@samjho/contracts";
import { z } from "zod";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for the exam space.
 *
 * `no-store` without exception. A cached exam attempt is a cached answer sheet,
 * and a cached deadline is the one thing in this product that must never be a
 * moment old — the runner rehydrates from this on every reload, including the
 * reload a student does at two hours and fifty minutes.
 */

export async function loadExamPapers(
  query: Partial<ListExamPapersQuery> = {},
): Promise<Paginated<ExamPaperStructure>> {
  const params = new URLSearchParams();
  if (query.subjectId) params.set("subjectId", query.subjectId);
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  return apiFetchAuthed(
    `/api/v1/exam-papers?${params.toString()}`,
    paginatedSchema(examPaperStructureSchema),
    { cache: "no-store" },
  );
}

export const loadExamPaper = cache(async function loadExamPaper(
  id: string,
): Promise<ExamPaperStructure> {
  return apiFetchAuthed(`/api/v1/exam-papers/${encodeURIComponent(id)}`, examPaperStructureSchema, {
    cache: "no-store",
  });
});

export const loadExamAttempt = cache(async function loadExamAttempt(
  id: string,
): Promise<ExamAttempt> {
  return apiFetchAuthed(`/api/v1/exam-attempts/${encodeURIComponent(id)}`, examAttemptSchema, {
    cache: "no-store",
  });
});

export const loadExamResult = cache(async function loadExamResult(id: string): Promise<ExamResult> {
  return apiFetchAuthed(
    `/api/v1/exam-attempts/${encodeURIComponent(id)}/result`,
    examResultSchema,
    { cache: "no-store" },
  );
});

export async function loadExamAttempts(limit = 20): Promise<ExamAttemptSummary[]> {
  return apiFetchAuthed(
    `/api/v1/exam-attempts?limit=${String(limit)}`,
    z.array(examAttemptSummarySchema),
    { cache: "no-store" },
  );
}
