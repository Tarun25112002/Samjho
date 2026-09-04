"use client";

import {
  attemptOutcomeSchema,
  bookmarkStateSchema,
  EMPTY_ANSWER,
  practiceAttemptSchema,
  practiceResultSchema,
  practiceSessionSchema,
  type MistakeReason,
  type PracticeItem,
  type PracticeSession,
  type StudentAnswer,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * The practice runner's brain.
 *
 * Everything that is not markup lives here, for the same reason the admin editor
 * does it (docs/01 §15). The runner has a genuinely awkward state problem —
 * ten questions, a draft answer per graded part, a server-owned score per part,
 * and a self-evaluation step that arrives minutes after the answer — and solving
 * it inside JSX would produce a component nobody can change safely.
 *
 * ## The server owns the score; the client owns the draft
 *
 * That split is the whole design. `answers` holds what the student is typing and
 * is thrown away on submit. Everything after submit — right or wrong, marks,
 * the key, the marking scheme — comes back in the response and is stored as the
 * *session*, never recomputed locally. There is no client-side grading, not even
 * for an MCQ where it would be trivial: two graders is one more than the number
 * of things that can disagree.
 *
 * ## Why the whole item is replaced rather than patched
 *
 * Each mutation returns the item and the session totals. Splicing that in
 * wholesale means the client cannot hold a version of the truth the server never
 * sent — the failure mode of patching field by field is a progress bar that says
 * 7 while the result page says 6, and the student believes the one that is
 * wrong.
 */

export interface PracticeRunner {
  session: PracticeSession;
  item: PracticeItem | undefined;
  index: number;
  /** Graded parts of the current item — the container itself is never one. */
  targets: { id: string; marks: number }[];
  answers: Record<string, StudentAnswer>;
  answered: boolean;
  busy: boolean;
  failure: ApiFailure | null;

  setAnswer: (targetId: string, answer: StudentAnswer) => void;
  submit: () => Promise<void>;
  selfEvaluate: (attemptId: string, marksAwarded: number) => Promise<void>;
  setMistakeReason: (attemptId: string, reason: MistakeReason | null) => Promise<void>;
  toggleBookmark: () => Promise<void>;
  goTo: (index: number) => void;
  finish: () => Promise<void>;
}

export function usePracticeRunner(initial: PracticeSession): PracticeRunner {
  const router = useRouter();

  const [session, setSession] = useState(initial);
  const [index, setIndex] = useState(() =>
    Math.min(initial.currentIndex, Math.max(initial.items.length - 1, 0)),
  );
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  /**
   * When the student arrived at the question they are looking at.
   *
   * A ref rather than state: it is read once, on submit, and re-rendering the
   * whole runner every time it changes would be a re-render per navigation for
   * a value nothing displays.
   */
  const shownAt = useRef(Date.now());

  const item = session.items[index];

  const targets = useMemo(() => {
    if (!item) return [];
    return item.question.isContainer
      ? item.question.subParts.map((part) => ({ id: part.id, marks: part.marks }))
      : [{ id: item.question.id, marks: item.question.marks }];
  }, [item]);

  const answered = (item?.attempts.length ?? 0) > 0;

  const replaceItem = useCallback(
    (next: { item: PracticeItem; totals: PracticeSession["totals"] }) => {
      setSession((current) => ({
        ...current,
        totals: next.totals,
        items: current.items.map((candidate) =>
          candidate.question.id === next.item.question.id ? next.item : candidate,
        ),
      }));
    },
    [],
  );

  const setAnswer = useCallback((targetId: string, answer: StudentAnswer) => {
    setAnswers((current) => ({ ...current, [targetId]: answer }));
  }, []);

  const submit = useCallback(async () => {
    if (!item || answered || busy) return;

    setBusy(true);
    setFailure(null);

    const result = await sendJson(
      "POST",
      `/api/v1/practice-sessions/${session.id}/attempts`,
      {
        questionId: item.question.id,
        responses: targets.map((target) => ({
          targetId: target.id,
          answer: answers[target.id] ?? EMPTY_ANSWER,
        })),
        // Clamped to the schema's ceiling: a tab left open overnight would
        // otherwise send a duration the API rejects, losing a real answer to a
        // number nothing depends on.
        timeSpentMs: Math.min(Date.now() - shownAt.current, 6 * 60 * 60 * 1000),
      },
      attemptOutcomeSchema,
    );

    setBusy(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    replaceItem(result.data);
  }, [answered, answers, busy, item, replaceItem, session.id, targets]);

  const selfEvaluate = useCallback(
    async (attemptId: string, marksAwarded: number) => {
      setBusy(true);
      setFailure(null);

      const result = await sendJson(
        "POST",
        `/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`,
        { marksAwarded },
        attemptOutcomeSchema,
      );

      setBusy(false);

      if (!result.ok) {
        setFailure(result.failure);
        return;
      }

      replaceItem(result.data);
    },
    [replaceItem, session.id],
  );

  const setMistakeReason = useCallback(
    async (attemptId: string, reason: MistakeReason | null) => {
      // Optimistic, and deliberately so: this is a one-tap annotation the
      // student is on their way past. Waiting on a round trip to redraw a chip
      // makes the whole panel feel like it is arguing with them, and the worst
      // case for a lost write is one missing data point in an optional field.
      setSession((current) => ({
        ...current,
        items: current.items.map((candidate) => ({
          ...candidate,
          attempts: candidate.attempts.map((attempt) =>
            attempt.id === attemptId ? { ...attempt, mistakeReason: reason } : attempt,
          ),
        })),
      }));

      const result = await sendJson(
        "POST",
        `/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/mistake-reason`,
        { reason },
        practiceAttemptSchema,
      );

      if (!result.ok) setFailure(result.failure);
    },
    [session.id],
  );

  const toggleBookmark = useCallback(async () => {
    if (!item) return;

    const questionId = item.question.id;
    const next = !item.bookmarked;

    setSession((current) => ({
      ...current,
      items: current.items.map((candidate) =>
        candidate.question.id === questionId ? { ...candidate, bookmarked: next } : candidate,
      ),
    }));

    const result = next
      ? await sendJson("PUT", "/api/v1/bookmarks", { questionId, note: null }, bookmarkStateSchema)
      : await sendJson(
          "DELETE",
          `/api/v1/bookmarks/${encodeURIComponent(questionId)}`,
          undefined,
          bookmarkStateSchema,
        );

    if (!result.ok) {
      // Put it back. An optimistic toggle that silently keeps a state the server
      // rejected is worse than a flicker.
      setSession((current) => ({
        ...current,
        items: current.items.map((candidate) =>
          candidate.question.id === questionId ? { ...candidate, bookmarked: !next } : candidate,
        ),
      }));
      setFailure(result.failure);
    }
  }, [item]);

  const goTo = useCallback(
    (nextIndex: number) => {
      const clamped = Math.min(Math.max(nextIndex, 0), Math.max(session.items.length - 1, 0));
      setIndex(clamped);
      setFailure(null);
      shownAt.current = Date.now();

      // Fire and forget. The student's place is a convenience for the next
      // reload, not something worth a spinner — and the runner already holds the
      // authoritative position in memory.
      void sendJson(
        "PATCH",
        `/api/v1/practice-sessions/${session.id}`,
        { currentIndex: clamped },
        practiceSessionSchema,
      );
    },
    [session.id, session.items.length],
  );

  const finish = useCallback(async () => {
    setBusy(true);
    setFailure(null);

    const result = await sendJson(
      "POST",
      `/api/v1/practice-sessions/${session.id}/complete`,
      {},
      practiceResultSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setFailure(result.failure);
      return;
    }

    // No `setBusy(false)`: the navigation is the end of this component's life,
    // and re-enabling the button first gives a student on a slow phone a live
    // Finish button on a session that is already over.
    router.push(`/practice/sessions/${session.id}/result`);
  }, [router, session.id]);

  return {
    session,
    item,
    index,
    targets,
    answers,
    answered,
    busy,
    failure,
    setAnswer,
    submit,
    selfEvaluate,
    setMistakeReason,
    toggleBookmark,
    goTo,
    finish,
  };
}
