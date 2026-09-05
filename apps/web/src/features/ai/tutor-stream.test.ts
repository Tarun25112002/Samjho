import { describe, expect, it, vi, afterEach } from "vitest";

import { streamTutorReply, TutorStreamError } from "./tutor-stream";

/**
 * The frame parser, against the bytes the API actually sends.
 *
 * This is the one piece of the tutor with no compiler and no server test behind
 * it: a mistake here does not throw, it renders `undefined` into the middle of
 * a student's explanation. So the cases below are the ones that occur in the
 * wild — a frame split across two network chunks, a multi-byte character split
 * across two network chunks, and a keepalive comment — rather than a tour of
 * the SSE grammar.
 */

const encoder = new TextEncoder();

/** A response whose body arrives in exactly these chunks, in this order. */
function respondWith(chunks: (string | Uint8Array)[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(typeof chunk === "string" ? encoder.encode(chunk) : chunk);
      }
      controller.close();
    },
  });

  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
    ...init,
  });
}

function stubFetch(response: Response | (() => Promise<never>)): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(typeof response === "function" ? response : () => Promise.resolve(response)),
  );
}

async function collect(signal = new AbortController().signal) {
  const events = [];
  for await (const event of streamTutorReply("conv-1", { action: "HINT" }, signal)) {
    events.push(event);
  }
  return events;
}

const DONE_FRAME = JSON.stringify({
  type: "done",
  message: {
    id: "m1",
    role: "ASSISTANT",
    action: "HINT",
    content: "Consider the mole ratio.",
    model: "openrouter:fake",
    createdAt: "2026-09-05T00:00:00.000Z",
  },
  degraded: false,
  quota: {
    messagesUsed: 1,
    messagesLimit: 30,
    messagesRemaining: 29,
    resetsAt: "2026-09-06T00:00:00.000Z",
  },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("streamTutorReply", () => {
  it("yields meta, deltas and done in order", async () => {
    stubFetch(
      respondWith([
        `event: meta\ndata: {"type":"meta","conversationId":"conv-1","degraded":false}\n\n`,
        `event: delta\ndata: {"type":"delta","text":"Consider "}\n\n`,
        `event: delta\ndata: {"type":"delta","text":"the mole ratio."}\n\n`,
        `event: done\ndata: ${DONE_FRAME}\n\n`,
      ]),
    );

    const events = await collect();

    expect(events.map((event) => event.type)).toEqual(["meta", "delta", "delta", "done"]);
    expect(
      events
        .filter((event) => event.type === "delta")
        .map((event) => event.text)
        .join(""),
    ).toBe("Consider the mole ratio.");
  });

  it("reassembles a frame split across network chunks", async () => {
    // TCP does not respect frame boundaries, and a delta arriving in halves is
    // the ordinary case on a mobile connection rather than an edge case.
    stubFetch(respondWith([`event: delta\ndata: {"type":"delta","te`, `xt":"half and half"}\n\n`]));

    const events = await collect();

    expect(events).toEqual([{ type: "delta", text: "half and half" }]);
  });

  it("reassembles a multi-byte character split across chunks", async () => {
    // Decoding each chunk independently turns a Devanagari character straddling
    // a boundary into two replacement characters. This product streams Hindi.
    const payload = encoder.encode(`data: {"type":"delta","text":"नमस्ते"}\n\n`);

    stubFetch(respondWith([payload.slice(0, 30), payload.slice(30)]));

    const events = await collect();

    expect(events).toEqual([{ type: "delta", text: "नमस्ते" }]);
  });

  it("ignores keepalive comments and unparseable frames", async () => {
    stubFetch(
      respondWith([
        `: keepalive\n\n`,
        `event: delta\ndata: not json\n\n`,
        `event: delta\ndata: {"type":"delta","text":"kept"}\n\n`,
      ]),
    );

    // A dropped delta costs one fragment of an answer; aborting the turn over a
    // comment line costs the whole thing.
    expect(await collect()).toEqual([{ type: "delta", text: "kept" }]);
  });

  it("drops a frame whose shape does not match the contract", async () => {
    stubFetch(
      respondWith([
        `event: delta\ndata: {"type":"delta","text":42}\n\n`,
        `event: delta\ndata: {"type":"delta","text":"ok"}\n\n`,
      ]),
    );

    expect(await collect()).toEqual([{ type: "delta", text: "ok" }]);
  });

  it("throws the API's own failure when the turn is refused before headers", async () => {
    // A live exam or an unearned action. Nothing has been shown, so this is an
    // ordinary JSON 4xx and must reach the student as one.
    stubFetch(
      new Response(
        JSON.stringify({
          error: {
            code: "FORBIDDEN",
            message: "The AI tutor is unavailable while an exam is in progress",
            requestId: "req-1",
          },
        }),
        { status: 403, headers: { "content-type": "application/json" } },
      ),
    );

    const error = await collect().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TutorStreamError);
    expect((error as TutorStreamError).failure.message).toBe(
      "The AI tutor is unavailable while an exam is in progress",
    );
    expect((error as TutorStreamError).failure.requestId).toBe("req-1");
  });

  it("reports an unreachable server as a connection problem", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));

    await expect(collect()).rejects.toThrow(/Could not reach the tutor/);
  });

  it("stays silent when the student navigates away mid-request", async () => {
    const controller = new AbortController();
    controller.abort();

    stubFetch(() => Promise.reject(new DOMException("Aborted", "AbortError")));

    // Not a failure worth showing: nobody asked for an answer any more.
    expect(await collect(controller.signal)).toEqual([]);
  });
});
