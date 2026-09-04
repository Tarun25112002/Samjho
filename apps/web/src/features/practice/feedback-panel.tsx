"use client";

import {
  MISTAKE_REASON_LABELS,
  mistakeReasonSchema,
  type MistakeReason,
  type PracticeAttempt,
  type PracticeItem,
  type StudentSubPart,
} from "@samjho/contracts";
import { formatMarks, MathText } from "@samjho/ui";

import { formatMarksValue } from "@/lib/practice-format";

/**
 * What the student reads after answering.
 *
 * This panel is the product. Everything else — the filters, the runner, the
 * progress bar — exists to get a student to a moment where they have committed
 * to an answer and can now find out *why* it was what it was. docs/00 says it in
 * one line: when a feature could be more analytics or more practice, choose
 * practice; when it could give the answer or get the student to the answer,
 * choose the latter. So the order here is fixed and is not a layout preference:
 *
 *   what you answered → what was right → the marking scheme → why
 *
 * The explanation comes last because a student who reads it first stops reading.
 *
 * ## Self-evaluation is a step, not a score box
 *
 * For a subjective answer there is nothing to reveal until the student has
 * scored themselves, and the scheme is shown *with* the buttons rather than
 * behind them: comparing your answer against the official steps is the
 * evaluation, and hiding the steps until after the score would make it a guess.
 * MVP exam scores for subjective work are self-assessed (docs/07 R3, Q8) and
 * this is where a student learns to do it honestly.
 */

const REASONS = mistakeReasonSchema.options;

export function FeedbackPanel({
  item,
  busy,
  onSelfEvaluate,
  onSetMistakeReason,
}: {
  item: PracticeItem;
  busy: boolean;
  onSelfEvaluate: (attemptId: string, marksAwarded: number) => void;
  onSetMistakeReason: (attemptId: string, reason: MistakeReason | null) => void;
}) {
  if (item.attempts.length === 0) return null;

  const parts = new Map<string, StudentSubPart>(
    item.question.subParts.map((part) => [part.id, part]),
  );

  return (
    <section
      aria-label="Feedback"
      className="border-ink-100 dark:border-ink-700 flex flex-col gap-6 rounded-xl border p-5"
    >
      {item.attempts.map((attempt) => (
        <AttemptFeedback
          key={attempt.id}
          attempt={attempt}
          label={labelFor(attempt, item, parts)}
          options={optionsFor(attempt, item, parts)}
          busy={busy}
          onSelfEvaluate={onSelfEvaluate}
          onSetMistakeReason={onSetMistakeReason}
        />
      ))}
    </section>
  );
}

function AttemptFeedback({
  attempt,
  label,
  options,
  busy,
  onSelfEvaluate,
  onSetMistakeReason,
}: {
  attempt: PracticeAttempt;
  label: string | null;
  options: { id: string; label: string }[];
  busy: boolean;
  onSelfEvaluate: (attemptId: string, marksAwarded: number) => void;
  onSetMistakeReason: (attemptId: string, reason: MistakeReason | null) => void;
}) {
  const pending = attempt.evaluationMode === "PENDING";
  const key = attempt.key;

  return (
    <article className="flex flex-col gap-3">
      <header className="flex flex-wrap items-center gap-2 text-sm">
        {label ? <span className="text-ink-500 dark:text-ink-300">{label}</span> : null}
        <Verdict attempt={attempt} />
        <span className="text-ink-500 dark:text-ink-300">
          {formatMarksValue(attempt.marksAwarded)} / {formatMarksValue(attempt.marksPossible)}
        </span>
      </header>

      {pending ? (
        <SelfEvaluation attempt={attempt} busy={busy} onSelfEvaluate={onSelfEvaluate} />
      ) : (
        <CorrectAnswer attempt={attempt} options={options} />
      )}

      {key?.markingScheme?.length ? <MarkingScheme steps={key.markingScheme} /> : null}

      {key ? (
        <div className="text-ink-700 dark:text-ink-100 text-sm">
          <h4 className="text-ink-500 dark:text-ink-300 text-xs font-semibold tracking-wide uppercase">
            Solution
          </h4>
          <MathText>{key.solution}</MathText>
          {key.explanation ? <MathText>{key.explanation}</MathText> : null}
        </div>
      ) : null}

      {attempt.isCorrect === false ? (
        <MistakeReasons attempt={attempt} onSetMistakeReason={onSetMistakeReason} />
      ) : null}
    </article>
  );
}

function Verdict({ attempt }: { attempt: PracticeAttempt }) {
  if (attempt.evaluationMode === "PENDING") {
    return <span className="text-ink-700 dark:text-ink-100 font-medium">Score yourself below</span>;
  }

  if (attempt.isCorrect === true) {
    return <span className="text-success font-medium">Correct</span>;
  }

  // Partial credit is not "incorrect" in a way a student recognises — they got
  // three of the five marks and being told they were wrong is both untrue and
  // discouraging. It still counts as a mistake everywhere the data goes.
  if (attempt.marksAwarded > 0) {
    return <span className="text-brand-600 font-medium">Partly right</span>;
  }

  return <span className="text-danger font-medium">Not right</span>;
}

