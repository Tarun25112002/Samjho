"use client";

import {
  ANSWER_STATUS_LABELS,
  EMPTY_EXAM_ANSWER,
  type AnswerStatus,
  type ExamAttempt,
  type ExamItem,
} from "@medhavi/contracts";
import { QuestionRenderer } from "@medhavi/ui";
import { useState } from "react";

import { Check, ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { SessionTimer } from "@/features/practice/session-timer";
import { useAnswerCounts, useExamRunner } from "./use-exam-runner";

/**
 * The exam runner.
 *
 * Deliberately unlike the rest of the app (docs/04 §6): no navigation, no
 * tutor, no analytics, nothing that animates except the clock in its last
 * minute. A student sitting a three-hour paper who can see the rest of the
 * product will visit it, and this is the one screen where that is a failure
 * rather than a preference.
 *
 * ## The AI tutor is absent, not disabled
 *
 * There is no button to grey out. The API also rejects tutor calls that
 * reference a live attempt, so the absence here is the convenience and the
 * server-side refusal is the rule.
 *
 * ## Desktop-first, but never desktop-only
 *
 * The palette is a right-hand column above 1024px and a collapsible drawer
 * below it. Many students in this audience have only a phone, and blocking them
 * from the feature the product is named for would be the wrong call — so the
 * instructions page recommends a larger screen and the runner still works
 * without one.
 */
export function ExamRunner({ attempt }: { attempt: ExamAttempt }) {
  const runner = useExamRunner(attempt);
  const counts = useAnswerCounts(runner.statuses);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const { item, index } = runner;
  if (!item) return null;

  const chosenId = runner.chosen[item.slotId] ?? item.items[0]?.id ?? null;
  const active = item.items.find((variant) => variant.id === chosenId) ?? item.items[0];
  const answer = runner.answers[item.slotId] ?? EMPTY_EXAM_ANSWER;
  const status = runner.statuses[item.slotId] ?? "UNANSWERED";

  return (
    <div className="bg-page flex min-h-screen flex-col">
      <header className="border-line bg-card sticky top-0 z-30 border-b">
        <div className="mx-auto flex w-full max-w-[100rem] items-center gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-text truncate text-sm font-semibold">{attempt.paper.title}</p>
            <p className="text-text-faint truncate text-xs">
              {item.sectionName} · Question {item.questionNumber} of {attempt.items.length} ·{" "}
              {item.marks} {item.marks === 1 ? "mark" : "marks"}
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <SaveIndicator state={runner.saveState} />

            <SessionTimer
              deadlineAt={attempt.deadlineAt}
              clockAnchor={attempt.serverTime}
              onExpire={() => void runner.submit("AUTO_TIMEOUT_CLIENT")}
            />

            <Button
              size="sm"
              onClick={() => {
                setConfirming(true);
              }}
              disabled={runner.submitting}
            >
              Submit
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[100rem] flex-1 gap-6 px-4 py-6 sm:px-6 lg:py-8">
        <main className="min-w-0 flex-1">
          <article className="border-line bg-card rounded-panel border p-5 sm:p-7">
            {item.items.length > 1 ? (
              <VariantTabs
                item={item}
                chosenId={chosenId}
                hasAnswer={answer.optionIds.length > 0 || answer.text.trim().length > 0}
                onChoose={(variantId) => {
                  runner.chooseVariant(item.slotId, variantId);
                }}
              />
            ) : null}

            {active ? (
              <QuestionRenderer
                question={active.question}
                displayNumber={String(item.questionNumber)}
                hideMeta
                value={answer}
                subPartValues={{}}
                onChange={(_questionId, value) => {
                  runner.setAnswer(item.slotId, value);
                }}
              />
            ) : null}
          </article>

          {runner.failure ? (
            <p
              role="alert"
              className="rounded-control border-marker-200 bg-marker-50 text-marker-700 mt-4 border px-4 py-3 text-sm"
            >
              {runner.failure.message} Your earlier answers are still saved.
            </p>
          ) : null}
        </main>

        <aside className="hidden w-72 shrink-0 lg:block">
          <Palette
            attempt={attempt}
            statuses={runner.statuses}
            index={index}
            counts={counts}
            onJump={runner.goTo}
          />
        </aside>
      </div>

      <footer className="border-line bg-card sticky bottom-0 border-t pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex w-full max-w-[100rem] items-center gap-2 px-4 py-3 sm:px-6">
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

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              runner.toggleMarked(item.slotId);
            }}
            aria-pressed={status === "MARKED_FOR_REVIEW" || status === "ANSWERED_AND_MARKED"}
          >
            {status === "MARKED_FOR_REVIEW" || status === "ANSWERED_AND_MARKED"
              ? "Unmark"
              : "Mark for review"}
          </Button>

          <Button
            variant="quiet"
            size="sm"
            onClick={() => {
              runner.clearAnswer(item.slotId);
            }}
          >
            Clear
          </Button>

          <Button
            variant="secondary"
            size="sm"
            className="ml-auto lg:hidden"
            onClick={() => {
              setPaletteOpen(true);
            }}
          >
            {counts.answered}/{counts.total}
          </Button>

          <Button
            size="sm"
            disabled={index === attempt.items.length - 1}
            onClick={() => {
              runner.goTo(index + 1);
            }}
            className="lg:ml-auto"
          >
            Next <ChevronRight className="size-5" />
          </Button>
        </div>
      </footer>

      {paletteOpen ? (
        <div className="fixed inset-0 z-40 flex items-end bg-black/40 lg:hidden">
          <button
            type="button"
            aria-label="Close question list"
            className="absolute inset-0"
            onClick={() => {
              setPaletteOpen(false);
            }}
          />
          <div className="bg-card relative max-h-[75vh] w-full overflow-y-auto rounded-t-2xl p-5">
            <Palette
              attempt={attempt}
              statuses={runner.statuses}
              index={index}
              counts={counts}
              onJump={(next) => {
                runner.goTo(next);
                setPaletteOpen(false);
              }}
            />
          </div>
        </div>
      ) : null}

      {confirming ? (
        <SubmitDialog
          counts={counts}
          submitting={runner.submitting}
          onCancel={() => {
            setConfirming(false);
          }}
          onConfirm={() => void runner.submit("STUDENT")}
        />
      ) : null}
    </div>
  );
}

