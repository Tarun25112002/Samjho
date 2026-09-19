"use client";

import {
  recordEventsResultSchema,
  type ClientEventType,
  type LearningEventProps,
} from "@samjho/contracts";

/**
 * Reporting what a student did, without ever getting in their way.
 *
 * ## Batched, because the alternative is a request per question
 *
 * A runner emits a `QUESTION_VIEWED` every time the student moves. Sending each
 * one immediately would put a round trip between a tap and the next question on
 * a connection that is often a school's wifi. So events accumulate and go out
 * together, on a short timer and on the way out of the page.
 *
 * ## Nothing here can fail the page
 *
 * Every send is fire-and-forget and every error is swallowed. There is no retry
 * queue and no local storage: an event that did not arrive is one data point,
 * and the machinery to guarantee it would cost more than the data is worth.
 *
 * ## What is deliberately absent
 *
 * No identifiers of any kind. No timestamps from the device — the server stamps
 * `occurredAt`, because a phone's clock is not a fact. No page URL, no referrer,
 * no user agent. Every user of this product is a minor (docs/07 R6) and the
 * commitment in docs/06 is zero behavioural tracking, so the absence of those
 * fields is the feature.
 */

interface QueuedEvent {
  type: ClientEventType;
  sessionId?: string;
  questionId?: string;
  props: LearningEventProps;
}

const FLUSH_DELAY_MS = 4000;
const MAX_BATCH = 20;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listening = false;

export function trackEvent(event: QueuedEvent): void {
  if (typeof window === "undefined") return;

  queue.push(event);
  listenForExit();

  if (queue.length >= MAX_BATCH) {
    void flushEvents();
    return;
  }

  timer ??= setTimeout(() => {
    void flushEvents();
  }, FLUSH_DELAY_MS);
}

export async function flushEvents(): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  const events = queue.slice(0, MAX_BATCH);
  if (events.length === 0) return;
  queue = queue.slice(events.length);

  try {
    const response = await fetch("/api/v1/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ events }),
      // So a flush started as the tab closes is not cancelled by the navigation.
      keepalive: true,
    });

    const payload: unknown = await response.json().catch(() => null);
    recordEventsResultSchema.safeParse((payload as { data?: unknown } | null)?.data);
  } catch {
    // Offline, or the tab went away mid-flight. Both are ordinary, and neither
    // is worth telling a student about.
  }
}

/**
 * Flush on the way out.
 *
 * `visibilitychange` rather than `beforeunload`: mobile Safari and Chrome on
 * Android frequently never fire the latter, and a student closing the tab is
 * exactly the moment the last few events are worth having.
 */
function listenForExit(): void {
  if (listening) return;
  listening = true;

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushEvents();
  });
}
