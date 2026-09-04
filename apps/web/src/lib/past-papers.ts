import {
  pastPaperCoverageSchema,
  pastPaperYearOptionSchema,
  type PastPaperCoverage,
  type PastPaperYearOption,
} from "@samjho/contracts";
import { cache } from "react";
import { z } from "zod";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for previous-year papers.
 *
 * Two audiences, two functions, and they deliberately do not share a call.
 *
 * The **coverage grid** is an editor's backlog — every sitting from 2001 to
 * 2026, including the ones we hold nothing from, because a registry whose first
 * job is naming the missing work has to show the missing work. It is
 * `no-store`, like the rest of the admin area: an editor who has just ingested a
 * paper wants to see the number move.
 *
 * The **year options** are what a student filters by, and they contain only
 * years with published questions behind them. A chip that produces an empty set
 * reads as a broken feature rather than as a thin year, which is why the API
 * does that filtering rather than this file.
 */

const yearsResponseSchema = z.object({ years: z.array(pastPaperYearOptionSchema) });

export const loadPastPaperCoverage = cache(async function loadPastPaperCoverage(
  subjectId: string,
): Promise<PastPaperCoverage> {
  return apiFetchAuthed(
    `/api/v1/admin/past-papers/coverage?subjectId=${encodeURIComponent(subjectId)}`,
    pastPaperCoverageSchema,
    { cache: "no-store" },
  );
});

/**
 * The years a student may practise, for one subject.
 *
 * Returns `[]` rather than throwing when the call fails. This feeds a row of
 * optional chips on the practice setup form; a subject whose years cannot be
 * loaded should cost the student that row, not the page they were about to
 * build a set on.
 */
export const loadPastPaperYears = cache(async function loadPastPaperYears(
  subjectId: string,
): Promise<PastPaperYearOption[]> {
  try {
    const response = await apiFetchAuthed(
      `/api/v1/past-papers/years?subjectId=${encodeURIComponent(subjectId)}`,
      yearsResponseSchema,
      { cache: "no-store" },
    );

    return response.years;
  } catch {
    return [];
  }
});
