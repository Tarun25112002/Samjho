import {
  adminChapterListResponseSchema,
  adminContentStatsSchema,
  adminQuestionSchema,
  adminQuestionSummarySchema,
  adminSubjectListResponseSchema,
  paginatedSchema,
  questionRevisionSchema,
  type AdminChapter,
  type AdminContentStats,
  type AdminListQuestionsQuery,
  type AdminQuestion,
  type AdminQuestionSummary,
  type AdminSubject,
  type Paginated,
  type QuestionRevision,
} from "@samjho/contracts";
import { cache } from "react";
import { z } from "zod";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for the admin area.
 *
 * All `no-store`, without exception. An editor's list is a work queue: they
 * publish a question and immediately want to see it move out of "drafts". A
 * cached list that is thirty seconds stale reads as a bug that ate their work,
 * and they will save it again — which is precisely the behaviour the version
 * hash is there to make harmless, but not the behaviour anyone wants.
 */

export const loadContentStats = cache(
  async function loadContentStats(): Promise<AdminContentStats> {
    return apiFetchAuthed("/api/v1/admin/dashboard/content", adminContentStatsSchema, {
      cache: "no-store",
    });
  },
);

export const loadAdminSubjects = cache(async function loadAdminSubjects(): Promise<AdminSubject[]> {
  const response = await apiFetchAuthed(
    "/api/v1/admin/catalog/subjects",
    adminSubjectListResponseSchema,
    { cache: "no-store" },
  );

  return response.subjects;
});

export const loadAdminChapters = cache(async function loadAdminChapters(
  subjectId: string,
): Promise<AdminChapter[]> {
  const response = await apiFetchAuthed(
    `/api/v1/admin/catalog/subjects/${encodeURIComponent(subjectId)}/chapters`,
    adminChapterListResponseSchema,
    { cache: "no-store" },
  );

  return response.chapters;
});

export async function loadAdminQuestions(
  filters: Partial<AdminListQuestionsQuery>,
): Promise<Paginated<AdminQuestionSummary>> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  return apiFetchAuthed(
    `/api/v1/admin/questions?${params.toString()}`,
    paginatedSchema(adminQuestionSummarySchema),
    { cache: "no-store" },
  );
}

export async function loadAdminQuestion(id: string): Promise<AdminQuestion> {
  return apiFetchAuthed(`/api/v1/admin/questions/${encodeURIComponent(id)}`, adminQuestionSchema, {
    cache: "no-store",
  });
}

const revisionsResponseSchema = z.object({ revisions: z.array(questionRevisionSchema) });

export async function loadQuestionRevisions(id: string): Promise<QuestionRevision[]> {
  const response = await apiFetchAuthed(
    `/api/v1/admin/questions/${encodeURIComponent(id)}/revisions`,
    revisionsResponseSchema,
    { cache: "no-store" },
  );

  return response.revisions;
}
