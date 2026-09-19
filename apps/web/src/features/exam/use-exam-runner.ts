"use client";

import {
  EMPTY_EXAM_ANSWER,
  saveExamAnswerResultSchema,
  type AnswerStatus,
  type ExamAnswerValue,
  type ExamAttempt,
  type ExamItem,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * The exam runner's brain.
 *
 * ## Saving is debounced, queued per slot, and ordered by revision
 *
 * A student typing a five-mark derivation produces a keystroke every hundred
 * milliseconds and an answer worth three hours of their life. Saving on every
 * one would be a request per character; saving only on navigation would lose
 * everything if the tab died mid-answer. So: local state is instant, a save
 * fires 800ms after they stop, and the revision counter increments per slot so
 * the server can order two tabs deterministically without a lock.
 *
 * `revision` is the entire concurrency story on this side. The server accepts a
 * write only when the revision is at least what it holds, so a slow request
 * that lands after a faster later one is refused rather than overwriting it.
 *
 * ## Save status is a feature, not chrome
 *
 * During a three-hour high-stakes exam, uncertainty about whether work is saved
 * is itself a failure (docs/04 §3). So there is an explicit
 * saving / saved / failed state per attempt, and it is rendered.
 *
 * ## What is deliberately not here
 *
 * The IndexedDB offline queue the design calls for. The debounce plus the
 * flush-on-hide below covers a crash and a tab close; it does not cover twenty
 * minutes without a network, which is a real scenario for this audience and is
 * honestly still open. Writing a fake version of it — a queue that loses data
 * on reload — would be worse than not having one, because the banner would say
 * "saved offline" and mean nothing.
 */

const SAVE_DEBOUNCE_MS = 800;

export type SaveState = "idle" | "saving" | "saved" | "failed";

export interface ExamRunner {
  attempt: ExamAttempt;
  item: ExamItem | undefined;
  index: number;
  answers: Record<string, ExamAnswerValue>;
  statuses: Record<string, AnswerStatus>;
  chosen: Record<string, string | null>;
  saveState: SaveState;
  submitting: boolean;
  failure: ApiFailure | null;

  setAnswer: (slotId: string, answer: ExamAnswerValue) => void;
  chooseVariant: (slotId: string, itemId: string) => void;
  toggleMarked: (slotId: string) => void;
  clearAnswer: (slotId: string) => void;
  goTo: (index: number) => void;
  submit: (reason?: "STUDENT" | "AUTO_TIMEOUT_CLIENT") => Promise<void>;
  flush: () => void;
}

export function useExamRunner(initial: ExamAttempt): ExamRunner {
  const router = useRouter();

  const [index, setIndex] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const [answers, setAnswers] = useState<Record<string, ExamAnswerValue>>(() =>
    Object.fromEntries(initial.items.map((item) => [item.slotId, item.answer])),
  );
  const [statuses, setStatuses] = useState<Record<string, AnswerStatus>>(() =>
    Object.fromEntries(initial.items.map((item) => [item.slotId, item.status])),
  );
  const [chosen, setChosen] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(initial.items.map((item) => [item.slotId, item.chosenItemId])),
  );

  /**
   * Refs, not state, for all three.
   *
   * `revisions` is read inside the save and never rendered. `pending` and
   * `timers` are the debounce machinery. Putting any of them in state would
   * re-render the whole runner — including a long-answer textarea the student
   * is typing into — to store a value nothing displays.
   */
  const revisions = useRef<Record<string, number>>(
    Object.fromEntries(initial.items.map((item) => [item.slotId, item.revision])),
  );
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Set<string>>(new Set());
  const shownAt = useRef(Date.now());

  const item = initial.items[index];

  const save = useCallback(
    async (slotId: string) => {
      const revision = (revisions.current[slotId] ?? 0) + 1;
      revisions.current[slotId] = revision;

      setSaveState("saving");

      const result = await sendJson(
        "PUT",
        `/api/v1/exam-attempts/${initial.id}/answers/${slotId}`,
        {
          answer: answersRef.current[slotId] ?? EMPTY_EXAM_ANSWER,
          status: statusesRef.current[slotId] ?? "UNANSWERED",
          chosenItemId: chosenRef.current[slotId] ?? null,
          revision,
          timeSpentMs: Math.min(Date.now() - shownAt.current, 6 * 60 * 60 * 1000),
        },
        saveExamAnswerResultSchema,
      );

      pending.current.delete(slotId);

      if (!result.ok) {
        setSaveState("failed");
        setFailure(result.failure);
        return;
      }

      // Adopt the server's revision even when it refused the write. It refused
      // because another tab is ahead, and continuing to count from our own
      // number would mean every subsequent save is refused too.
      revisions.current[slotId] = result.data.revision;

      if (pending.current.size === 0) setSaveState("saved");
    },
    [initial.id],
  );

  /**
   * The current values, readable from inside a timeout without re-creating it.
   *
   * The debounced save fires up to 800ms after the state that triggered it, and
   * a closure captured at scheduling time would write whatever the student had
   * typed when they paused rather than what is there now.
   */
  const answersRef = useRef(answers);
  const statusesRef = useRef(statuses);
  const chosenRef = useRef(chosen);
  answersRef.current = answers;
  statusesRef.current = statuses;
  chosenRef.current = chosen;

  const scheduleSave = useCallback(
    (slotId: string) => {
      pending.current.add(slotId);
      setSaveState("saving");

      const existing = timers.current[slotId];
      if (existing) clearTimeout(existing);

      timers.current[slotId] = setTimeout(() => {
        void save(slotId);
      }, SAVE_DEBOUNCE_MS);
    },
    [save],
  );

  const flush = useCallback(() => {
    for (const [slotId, timer] of Object.entries(timers.current)) {
      clearTimeout(timer);
      if (pending.current.has(slotId)) void save(slotId);
    }
    timers.current = {};
  }, [save]);

  /**
   * The last, best chance to persist.
   *
   * `visibilitychange` rather than `beforeunload`: mobile browsers frequently
   * never fire the latter, and a student switching apps mid-exam is the normal
   * case rather than the edge one.
   */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [flush]);

  const setAnswer = useCallback(
    (slotId: string, answer: ExamAnswerValue) => {
      setAnswers((current) => ({ ...current, [slotId]: answer }));
      setStatuses((current) => {
        const was = current[slotId] ?? "UNANSWERED";
        const marked = was === "MARKED_FOR_REVIEW" || was === "ANSWERED_AND_MARKED";
        const answered = answer.optionIds.length > 0 || answer.text.trim().length > 0;

        return {
          ...current,
          [slotId]: marked
            ? answered
              ? "ANSWERED_AND_MARKED"
              : "MARKED_FOR_REVIEW"
            : answered
              ? "ANSWERED"
              : "UNANSWERED",
        };
      });

      scheduleSave(slotId);
    },
    [scheduleSave],
  );

  const chooseVariant = useCallback(
    (slotId: string, itemId: string) => {
      setChosen((current) => ({ ...current, [slotId]: itemId }));
      scheduleSave(slotId);
    },
    [scheduleSave],
  );

  const toggleMarked = useCallback(
    (slotId: string) => {
      setStatuses((current) => {
        const was = current[slotId] ?? "UNANSWERED";
        const next: AnswerStatus =
          was === "UNANSWERED"
            ? "MARKED_FOR_REVIEW"
            : was === "ANSWERED"
              ? "ANSWERED_AND_MARKED"
              : was === "MARKED_FOR_REVIEW"
                ? "UNANSWERED"
                : "ANSWERED";

        return { ...current, [slotId]: next };
      });

      scheduleSave(slotId);
    },
    [scheduleSave],
  );

  const clearAnswer = useCallback(
    (slotId: string) => {
      setAnswer(slotId, EMPTY_EXAM_ANSWER);
    },
    [setAnswer],
  );

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.min(Math.max(nextIndex, 0), initial.items.length - 1);
      // Leaving a question is a good moment to stop waiting for the debounce.
      flush();
      setIndex(clamped);
      shownAt.current = Date.now();
    },
    [flush, initial.items.length],
  );

  const submit = useCallback(
    async (reason: "STUDENT" | "AUTO_TIMEOUT_CLIENT" = "STUDENT") => {
      if (submitting) return;

      setSubmitting(true);
      setFailure(null);
      flush();

      const result = await sendJson(
        "POST",
        `/api/v1/exam-attempts/${initial.id}/submit`,
        { reason },
        // The result body is large and nothing here reads it — the page that
        // follows fetches it server-side. Parsing it twice would be waste on
        // the one request a student is most anxious about.
        saveExamAnswerResultSchema.partial().passthrough(),
      );

      if (!result.ok) {
        setSubmitting(false);
        setFailure(result.failure);
        return;
      }

      // `submitting` stays true through the navigation. Re-enabling the button
      // would offer a second submit on an exam that is already over.
      router.push(`/exams/attempts/${initial.id}/result`);
    },
    [flush, initial.id, router, submitting],
  );

  return {
    attempt: initial,
    item,
    index,
    answers,
    statuses,
    chosen,
    saveState,
    submitting,
    failure,
    setAnswer,
    chooseVariant,
    toggleMarked,
    clearAnswer,
    goTo,
    submit,
    flush,
  };
}

/** Counts for the palette summary, computed once per render rather than per cell. */
export function useAnswerCounts(statuses: Record<string, AnswerStatus>) {
  return useMemo(() => {
    const values = Object.values(statuses);

    return {
      answered: values.filter((s) => s === "ANSWERED" || s === "ANSWERED_AND_MARKED").length,
      marked: values.filter((s) => s === "MARKED_FOR_REVIEW" || s === "ANSWERED_AND_MARKED").length,
      unanswered: values.filter((s) => s === "UNANSWERED" || s === "MARKED_FOR_REVIEW").length,
      total: values.length,
    };
  }, [statuses]);
}
