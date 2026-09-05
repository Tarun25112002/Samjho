"use client";

import {
  EMPTY_ANSWER,
  isAnswered,
  PRACTICE_MODE_LABELS,
  type PracticeItem,
  type PracticeSession,
  type StudentAnswer,
} from "@samjho/contracts";
import { QuestionRenderer } from "@samjho/ui";
import Link from "next/link";

import { BookmarkIcon, ChevronLeft, ChevronRight } from "@/components/icons";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageShell } from "@/components/ui/page";
import { Card } from "@/components/ui/surface";
import { formatMarksValue, markingFrom } from "@/lib/practice-format";
import { TutorPanel } from "@/features/ai/tutor-panel";
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
 *
 * ## The action bar sticks to the bottom
 *
 * On a phone the question is often taller than the screen, so a "Check answer"
 * button placed after it is a button below the fold — and the student's thumb is
 * at the bottom of the screen anyway. It is sticky rather than fixed so it
 * cannot cover the last line of a long answer field.
 */
export function PracticeRunner({ initial }: { initial: PracticeSession }) {
  const runner = usePracticeRunner(initial);
  const { session, item, index, targets, answers, answered, busy } = runner;

  if (!item) {
    return (
      <PageShell as="main" width="narrow" className="py-16 text-center sm:py-20">
        <div>
          <p className="text-text-soft">
            This set has no questions left in it. A question can be withdrawn by an editor after a
            set is built.
          </p>
          <ButtonLink href="/practice" className="mt-6">
            Build another set
          </ButtonLink>
        </div>
      </PageShell>
    );
  }

  const values = answered
    ? Object.fromEntries(item.attempts.map((attempt) => [attempt.targetId, attempt.answer]))
    : answers;

  const anythingEntered = targets.some((target) => isAnswered(values[target.id] ?? EMPTY_ANSWER));
  const marking = answered ? markingFrom(item.attempts) : undefined;
  const isLast = index === session.items.length - 1;

  return (
    <div className="flex min-h-screen flex-col">
      <RunnerHeader
        session={session}
        index={index}
        bookmarked={item.bookmarked}
        onToggleBookmark={() => void runner.toggleBookmark()}
        onJump={(next) => {
          runner.goTo(next);
        }}
      />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
        <Card as="div">
          <QuestionRenderer
            question={item.question}
            displayNumber={String(index + 1)}
            value={values[item.question.id] ?? EMPTY_ANSWER}
            subPartValues={values}
            {...(marking ? { marking } : {})}
            {...(answered
              ? {}
              : {
                  onChange: (questionId: string, value: StudentAnswer) => {
                    runner.setAnswer(questionId, value);
                  },
                })}
          />
        </Card>

        {runner.failure ? (
          <p
            role="alert"
            className="rounded-control border-marker-200 bg-marker-50 text-marker-700 border px-4 py-3 text-sm"
          >
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

        {/*
          Below the feedback, not above it. Before answering this is the hint
          ladder; after answering it is "ask about this" — and in that second
          case the student must meet the official solution first. A tutor panel
          sitting above the marking scheme would be the product answering a
          question the student has not finished asking.

          Not keyed on the question: the hook resets its own conversation when
          `questionId` changes, which keeps the panel's open/closed state across
          navigation. A student working through a set with the tutor open should
          not have to re-open it ten times.
        */}
        <TutorPanel
          questionId={item.question.id}
          answered={answered}
          answeredWrong={item.attempts.some((attempt) => attempt.isCorrect === false)}
          attemptId={item.attempts[0]?.id}
        />
      </main>

      <div className="border-line bg-card/95 sticky bottom-0 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-2 px-4 py-3 sm:px-6">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous question"
            disabled={index === 0}
            onClick={() => {
              runner.goTo(index - 1);
            }}
            className="px-3!"
          >
            <ChevronLeft className="size-5" />
          </Button>

          {answered ? null : (
            <Button
              disabled={busy}
              fullWidth
              onClick={() => void runner.submit()}
              className="min-w-0"
            >
              {/*
                The label changes rather than the button being disabled. A
                student who genuinely does not know the answer must be able to
                submit nothing and read the solution — refusing them teaches
                them to type anything to get past the form.
              */}
              {anythingEntered ? "Check answer" : "Skip and see the answer"}
            </Button>
          )}

          {answered && !isLast ? (
            <Button
              fullWidth
              onClick={() => {
                runner.goTo(index + 1);
              }}
              className="min-w-0"
            >
              Next question
            </Button>
          ) : null}

          {isLast ? (
            <Button
              variant={answered ? "primary" : "secondary"}
              disabled={busy}
              onClick={() => void runner.finish()}
              className={answered ? "min-w-0 flex-1" : ""}
            >
              Finish
            </Button>
          ) : answered ? null : (
            <Button
              variant="secondary"
              size="sm"
              aria-label="Next question"
              onClick={() => {
                runner.goTo(index + 1);
              }}
              className="px-3!"
            >
              <ChevronRight className="size-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The focus shell's header: where you are, and one way out.
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
  onJump,
}: {
  session: PracticeSession;
  index: number;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onJump: (index: number) => void;
}) {
  const total = session.items.length;

  return (
    <header className="border-line bg-card/95 sticky top-0 z-30 border-b backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
        {/*
          `min-w-0` and `truncate` together, because neither works alone: a flex
          child will not shrink below its content without the first, and will not
          ellipsize without the second. Without both, a chapter called "Chemical
          Reactions and Equations" pushes Exit off a 360px screen — and Exit is
          the only way out of the focus shell.
        */}
        <div className="min-w-0">
          <p className="text-text text-sm font-semibold">
            Question {index + 1} of {total}
          </p>
          <p className="text-text-faint truncate text-xs">
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
            "rounded-pill ml-auto inline-flex min-h-11 shrink-0 items-center gap-2 border px-3 text-sm font-medium transition-colors",
            bookmarked
              ? "border-brand-300 bg-brand-50 text-brand-700"
              : "border-line-strong text-text-soft hover:border-brand-300",
          ].join(" ")}
        >
          <BookmarkIcon className="size-4" filled={bookmarked} />
          <span className="sr-only sm:not-sr-only">{bookmarked ? "Saved" : "Save"}</span>
        </button>

        <Link
          href={`/practice/sessions/${session.id}/result`}
          className="text-text-soft hover:text-text flex min-h-11 shrink-0 items-center text-sm font-medium"
        >
          Exit
        </Link>
      </div>

      <QuestionStrip session={session} index={index} onJump={onJump} />
    </header>
  );
}

/**
 * Every question in the set, as a strip you can jump around in.
 *
 * The exam palette in miniature, and built now because the runner already has
 * everything it needs: a student who wants to go back to question 4 currently
 * has to press Previous six times.
 *
 * Filled versus hollow carries "answered", so the strip still works with the
 * colour turned off — docs/01 §9's rule, and the reason the state is not left to
 * hue alone. Each segment is a real button with the state written into its
 * accessible name, because a row of coloured bars says nothing out loud.
 */
function QuestionStrip({
  session,
  index,
  onJump,
}: {
  session: PracticeSession;
  index: number;
  onJump: (index: number) => void;
}) {
  return (
    <ol className="mx-auto flex w-full max-w-3xl gap-1 px-4 pb-2 sm:px-6">
      {session.items.map((item, position) => {
        const state = itemState(item);
        const current = position === index;

        return (
          <li key={item.question.id} className="flex-1">
            <button
              type="button"
              onClick={() => {
                onJump(position);
              }}
              aria-current={current ? "step" : undefined}
              className="group flex h-5 w-full items-end"
            >
              <span className="sr-only">
                Question {position + 1}, {STATE_LABEL[state]}
              </span>
              <span
                aria-hidden="true"
                className={[
                  "w-full rounded-full transition-all",
                  current ? "h-2" : "h-1.5",
                  STATE_CLASS[state],
                  current ? "ring-brand-500 ring-2 ring-offset-1" : "",
                ].join(" ")}
              />
            </button>
          </li>
        );
      })}
    </ol>
  );
}

type ItemState = "unanswered" | "correct" | "incorrect" | "partial" | "pending";

const STATE_CLASS: Record<ItemState, string> = {
  unanswered: "bg-line",
  correct: "bg-tick-500",
  incorrect: "bg-marker-500",
  partial: "bg-half-500",
  pending: "bg-half-200",
};

const STATE_LABEL: Record<ItemState, string> = {
  unanswered: "not answered yet",
  correct: "correct",
  incorrect: "not right",
  partial: "partly right",
  pending: "waiting for you to score it",
};

/**
 * One item's verdict, from its attempts.
 *
 * A case study has several attempts and only counts as correct when all of them
 * are — the same rule the session totals use, which is why "partly right" exists
 * as a state here rather than being folded into incorrect.
 */
function itemState(item: PracticeItem): ItemState {
  if (item.attempts.length === 0) return "unanswered";
  if (item.attempts.some((attempt) => attempt.evaluationMode === "PENDING")) return "pending";
  if (item.attempts.every((attempt) => attempt.isCorrect === true)) return "correct";
  if (item.attempts.some((attempt) => attempt.marksAwarded > 0)) return "partial";
  return "incorrect";
}