/**
 * Whether the student's work is safe, said plainly.
 *
 * docs/04 §3 calls this a feature rather than chrome, and it is right: during a
 * three-hour exam, not knowing whether an answer was saved is its own kind of
 * failure, and a student who cannot tell will waste time re-typing.
 */
function SaveIndicator({ state }: { state: "idle" | "saving" | "saved" | "failed" }) {
  if (state === "idle") return null;

  const text =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Not saved — retrying";

  return (
    <p
      role="status"
      aria-live="polite"
      className={[
        "hidden text-xs font-medium tabular-nums sm:block",
        state === "failed" ? "text-marker-700" : "text-text-faint",
      ].join(" ")}
    >
      {state === "saved" ? <Check className="mr-1 inline size-3.5" /> : null}
      {text}
    </p>
  );
}

/**
 * Internal choice, as the paper prints it.
 *
 * A warning rather than a block when the other side already has an answer:
 * switching is legitimate — a student may genuinely change their mind — and
 * only the chosen variant is scored, so the cost of being wrong is a lost
 * answer rather than a lost mark. Telling them is enough.
 */
function VariantTabs({
  item,
  chosenId,
  hasAnswer,
  onChoose,
}: {
  item: ExamItem;
  chosenId: string | null;
  hasAnswer: boolean;
  onChoose: (itemId: string) => void;
}) {
  return (
    <div className="mb-5">
      <div role="tablist" aria-label="Internal choice" className="flex gap-2">
        {item.items.map((variant) => {
          const selected = variant.id === chosenId;

          return (
            <button
              key={variant.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                onChoose(variant.id);
              }}
              className={[
                "rounded-pill min-h-11 border px-4 text-sm font-semibold transition-colors",
                selected
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line-strong text-text-soft hover:border-brand-300",
              ].join(" ")}
            >
              Q{item.questionNumber}
              {variant.variantLabel === "OR" ? " (OR)" : ""}
            </button>
          );
        })}
      </div>

      {hasAnswer ? (
        <p className="text-text-faint mt-2 text-xs">
          Only the option you have selected here is marked. Switching will leave your other answer
          unscored.
        </p>
      ) : null}
    </div>
  );
}

const PALETTE_CLASS: Record<AnswerStatus, string> = {
  UNANSWERED: "border-line-strong bg-card text-text-soft",
  ANSWERED: "border-tick-500 bg-tick-50 text-tick-700",
  MARKED_FOR_REVIEW: "border-half-500 bg-half-50 text-half-700",
  ANSWERED_AND_MARKED: "border-brand-500 bg-brand-50 text-brand-700",
};

