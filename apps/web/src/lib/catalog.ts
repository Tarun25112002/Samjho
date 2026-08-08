import {
  chapterDetailSchema,
  paginatedSchema,
  studentQuestionSchema,
  subjectDetailSchema,
  type ChapterDetail,
  type ListQuestionsQuery,
  type Paginated,
  type StudentQuestion,
  type SubjectDetail,
} from "@samjho/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side catalog reads.
 *
 * Wrapped in React's `cache()` for the same reason `loadMe` is: a page and its
 * layout frequently want the same subject, and Next's own fetch deduplication
 * does not apply once `cache: "no-store"` is set.
 *
 * Everything here is `no-store`. Catalog data changes rarely, so caching it is
 * tempting — but question *counts* move every time an editor publishes, and a
 * chapter that says "0 questions" for ten minutes after content lands is a
 * support ticket. Real caching belongs in Phase 9, with tag-based invalidation
 * driven by the publish action rather than a guessed TTL.
 */

export const loadSubject = cache(async function loadSubject(
  idOrSlug: string,
): Promise<SubjectDetail> {
  return apiFetchAuthed(
    `/api/v1/catalog/subjects/${encodeURIComponent(idOrSlug)}`,
    subjectDetailSchema,
    { cache: "no-store" },
  );
});

export const loadChapter = cache(async function loadChapter(
  idOrSlug: string,
): Promise<ChapterDetail> {
  return apiFetchAuthed(
    `/api/v1/catalog/chapters/${encodeURIComponent(idOrSlug)}`,
    chapterDetailSchema,
    { cache: "no-store" },
  );
});

export async function loadQuestions(
  filters: Partial<ListQuestionsQuery>,
): Promise<Paginated<StudentQuestion>> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    // Arrays go over as a comma-separated list; the contract accepts both that
    // and repeated parameters, and one parameter reads better in a URL bar.
    params.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }

  return apiFetchAuthed(
    `/api/v1/questions?${params.toString()}`,
    paginatedSchema(studentQuestionSchema),
    { cache: "no-store" },
  );
}

/**
 * Group chapters into their domains, preserving order.
 *
 * Returns a single unnamed group when the subject has no domains, which is
 * Maths. The alternative — inventing a group called "Other" — would give Maths
 * a heading it does not have and that no student would recognise.
 */
export function groupChaptersByDomain<T extends { domain: string | null }>(
  chapters: T[],
  domains: string[],
): { domain: string | null; chapters: T[] }[] {
  if (domains.length === 0) return [{ domain: null, chapters }];

  return domains.map((domain) => ({
    domain,
    chapters: chapters.filter((chapter) => chapter.domain === domain),
  }));
}
