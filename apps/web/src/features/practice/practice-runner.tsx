"use client";

import {
  EMPTY_ANSWER,
  isAnswered,
  PRACTICE_MODE_LABELS,
  type PracticeSession,
  type StudentAnswer,
} from "@samjho/contracts";
import { QuestionRenderer } from "@samjho/ui";
import Link from "next/link";

import { formatMarksValue } from "@/lib/practice-format";
import { FeedbackPanel } from "./feedback-panel";
import { usePracticeRunner } from "./use-practice-runner";

/**
 * The practice runner: one question at a time, in the focus shell.
 *
 * ## Why the question is rendered by `QuestionRenderer` and not by this file
 *
 * Four surfaces show a question — practice, the exam, review, and the admin
 * preview — and Phase 3 built the renderer before any of them existed precisely
 * so none of them would grow its own markup. The runner supplies a value and an
 * `onChange` and gets all ten question types, KaTeX and the sub-part layout for
 * free. It is also why an editor previewing a question sees exactly this.
 *
 * ## Answering is one-way
 *
 * Once submitted, the controls go read-only: `onChange` is simply not passed,
 * which is the renderer's own definition of read-only rather than a `disabled`
 * flag threaded through it. A student cannot revise an answer after seeing
 * whether it was right, because the number that comes out the other end has to
 * mean something.
 */
export function PracticeRunner({ initial }: { initial: PracticeSession }) {
  const runner = usePracticeRunner(initial);
  const { session, item, index, targets, answers, answered, busy } = runner;

  if (!item) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-ink-500 dark:text-ink-300">
          This set has no questions left in it. A question can be withdrawn by an editor after a set
          is built.
        </p>
        <Link href="/practice" className="text-brand-600 mt-4 inline-block underline">
          Build another set
        </Link>
      </main>
    );
  }

  const values = answered
    ? Object.fromEntries(item.attempts.map((attempt) => [attempt.targetId, attempt.answer]))
    : answers;

  const anythingEntered = targets.some((target) => isAnswered(values[target.id] ?? EMPTY_ANSWER));
  const isLast = index === session.items.length - 1;

  return (
    <div className="flex min-h-screen flex-col">
      <RunnerHeader
        session={session}
        index={index}
        bookmarked={item.bookmarked}
        onToggleBookmark={() => void runner.toggleBookmark()}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="border-ink-100 dark:border-ink-700 rounded-xl border p-5">
          <QuestionRenderer
            question={item.question}
            displayNumber={String(index + 1)}
            value={values[item.question.id] ?? EMPTY_ANSWER}
            subPartValues={values}
            {...(answered
              ? {}
              : {
                  onChange: (questionId: string, value: StudentAnswer) => {
                    runner.setAnswer(questionId, value);
                  },
                })}
          />
        </div>

        {runner.failure ? (
          <p role="alert" className="text-danger text-sm">
            {runner.failure.message}
          </p>
        ) : null}

        {answered ? (
          <FeedbackPanel
            item={item}
            busy={busy}
            onSelfEvaluate={(attemptId, marks) => void runner.selfEvaluate(attemptId, marks)}
            onSetMistakeReason={(attemptId, reason) =>
              void runner.setMistakeReason(attemptId, reason)
            }
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {answered ? null : (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runner.submit()}
              className="bg-brand-600 min-h-11 rounded-lg px-4 py-2 font-medium text-white disabled:opacity-50"
            >
              {/*
                The label changes rather than the button being disabled. A
                student who genuinely does not know the answer must be able to
                submit nothing and read the solution — refusing them teaches
                them to type anything to get past the form.
              */}
              {anythingEntered ? "Check answer" : "Skip and see the answer"}
            </button>
          )}

          {index > 0 ? (
            <button
              type="button"
              onClick={() => {
                runner.goTo(index - 1);
              }}
              className="border-ink-100 dark:border-ink-700 min-h-11 rounded-lg border px-4 py-2 text-sm"
            >
              Previous
            </button>
          ) : null}

          {isLast ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runner.finish()}
              className="border-brand-600 text-brand-600 min-h-11 rounded-lg border px-4 py-2 font-medium disabled:opacity-50"
            >
              Finish and see results
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                runner.goTo(index + 1);
              }}
              className="border-ink-100 dark:border-ink-700 min-h-11 rounded-lg border px-4 py-2 text-sm"
            >
              Next question
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

/**
 * The focus shell's header: progress, and one way out.
 *
 * No navigation. docs/01 §7 calls this the focus shell and the reason is
 * behavioural rather than aesthetic — a student who can see the rest of the app
 * mid-set will visit it, and a half-finished set is the one that never gets
 * finished. Leaving is still one tap, and the session survives it.
 */
function RunnerHeader({
  session,
  index,
  bookmarked,
  onToggleBookmark,
}: {
  session: PracticeSession;
  index: number;
  bookmarked: boolean;
  onToggleBookmark: () => void;
}) {
  const total = session.items.length;
  const progress = total > 0 ? ((index + 1) / total) * 100 : 0;

  return (
    <header className="border-ink-100 dark:border-ink-700 border-b">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 text-sm sm:gap-4 sm:px-6">
        {/*
          `min-w-0` and `truncate` together, because neither works alone: a flex
          child will not shrink below its content without the first, and will not
          ellipsize without the second. Without both, a chapter called "Chemical
          Reactions and Equations" pushes Save and Exit off a 360px screen — and
          Exit is the only way out of the focus shell.
        */}
        <div className="min-w-0">
          <p className="text-ink-900 dark:text-ink-50 font-medium">
            Question {index + 1} of {total}
          </p>
          <p className="text-ink-500 dark:text-ink-300 truncate text-xs">
            {session.focus ?? PRACTICE_MODE_LABELS[session.mode]} ·{" "}
            {formatMarksValue(session.totals.marksEarned)} /{" "}
            {formatMarksValue(session.totals.marksPossible)} marks
          </p>
        </div>

        <button
          type="button"
          aria-pressed={bookmarked}
          onClick={onToggleBookmark}
          className={[
            "ml-auto min-h-11 shrink-0 rounded-lg border px-3 py-1.5",
            bookmarked
              ? "border-brand-600 text-brand-600"
              : "border-ink-100 dark:border-ink-700 text-ink-500",
          ].join(" ")}
        >
          {bookmarked ? "Saved" : "Save"}
        </button>

        <Link
          href={`/practice/sessions/${session.id}/result`}
          className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-50 flex min-h-11 shrink-0 items-center"
        >
          Exit
        </Link>
      </div>

      <div
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={Math.max(total, 1)}
        aria-label="Progress through this set"
        className="bg-ink-100 dark:bg-ink-700 h-1 w-full"
      >
        <div className="bg-brand-500 h-1" style={{ width: `${String(progress)}%` }} />
      </div>
    </header>
  );
}
