"use client";

import {
  AI_ACTION_LABELS,
  aiConversationDetailSchema,
  type AIAction,
  type AIMessage,
  type AIQuota,
} from "@samjho/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { sendJson, type ApiFailure } from "@/lib/client-api";
import { streamTutorReply, TutorStreamError } from "./tutor-stream";

/**
 * The tutor panel's brain.
 *
 * ## The conversation is created on the first question, not on opening
 *
 * Opening the panel costs nothing. A student who taps it, reads the ladder and
 * decides they can manage leaves no row behind — which matters because the
 * panel sits under every question in every practice set, and a conversation
 * created on open would mean one empty row per question a student was briefly
 * unsure about.
 *
 * ## The action chips are an affordance; the server is the authority
 *
 * `offeredActions` below duplicates a rule the API also enforces (WHY_WRONG
 * needs a wrong attempt; SIMPLER needs something to simplify). That duplication
 * is deliberate and is not a security hole: the API returns 400 for an action a
 * conversation has not earned, and there is a test that says so. What this copy
 * buys is a panel that can render its buttons before any request exists, which
 * is the difference between opening instantly and opening after a round trip.
 *
 * If the two ever drift, the failure is a chip that produces a polite error —
 * not an action that should have been refused and wasn't.
 */

export interface TutorTurn {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  /** True while this turn is still arriving. */
  streaming?: boolean;
  /** True when the reply is the stored solution rather than the tutor's own. */
  degraded?: boolean;
}

export interface Tutor {
  open: boolean;
  turns: TutorTurn[];
  actions: AIAction[];
  quota: AIQuota | null;
  busy: boolean;
  failure: ApiFailure | null;

  setOpen: (open: boolean) => void;
  ask: (action: AIAction, text?: string) => Promise<void>;
  dismissFailure: () => void;
}

export interface TutorInput {
  questionId: string;
  /** The student has submitted an answer to this question. */
  answered: boolean;
  /** …and it was marked wrong. Gates WHY_WRONG. */
  answeredWrong: boolean;
  /** The attempt to diagnose, when there is one. */
  attemptId?: string | undefined;
}

const ALL: AIAction[] = ["HINT", "EXPLAIN", "WHY_WRONG", "STEP_BY_STEP", "SIMPLER", "SIMILAR"];

function offeredActions(input: TutorInput, hasReply: boolean): AIAction[] {
  return ALL.filter((action) => {
    if (action === "WHY_WRONG") return input.answeredWrong;
    if (action === "SIMPLER") return hasReply;
    return true;
  });
}

export function useTutor(input: TutorInput): Tutor {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<TutorTurn[]>([]);
  const [quota, setQuota] = useState<AIQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  /**
   * Refs rather than state for both of these.
   *
   * The conversation id is read inside `ask` and never rendered, so putting it
   * in state would re-render the panel to store a value nothing displays — and
   * worse, `ask` would close over a stale copy of it on the turn that created
   * it. The abort controller has the same shape of problem.
   */
  const conversationId = useRef<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  // A different question is a different conversation. Resetting here rather
  // than remounting the panel from the runner means the panel does not have to
  // be keyed, and the open/closed state survives navigation — which is what a
  // student who is working through a set with the tutor open would expect.
  useEffect(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    conversationId.current = null;
    setTurns([]);
    setFailure(null);
    setBusy(false);
  }, [input.questionId]);

  // Nobody is reading a half-streamed answer once the component is gone, and an
  // abandoned stream keeps the upstream provider call alive and billing.
  useEffect(() => () => inFlight.current?.abort(), []);

  const hasReply = turns.some((turn) => turn.role === "ASSISTANT");

  const ask = useCallback(
    async (action: AIAction, text?: string) => {
      if (inFlight.current) return;

      setBusy(true);
      setFailure(null);

      const controller = new AbortController();
      inFlight.current = controller;

      try {
        if (!conversationId.current) {
          const created = await sendJson(
            "POST",
            "/api/v1/ai/conversations",
            {
              // The context the student is actually in, which is what decides
              // whether their own attempt is part of the grounding.
              context: input.answered ? "REVIEW" : "PRACTICE",
              questionId: input.questionId,
              ...(input.attemptId ? { questionAttemptId: input.attemptId } : {}),
            },
            aiConversationDetailSchema,
          );

          if (!created.ok) {
            setFailure(created.failure);
            return;
          }

          conversationId.current = created.data.id;
        }

        // The student's own turn goes up immediately. Waiting for the server to
        // echo it back would leave the panel blank for the length of a model
        // call, which is the specific silence this whole feature streams to
        // avoid.
        const askedAt = Date.now();
        setTurns((current) => [
          ...current,
          {
            id: `local-${String(askedAt)}`,
            role: "USER",
            content: text ?? AI_ACTION_LABELS[action],
          },
          { id: `stream-${String(askedAt)}`, role: "ASSISTANT", content: "", streaming: true },
        ]);

        for await (const event of streamTutorReply(
          conversationId.current,
          { action, ...(text ? { text } : {}) },
          controller.signal,
        )) {
          if (event.type === "meta") {
            markStreaming(setTurns, (turn) => ({ ...turn, degraded: event.degraded }));
          } else if (event.type === "delta") {
            markStreaming(setTurns, (turn) => ({ ...turn, content: turn.content + event.text }));
          } else if (event.type === "done") {
            const message: AIMessage = event.message;
            markStreaming(setTurns, () => ({
              id: message.id,
              role: "ASSISTANT",
              content: message.content,
              degraded: event.degraded,
            }));
            setQuota(event.quota);
          } else {
            // An error frame arrives *after* headers, so there may already be
            // text on screen. It is shown alongside what landed rather than
            // replacing it — a partial explanation is still worth reading.
            markStreaming(setTurns, (turn) => ({ ...turn, streaming: false }));
            setFailure({ message: event.message, fieldErrors: {} });
          }
        }

        // A stream that ends without a `done` frame — the connection dropped
        // mid-answer. Whatever arrived stays; it just stops pulsing.
        markStreaming(setTurns, (turn) => ({ ...turn, streaming: false }));
      } catch (error) {
        markStreaming(setTurns, (turn) => ({ ...turn, streaming: false }));

        if (error instanceof TutorStreamError) {
          setFailure(error.failure);
          // Nothing arrived, so the empty assistant bubble would be a permanent
          // blank in the transcript.
          setTurns((current) =>
            current.filter((turn) => turn.content !== "" || turn.role === "USER"),
          );
        } else if (!controller.signal.aborted) {
          setFailure({ message: "The tutor stopped unexpectedly. Try again.", fieldErrors: {} });
        }
      } finally {
        inFlight.current = null;
        setBusy(false);
      }
    },
    [input.answered, input.attemptId, input.questionId],
  );

  return {
    open,
    turns,
    actions: offeredActions(input, hasReply),
    quota,
    busy,
    failure,
    setOpen,
    ask,
    dismissFailure: useCallback(() => {
      setFailure(null);
    }, []),
  };
}

/**
 * Update the turn that is currently streaming, if there is one.
 *
 * All the mid-stream updates target the same bubble, and doing it by index
 * would break the moment two turns are in flight — which cannot happen today
 * because `ask` refuses to start a second one, but "cannot happen today" is how
 * this kind of bug gets written.
 */
function markStreaming(
  setTurns: React.Dispatch<React.SetStateAction<TutorTurn[]>>,
  update: (turn: TutorTurn) => TutorTurn,
): void {
  setTurns((current) => current.map((turn) => (turn.streaming ? update(turn) : turn)));
}
