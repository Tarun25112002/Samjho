import { aiStreamEventSchema, type AIStreamEvent, type SendMessageInput } from "@samjho/contracts";

import { toFailure, type ApiFailure } from "@/lib/client-api";

/**
 * The browser half of the tutor's SSE stream.
 *
 * ## Why `fetch` and not `EventSource`
 *
 * `EventSource` only issues GETs and cannot set a header. Sending an action as
 * a query parameter is survivable; sending credentials in a URL is not — URLs
 * end up in access logs, in `Referer`, and in the browser's history. The API
 * therefore streams from a POST, which obliges this side to read the body by
 * hand. That is the trade, and it is the right way round.
 *
 * ## The failure that has to be handled twice
 *
 * A tutor turn can fail in two places that need different treatment, and the
 * boundary is the response headers. Before them, nothing has been shown: a live
 * exam or an unearned action arrives as an ordinary JSON 4xx and is thrown as
 * an `ApiFailure`, exactly like every other call in this app. After them the
 * status line is spent, so a failure can only arrive as an `error` frame inside
 * a 200 — which the caller renders next to whatever text already landed rather
 * than instead of it.
 */

export class TutorStreamError extends Error {
  constructor(readonly failure: ApiFailure) {
    super(failure.message);
    this.name = "TutorStreamError";
  }
}

const NETWORK_FAILURE: ApiFailure = {
  message: "Could not reach the tutor. Check your connection and try again.",
  fieldErrors: {},
};

/**
 * Send one turn and yield its frames.
 *
 * The whole exchange goes through the BFF at `/api/v1/*` like every other call,
 * so there is no token in this file and no base URL to configure.
 */
export async function* streamTutorReply(
  conversationId: string,
  input: SendMessageInput,
  signal: AbortSignal,
): AsyncGenerator<AIStreamEvent> {
  const path = `/api/v1/ai/conversations/${encodeURIComponent(conversationId)}/messages/stream`;

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
  } catch {
    // An abort is the student navigating away or asking something else, which
    // is not a failure worth reporting to them.
    if (signal.aborted) return;
    throw new TutorStreamError(NETWORK_FAILURE);
  }

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    throw new TutorStreamError(toFailure(payload, response.status));
  }

  if (!response.body) throw new TutorStreamError(NETWORK_FAILURE);

  yield* readEvents(response.body, signal);
}

/**
 * Minimal SSE parsing: enough for the frames this API sends, and no more.
 *
 * Retry directives, last-event-id and reconnection are all `EventSource`
 * features that do not apply here — a tutor turn is one request that either
 * completes or does not, and silently re-sending it would bill a second one.
 *
 * The decoder is kept across chunks (`stream: true`) because a Devanagari
 * character can straddle a chunk boundary; decoding each chunk independently
 * turns it into two replacement characters, and this product streams Hindi.
 */
async function* readEvents(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncGenerator<AIStreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Frames are separated by a blank line. Anything after the last one is a
      // partial frame and stays in the buffer until the rest of it arrives.
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const event = parseFrame(frame);
        if (event) yield event;

        boundary = buffer.indexOf("\n\n");
      }
    }
  } finally {
    // Releases the connection when the caller stops reading — a student who
    // navigates away mid-answer should stop the upstream request, not leave it
    // running and billing.
    if (!signal.aborted) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/**
 * One frame to one event, or nothing.
 *
 * A frame that does not parse is dropped rather than thrown on. The stream is
 * append-only text on a student's screen: losing one delta degrades the answer,
 * while aborting the whole turn over an unrecognised comment line loses all of
 * it. Comment lines (`:` prefix) are exactly what a keepalive looks like.
 */
function parseFrame(frame: string): AIStreamEvent | null {
  const data = frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n");

  if (!data) return null;

  try {
    const parsed = aiStreamEventSchema.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