/**
 * A glyph per state, not only a colour.
 *
 * The palette is otherwise pure colour-coding, which fails outright for a
 * colour-vision-deficient student — and roughly one boy in twelve is. Every
 * cell also carries its state in its accessible name, because a grid of
 * coloured squares announces nothing out loud.
 */
const PALETTE_GLYPH: Record<AnswerStatus, string> = {
  UNANSWERED: "",
  ANSWERED: "✓",
  MARKED_FOR_REVIEW: "?",
  ANSWERED_AND_MARKED: "✓?",
};

function Palette({
  attempt,
  statuses,
  index,
  counts,
  onJump,
}: {
  attempt: ExamAttempt;
  statuses: Record<string, AnswerStatus>;
  index: number;
  counts: { answered: number; marked: number; unanswered: number; total: number };
  onJump: (index: number) => void;
}) {
  const bySection = new Map<string, { name: string; items: { item: ExamItem; at: number }[] }>();

  attempt.items.forEach((item, at) => {
    const entry = bySection.get(item.sectionId) ?? { name: item.sectionName, items: [] };
    entry.items.push({ item, at });
    bySection.set(item.sectionId, entry);
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="border-line bg-card rounded-panel border p-4">
        <p className="text-text text-sm font-semibold">
          {counts.answered} of {counts.total} answered
        </p>
        <p className="text-text-faint mt-1 text-xs">
          {counts.marked} marked for review · {counts.unanswered} left
        </p>
      </div>

      {[...bySection.values()].map((section) => (
        <section key={section.name}>
          <h2 className="text-text-faint text-xs font-semibold tracking-wide uppercase">
            {section.name}
          </h2>

          <ol className="mt-2 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {section.items.map(({ item, at }) => {
              const status = statuses[item.slotId] ?? "UNANSWERED";

              return (
                <li key={item.slotId}>
                  <button
                    type="button"
                    onClick={() => {
                      onJump(at);
                    }}
                    aria-current={at === index ? "step" : undefined}
                    className={[
                      "rounded-control grid h-10 w-full place-items-center border text-sm font-semibold tabular-nums transition-colors",
                      PALETTE_CLASS[status],
                      at === index ? "ring-brand-500 ring-2 ring-offset-1" : "",
                    ].join(" ")}
                  >
                    <span className="sr-only">
                      Question {item.questionNumber}, {ANSWER_STATUS_LABELS[status]}
                    </span>
                    <span aria-hidden="true">
                      {item.questionNumber}
                      {PALETTE_GLYPH[status] ? (
                        <span className="ml-0.5 text-[0.6rem]">{PALETTE_GLYPH[status]}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/**
 * The last thing between a student and the end of three hours.
 *
 * It states what is unanswered rather than asking "are you sure": a student who
 * has left six questions blank on purpose should not be nagged, and one who has
 * left them blank by accident needs the number rather than the question.
 */
function SubmitDialog({
  counts,
  submitting,
  onCancel,
  onConfirm,
}: {
  counts: { answered: number; marked: number; unanswered: number; total: number };
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-heading"
        className="bg-card rounded-panel w-full max-w-md p-6"
      >
        <h2 id="submit-heading" className="text-text text-heading">
          Submit your paper?
        </h2>

        <dl className="border-line mt-5 grid grid-cols-3 gap-4 border-y py-4 text-center">
          <div>
            <dd className="text-text text-figure tabular-nums">{counts.answered}</dd>
            <dt className="text-text-soft mt-1 text-xs">Answered</dt>
          </div>
          <div>
            <dd className="text-text text-figure tabular-nums">{counts.unanswered}</dd>
            <dt className="text-text-soft mt-1 text-xs">Not answered</dt>
          </div>
          <div>
            <dd className="text-text text-figure tabular-nums">{counts.marked}</dd>
            <dt className="text-text-soft mt-1 text-xs">Marked</dt>
          </div>
        </dl>

        <p className="text-text-soft mt-4 text-sm leading-relaxed">
          You cannot return to the paper after submitting. Your written answers will be scored by
          you, against the official marking scheme, on the next screen.
        </p>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" fullWidth onClick={onCancel} disabled={submitting}>
            Keep working
          </Button>
          <Button fullWidth onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : "Submit paper"}
          </Button>
        </div>
      </div>
    </div>
  );
}
