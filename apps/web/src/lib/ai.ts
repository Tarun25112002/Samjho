import { aiStatusSchema, type AIStatus } from "@samjho/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for the AI tutor.
 *
 * Only one, and only because docs/05 §5.1 asks for it: the remaining allowance
 * is shown on `/profile`, where a student can see a limit coming. A limit you
 * can plan around feels fair; the same limit arriving unannounced at message
 * thirty-one feels punitive, and the difference is entirely this page.
 *
 * `no-store` for the obvious reason — a cached quota is a wrong quota the
 * moment the student asks anything.
 */
export const loadTutorStatus = cache(async function loadTutorStatus(): Promise<AIStatus> {
  return apiFetchAuthed("/api/v1/ai/status", aiStatusSchema, { cache: "no-store" });
});
