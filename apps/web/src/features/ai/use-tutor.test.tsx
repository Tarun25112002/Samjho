import type { AIStreamEvent } from "@samjho/contracts";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTutor, type TutorInput } from "./use-tutor";

/**
 * The hook that turns a stream of deltas into something a student can read.
 *
 * Both collaborators are mocked, deliberately: `tutor-stream.ts` has its own
 * suite against real SSE bytes, and re-testing it here would only prove the
 * mock works. What is under test is the state machine on top of it — that the
 * conversation is created once and not per turn, that deltas accumulate into
 * one bubble rather than several, and that a new question forgets the old one.
 */

const sendJson = vi.hoisted(() => vi.fn());
const streamTutorReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/client-api", () => ({ sendJson }));
vi.mock("./tutor-stream", () => ({
  streamTutorReply,
  TutorStreamError: class extends Error {},
}));

const CONVERSATION = {
  ok: true,
  data: { id: "conv-1", messages: [], availableActions: [] },
};

function frames(...events: AIStreamEvent[]) {
  return () =>
    (async function* () {
      for (const event of events) yield event;
    })();
}

function doneFrame(content: string, degraded = false): AIStreamEvent {
  return {
    type: "done",
    message: {
      id: "m1",
      role: "ASSISTANT",
      action: "HINT",
      content,
      model: degraded ? null : "openrouter:fake",
      createdAt: "2026-09-05T00:00:00.000Z",
    },
    degraded,
    quota: {
      messagesUsed: 1,
      messagesLimit: 30,
      messagesRemaining: 29,
      resetsAt: "2026-09-06T00:00:00.000Z",
    },
  };
}

const INPUT: TutorInput = {
  questionId: "q-1",
  answered: false,
  answeredWrong: false,
};

beforeEach(() => {
  sendJson.mockReset();
  streamTutorReply.mockReset();
  sendJson.mockResolvedValue(CONVERSATION);
});

describe("useTutor", () => {
  it("offers the ladder without WHY_WRONG or SIMPLER before anything has happened", () => {
    const { result } = renderHook(() => useTutor(INPUT));

    // Nothing to diagnose and nothing to simplify. The server enforces both;
    // these chips just do not invite a request that would be refused.
    expect(result.current.actions).toEqual(["HINT", "EXPLAIN", "STEP_BY_STEP", "SIMILAR"]);
  });

  it("offers WHY_WRONG once an attempt was marked wrong", () => {
    const { result } = renderHook(() =>
      useTutor({ ...INPUT, answered: true, answeredWrong: true }),
    );

    expect(result.current.actions).toContain("WHY_WRONG");
  });

  it("creates the conversation on the first question and reuses it after", async () => {
    streamTutorReply.mockImplementation(frames(doneFrame("A hint.")));

    const { result } = renderHook(() => useTutor(INPUT));

    await act(async () => {
      await result.current.ask("HINT");
    });
    await act(async () => {
      await result.current.ask("EXPLAIN");
    });

    // Opening the panel costs nothing and a second question costs no extra row.
    expect(sendJson).toHaveBeenCalledTimes(1);
    expect(streamTutorReply).toHaveBeenCalledTimes(2);
  });

  it("accumulates deltas into one reply and closes it on done", async () => {
    streamTutorReply.mockImplementation(
      frames(
        { type: "meta", conversationId: "conv-1", degraded: false },
        { type: "delta", text: "Consider " },
        { type: "delta", text: "the mole ratio." },
        doneFrame("Consider the mole ratio."),
      ),
    );

    const { result } = renderHook(() => useTutor(INPUT));

    await act(async () => {
      await result.current.ask("HINT");
    });

    expect(result.current.turns).toHaveLength(2);
    expect(result.current.turns[0]).toMatchObject({ role: "USER", content: "Give me a hint" });
    expect(result.current.turns[1]).toMatchObject({
      role: "ASSISTANT",
      content: "Consider the mole ratio.",
      degraded: false,
    });
    // The caret stops once the answer is complete.
    expect(result.current.turns[1]?.streaming).toBeUndefined();
    expect(result.current.quota?.messagesRemaining).toBe(29);
  });

  it("marks a degraded reply so the panel can say where it came from", async () => {
    streamTutorReply.mockImplementation(
      frames(
        { type: "meta", conversationId: "conv-1", degraded: true },
        { type: "delta", text: "The official solution." },
        doneFrame("The official solution.", true),
      ),
    );

    const { result } = renderHook(() => useTutor(INPUT));

    await act(async () => {
      await result.current.ask("EXPLAIN");
    });

    expect(result.current.turns[1]).toMatchObject({ degraded: true });
  });

  it("keeps the text that arrived when the stream fails partway", async () => {
    streamTutorReply.mockImplementation(
      frames(
        { type: "delta", text: "The first half" },
        { type: "error", code: "AI_UNAVAILABLE", message: "The tutor's reply was cut short." },
      ),
    );

    const { result } = renderHook(() => useTutor(INPUT));

    await act(async () => {
      await result.current.ask("STEP_BY_STEP");
    });

    // A partial explanation is still worth reading, so the error is shown
    // alongside it rather than instead of it.
    expect(result.current.turns[1]?.content).toBe("The first half");
    expect(result.current.failure?.message).toBe("The tutor's reply was cut short.");
  });

  it("surfaces a refused conversation and asks nothing further", async () => {
    sendJson.mockResolvedValue({
      ok: false,
      failure: {
        message: "The AI tutor is unavailable while an exam is in progress",
        fieldErrors: {},
      },
    });

    const { result } = renderHook(() => useTutor(INPUT));

    await act(async () => {
      await result.current.ask("HINT");
    });

    expect(streamTutorReply).not.toHaveBeenCalled();
    expect(result.current.failure?.message).toMatch(/exam is in progress/);
    expect(result.current.turns).toEqual([]);
  });

  it("forgets the conversation when the student moves to another question", async () => {
    streamTutorReply.mockImplementation(frames(doneFrame("A hint.")));

    const { result, rerender } = renderHook((input: TutorInput) => useTutor(input), {
      initialProps: INPUT,
    });

    await act(async () => {
      await result.current.ask("HINT");
    });
    expect(result.current.turns).toHaveLength(2);

    rerender({ ...INPUT, questionId: "q-2" });

    // A different question is a different conversation — carrying the transcript
    // over would ground the next turn in the wrong question's history.
    await waitFor(() => {
      expect(result.current.turns).toEqual([]);
    });

    await act(async () => {
      await result.current.ask("HINT");
    });
    expect(sendJson).toHaveBeenCalledTimes(2);
  });
});
