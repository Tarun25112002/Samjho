import {
  paginatedSchema,
  practiceResultSchema,
  practiceSessionSchema,
  practiceSessionSummarySchema,
  type ListPracticeSessionsQuery,
  type Paginated,
  type PracticeResult,
  type PracticeSession,
  type PracticeSessionSummary,
} from "@samjho/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for practice.
 *
 * `no-store` throughout, and here that is not even a judgement call: a practice
 * session is a single student's mutable state, and the one thing worse than a
 * stale chapter count is a stale answer sheet.
 */

export const loadSession = cache(async function loadSession(
  sessionId: string,
): Promise<PracticeSession> {
  return apiFetchAuthed(
    `/api/v1/practice-sessions/${encodeURIComponent(sessionId)}`,
    practiceSessionSchema,
    { cache: "no-store" },
  );
});

export const loadResult = cache(async function loadResult(
  sessionId: string,
): Promise<PracticeResult> {
  return apiFetchAuthed(
    `/api/v1/practice-sessions/${encodeURIComponent(sessionId)}/result`,
    practiceResultSchema,
    { cache: "no-store" },
  );
});

export async function loadSessions(
  query: Partial<ListPracticeSessionsQuery> = {},
): Promise<Paginated<PracticeSessionSummary>> {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  if (query.limit !== undefined) params.set("limit", String(query.limit));

  return apiFetchAuthed(
    `/api/v1/practice-sessions?${params.toString()}`,
    paginatedSchema(practiceSessionSummarySchema),
    { cache: "no-store" },
  );
}