/**
 * The correct answer, in whichever form this question has one.
 *
 * Option-bearing types print the letter and nothing else, because the option
 * text is already on screen directly above and repeating it makes the panel look
 * like a different question.
 */
function CorrectAnswer({
  attempt,
  options,
}: {
  attempt: PracticeAttempt;
  options: { id: string; label: string }[];
}) {
  const key = attempt.key;
  if (!key) return null;

  const correctLabels = options
    .filter((option) => key.correctOptionIds.includes(option.id))
    .map((option) => option.label);

  const answerText =
    correctLabels.length > 0
      ? correctLabels.join(", ")
      : [key.correctValue, key.unit].filter(Boolean).join(" ");

  if (!answerText) return null;

  return (
    <p className="text-sm">
      <span className="text-ink-500 dark:text-ink-300">Correct answer: </span>
      <span className="text-ink-900 dark:text-ink-50 font-medium">{answerText}</span>
    </p>
  );
}

/**
 * Award yourself the marks.
 *
 * Whole marks only, because CBSE marking schemes allocate whole marks per step
 * and offering halves would invite a precision the scheme does not have. The
 * buttons go 0 upward rather than downward from full: starting at "none" and
 * working up is a slightly harder question to answer generously.
 */
function SelfEvaluation({
  attempt,
  busy,
  onSelfEvaluate,
}: {
  attempt: PracticeAttempt;
  busy: boolean;
  onSelfEvaluate: (attemptId: string, marksAwarded: number) => void;
}) {
  const choices = Array.from({ length: attempt.marksPossible + 1 }, (_, marks) => marks);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-ink-500 dark:text-ink-300 text-sm">
        Compare your answer with the scheme below, then award yourself the marks you would have got.
      </p>

      <div className="flex flex-wrap gap-2">
        {choices.map((marks) => (
          <button
            key={marks}
            type="button"
            disabled={busy}
            onClick={() => {
              onSelfEvaluate(attempt.id, marks);
            }}
            className="border-ink-100 dark:border-ink-700 hover:border-brand-600 min-h-11 rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
          >
            {marks === 0 ? "No marks" : formatMarks(marks)}
          </button>
        ))}
      </div>
    </div>
  );
}

function MarkingScheme({
  steps,
}: {
  steps: { step: string; marks: number; keyPoints: string[] }[];
}) {
  return (
    <div className="text-sm">
      <h4 className="text-ink-500 dark:text-ink-300 text-xs font-semibold tracking-wide uppercase">
        Marking scheme
      </h4>
      <ul className="mt-1 flex flex-col gap-1">
        {steps.map((step, position) => (
          <li key={position} className="flex gap-3">
            <span className="text-ink-500 dark:text-ink-300 shrink-0 tabular-nums">
              {formatMarksValue(step.marks)}
            </span>
            <span className="text-ink-700 dark:text-ink-100">
              <MathText inline>{step.step}</MathText>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * "What went wrong?" — one tap, skippable, and tapping the same chip clears it.
 *
 * This is the field that turns "you got 12 wrong" into "you keep making
 * calculation slips in Electricity". It is optional on purpose: a student who
 * feels obliged to categorise every mistake stops practising, and a mis-tapped
 * reason is worse than a missing one because it looks like data.
 */
function MistakeReasons({
  attempt,
  onSetMistakeReason,
}: {
  attempt: PracticeAttempt;
  onSetMistakeReason: (attemptId: string, reason: MistakeReason | null) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-ink-500 dark:text-ink-300 text-xs font-semibold tracking-wide uppercase">
        What went wrong? (optional)
      </legend>

      <div className="flex flex-wrap gap-2">
        {REASONS.map((reason) => {
          const selected = attempt.mistakeReason === reason;
          return (
            <button
              key={reason}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSetMistakeReason(attempt.id, selected ? null : reason);
              }}
              className={[
                "min-h-11 rounded-full border px-3 py-1 text-sm",
                selected
                  ? "border-brand-600 text-brand-600"
                  : "border-ink-100 dark:border-ink-700 text-ink-500 hover:border-brand-600",
              ].join(" ")}
            >
              {MISTAKE_REASON_LABELS[reason]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "(ii)" for a case study's parts; nothing for a question that has only one. */
function labelFor(
  attempt: PracticeAttempt,
  item: PracticeItem,
  parts: Map<string, StudentSubPart>,
): string | null {
  if (attempt.targetId === item.question.id) return null;

  const part = parts.get(attempt.targetId);
  return part ? `Part ${romanise(part.subPartIndex + 1)}` : null;
}

function optionsFor(
  attempt: PracticeAttempt,
  item: PracticeItem,
  parts: Map<string, StudentSubPart>,
): { id: string; label: string }[] {
  if (attempt.targetId === item.question.id) return item.question.options;
  return parts.get(attempt.targetId)?.options ?? [];
}

/** CBSE prints case-study parts as (i), (ii), (iii) — never as 1, 2, 3. */
function romanise(value: number): string {
  return ["i", "ii", "iii", "iv", "v", "vi"][value - 1] ?? String(value);
}
