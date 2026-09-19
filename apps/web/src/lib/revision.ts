import { revisionQueueSchema, type RevisionQueue } from "@medhavi/contracts";
import { cache } from "react";

import { apiFetchAuthed } from "./api-client";

/**
 * The revision queue, read on the server.
 *
 * `cache: "no-store"`, and this one earns it more than most: the queue is a
 * countdown of work the student is clearing, so a cached copy shows a number
 * they have already brought down. React's `cache` still dedupes it within a
 * single render, which is what lets both the home dashboard's tile and the page
 * body ask for it without two round trips.
 */
export const loadRevisionQueue = cache(async function loadRevisionQueue(): Promise<RevisionQueue> {
  return apiFetchAuthed("/api/v1/revision", revisionQueueSchema, { cache: "no-store" });
});
