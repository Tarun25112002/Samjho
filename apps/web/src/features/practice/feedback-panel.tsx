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

import { Check, Cross, HalfMark } from "@/components/icons";
import { Card, Chip, Toggle } from "@/components/ui/surface";
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
 *
 * ## The verdict is a shape before it is a colour
 *
 * A tick, a cross and a half-filled circle, each beside its own word. docs/01 §9
 * requires the answer states to survive colour-vision deficiency, and this is
 * the surface where getting that wrong matters most — it is the one that tells a
 * student whether they were right.
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
    <Card aria-label="Feedback" pad="flush" className="divide-line flex flex-col divide-y">
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
    </Card>
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
    <article className="flex flex-col gap-4 p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {label ? <Chip>{label}</Chip> : null}
        <Verdict attempt={attempt} />
        <span className="marks-margin text-text-soft ml-auto text-sm font-medium">
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
        <div>
          <h4 className="text-text text-sm font-semibold">Solution</h4>
          <div className="text-text-soft text-reading mt-1.5 font-serif">
            <MathText>{key.solution}</MathText>
            {key.explanation ? <MathText>{key.explanation}</MathText> : null}
          </div>
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
    return (
      <span className="text-half-700 inline-flex items-center gap-1.5 font-semibold">
        <HalfMark className="size-4" />
        Score yourself below
      </span>
    );
  }

  if (attempt.isCorrect === true) {
    return (
      <span className="text-tick-700 inline-flex items-center gap-1.5 font-semibold">
        <Check className="size-4" />
        Correct
      </span>
    );
  }

  // Partial credit is not "incorrect" in a way a student recognises — they got
  // three of the five marks, and being told they were wrong is both untrue and
  // discouraging. It still counts as a mistake everywhere the data goes.
  if (attempt.marksAwarded > 0) {
    return (
      <span className="text-half-700 inline-flex items-center gap-1.5 font-semibold">
        <HalfMark className="size-4" />
        Partly right
      </span>
    );
  }

  return (
    <span className="text-marker-700 inline-flex items-center gap-1.5 font-semibold">
      <Cross className="size-4" />
      Not right
    </span>
  );
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
    <p className="rounded-control border-tick-200 bg-tick-50 border px-4 py-3 text-sm">
      <span className="text-tick-700">Correct answer: </span>
      <span className="text-sand-900 font-semibold">{answerText}</span>
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
    <div className="rounded-control border-half-200 bg-half-50 flex flex-col gap-3 border p-4">
      <p className="text-sand-800 text-sm leading-relaxed">
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
            className="rounded-control border-line-strong bg-card text-text enabled:hover:border-brand-500 min-h-11 border px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55"
          >
            {marks === 0 ? "No marks" : formatMarks(marks)}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The scheme, with the marks out in the margin.
 *
 * Laid out the way the printed one is: the step on the left, what it is worth on
 * the right, behind a hairline. A student reading this is learning where marks
 * come from, and the shape of the document is part of that lesson.
 */
function MarkingScheme({
  steps,
}: {
  steps: { step: string; marks: number; keyPoints: string[] }[];
}) {
  return (
    <div>
      <h4 className="text-text text-sm font-semibold">Marking scheme</h4>
      <ol className="divide-line mt-1.5 flex flex-col divide-y">
        {steps.map((step, position) => (
          <li key={position} className="flex items-start gap-4 py-2.5">
            <span className="text-text-soft text-reading font-serif">
              <MathText inline>{step.step}</MathText>
            </span>
            <span className="marks-margin text-text ml-auto shrink-0 text-sm font-semibold">
              {formatMarksValue(step.marks)}
            </span>
          </li>
        ))}
      </ol>
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
    <fieldset className="border-line flex flex-col gap-2.5 border-t pt-4">
      <legend className="text-text text-sm font-semibold">What went wrong? (optional)</legend>

      <div className="flex flex-wrap gap-2">
        {REASONS.map((reason) => {
          const selected = attempt.mistakeReason === reason;
          return (
            <Toggle
              key={reason}
              selected={selected}
              onClick={() => {
                onSetMistakeReason(attempt.id, selected ? null : reason);
              }}
            >
              {MISTAKE_REASON_LABELS[reason]}
            </Toggle>
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
