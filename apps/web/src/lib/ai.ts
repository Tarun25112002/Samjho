import {
  aiConversationDetailSchema,
  aiConversationSchema,
  aiStatusSchema,
  paginatedSchema,
  type AIConversation,
  type AIConversationDetail,
  type AIStatus,
  type Paginated,
} from "@medhavi/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * Server-side reads for the AI tutor.
 *
 * `no-store` throughout, for the obvious reason — a cached quota is a wrong
 * quota the moment the student asks anything, and a conversation is one
 * student's own mutable state.
 *
 * The status is read on `/profile` and on the tutor page because docs/05 §5.1
 * asks for it: a limit you can see coming feels fair, and the same limit
 * arriving unannounced at message thirty-one feels punitive. The difference is
 * entirely whether it was on screen beforehand.
 */
export const loadTutorStatus = cache(async function loadTutorStatus(): Promise<AIStatus> {
  return apiFetchAuthed("/api/v1/ai/status", aiStatusSchema, { cache: "no-store" });
});

export async function loadConversations(limit = 30): Promise<Paginated<AIConversation>> {
  return apiFetchAuthed(
    `/api/v1/ai/conversations?limit=${String(limit)}`,
    paginatedSchema(aiConversationSchema),
    { cache: "no-store" },
  );
}

export const loadConversation = cache(async function loadConversation(
  id: string,
): Promise<AIConversationDetail> {
  return apiFetchAuthed(
    `/api/v1/ai/conversations/${encodeURIComponent(id)}`,
    aiConversationDetailSchema,
    { cache: "no-store" },
  );
});
