/**
 * A server-sent-events reader for provider response bodies.
 *
 * All three providers stream SSE, so this is written once against the actual
 * grammar rather than three times against whatever each vendor's examples
 * happened to show. Two details in the spec are load-bearing here and are the
 * usual source of "it works until it doesn't":
 *
 *  1. **Comment lines.** A line beginning `:` is a comment and must be
 *     discarded. OpenRouter sends `: OPENROUTER PROCESSING` as a keepalive
 *     while a slow upstream warms up. A parser that assumes every non-empty
 *     line is data will try to `JSON.parse` that and fail the request for no
 *     reason — specifically on the slow calls that most needed the keepalive.
 *
 *  2. **Events end at a blank line, not at a newline.** A single event may
 *     carry several `data:` lines, which concatenate with newlines between
 *     them. Today's providers emit one line per event, so splitting on `\n`
 *     would appear to work — right up to the first response containing a raw
 *     newline, which for a maths tutor emitting LaTeX is not hypothetical.
 *
 * Decoding uses a streaming TextDecoder because a multi-byte character —
 * Devanagari, or the `−` in a formula — can and does land across a chunk
 * boundary. Decoding each chunk independently corrupts it.
 */
export interface SSEEvent {
  /** The `event:` field, if the provider sends one. */
  event?: string;
  /** Joined `data:` lines, with the single leading space stripped per line. */
  data: string;
}

export async function* readSSE(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let dataLines: string[] = [];
  let eventName: string | undefined;

  const flush = (): SSEEvent | null => {
    if (dataLines.length === 0) {
      eventName = undefined;
      return null;
    }
    const event: SSEEvent = { data: dataLines.join("\n") };
    if (eventName !== undefined) event.event = eventName;
    dataLines = [];
    eventName = undefined;
    return event;
  };

  try {
    for (;;) {
      if (signal?.aborted) throw signal.reason ?? new DOMException("Aborted", "AbortError");

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        // Strip the CR of a CRLF pair. Some proxies rewrite line endings.
        const line = buffer.slice(0, newline).replace(/\r$/, "");
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");

        if (line === "") {
          const event = flush();
          if (event) yield event;
          continue;
        }

        if (line.startsWith(":")) continue; // comment / keepalive

        const colon = line.indexOf(":");
        const field = colon === -1 ? line : line.slice(0, colon);
        // Exactly one leading space after the colon is part of the framing, not
        // the value. Any further spaces are the payload's own.
        const raw = colon === -1 ? "" : line.slice(colon + 1);
        const fieldValue = raw.startsWith(" ") ? raw.slice(1) : raw;

        if (field === "data") dataLines.push(fieldValue);
        else if (field === "event") eventName = fieldValue;
        // id / retry are not used by any provider here.
      }
    }

    // A stream that ends without a trailing blank line still owes us its last
    // event. Providers that terminate with `data: [DONE]\n\n` never hit this;
    // ones that just close the socket do.
    buffer += decoder.decode();
    if (buffer.trim().length > 0) {
      const line = buffer.replace(/\r$/, "");
      if (line.startsWith("data:")) {
        const raw = line.slice(5);
        dataLines.push(raw.startsWith(" ") ? raw.slice(1) : raw);
      }
    }
    const trailing = flush();
    if (trailing) yield trailing;
  } finally {
    // Releasing the lock is not enough — the socket stays open and the provider
    // keeps generating (and charging) until it is actively cancelled. This is
    // the line that makes a client disconnect stop costing money.
    await reader.cancel().catch(() => undefined);
  }
}

/**
 * `JSON.parse` that returns null instead of throwing.
 *
 * A single unparseable event should not kill a response that is otherwise
 * streaming fine — providers occasionally interleave framing events that are
 * not JSON at all. Callers skip nulls.
 */
export function parseEventData(data: string): unknown {
  try {
    return JSON.parse(data) as unknown;
  } catch {
    return null;
  }
}
