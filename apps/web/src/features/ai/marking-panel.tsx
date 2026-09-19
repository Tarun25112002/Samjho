"use client";

import {
  confirmGradingResultSchema,
  gradingSuggestionSchema,
  STEP_VERDICT_LABELS,
  type GradedStep,
  type GradingSuggestion,
} from "@medhavi/contracts";
import { MathText } from "@medhavi/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Check, SparkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/surface";
import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * Marking a written answer, step by step, with the AI as an adviser.
 *
 * ## Why the student still has to press a number
 *
 * The suggestion arrives with a mark per step already filled in, and it would
 * be one line of code to submit it automatically. It is not submitted
 * automatically, and that is the feature rather than an oversight: docs/07 R3
 * commits to AI grading being assistive until its agreement with real students
 * has been measured, and a form that submits itself measures nothing.
 *
 * It is also the better pedagogy. Reading "you did not state the formula (1
 * mark)" and deciding whether that is fair is a learning act; watching a number
 * appear is not.
 *
 * ## Why every step is editable
 *
 * Because the grader will sometimes be wrong, and a student who cannot disagree
 * with it will either accept a mark they did not earn or stop trusting the
 * whole page. The reason text under each step is what makes disagreeing
 * possible — it says what was looked for, so the student can check.
 *
 * ## Degrading
 *
 * When `generated` is false no model reached a verdict. The steps still render,
 * every mark starts at zero, and the panel says plainly that this is ordinary
 * self-evaluation. It does not pretend a grader ran.
 */
export function MarkingPanel({
  attemptId,
  maxMarks,
  onScored,
}: {
  attemptId: string;
  maxMarks: number;
  onScored?: (marksAwarded: number) => void;
}) {
  const router = useRouter();

  const [suggestion, setSuggestion] = useState<GradingSuggestion | null>(null);
  const [marks, setMarks] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  async function load(): Promise<void> {
    setLoading(true);
    setFailure(null);

    const result = await sendJson(
      "POST",
      `/api/v1/ai/grading/${attemptId}`,
      {},
      gradingSuggestionSchema,
    );

    setLoading(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setSuggestion(result.data);
    setMarks(
      Object.fromEntries(result.data.steps.map((step) => [step.index, step.suggestedMarks])),
    );
  }

  async function save(): Promise<void> {
    if (!suggestion) return;

    setSaving(true);
    setFailure(null);

    const result = await sendJson(
      "POST",
      `/api/v1/ai/grading/${attemptId}/confirm`,
      {
        steps: suggestion.steps.map((step) => ({
          index: step.index,
          marksAwarded: marks[step.index] ?? 0,
        })),
      },
      confirmGradingResultSchema,
    );

    setSaving(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    onScored?.(result.data.marksAwarded);

    // The score, the section totals and the overall result all move when one
    // answer is scored, and all three are computed server-side. Refreshing is
    // the only way they cannot disagree with each other.
    router.refresh();
  }

  if (suggestion === null) {
    return (
      <div className="border-line mt-4 border-t pt-4">
        <Button variant="secondary" size="sm" disabled={loading} onClick={() => void load()}>
          <SparkIcon className="size-4" />
          {loading ? "Marking your answer…" : "Mark this with Medhavi's help"}
        </Button>

        {failure ? (
          <p role="alert" className="text-marker-700 mt-2 text-sm">
            {failure.message}
          </p>
        ) : null}
      </div>
    );
  }

  const total = suggestion.steps.reduce((sum, step) => sum + (marks[step.index] ?? 0), 0);

  return (
    <div className="border-line mt-4 border-t pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <SparkIcon className="text-brand-600 size-4" />
        <p className="text-text text-sm font-semibold">
          {suggestion.generated ? "Suggested marks" : "Score this yourself"}
        </p>
        {suggestion.generated ? (
          <Chip tone={suggestion.confidence === "HIGH" ? "correct" : "partial"}>
            {suggestion.confidence === "HIGH"
              ? "Confident"
              : suggestion.confidence === "MEDIUM"
                ? "Fairly confident"
                : "Unsure"}
          </Chip>
        ) : null}
      </div>

      <p className="text-text-faint mt-2 text-xs leading-relaxed">
        {suggestion.generated
          ? "These are suggestions, not your marks. Change any of them you disagree with — you decide what you scored."
          : "Medhavi could not mark this one. Compare your answer with the scheme and award the marks yourself."}
      </p>

      {suggestion.caveat ? (
        <p className="rounded-control border-half-200 bg-half-50 text-sand-800 mt-3 border px-3 py-2 text-xs leading-relaxed">
          {suggestion.caveat}
        </p>
      ) : null}

      <ul className="mt-4 flex flex-col gap-3">
        {suggestion.steps.map((step) => (
          <StepRow
            key={step.index}
            step={step}
            value={marks[step.index] ?? 0}
            generated={suggestion.generated}
            onChange={(value) => {
              setMarks((current) => ({ ...current, [step.index]: value }));
            }}
          />
        ))}
      </ul>

      {failure ? (
        <p role="alert" className="text-marker-700 mt-3 text-sm">
          {failure.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Award these marks"}
        </Button>
        <p className="text-text text-sm font-semibold tabular-nums">
          {Math.round(total * 100) / 100} / {maxMarks}
        </p>
      </div>
    </div>
  );
}

/**
 * One marking-scheme step, its verdict, and the number the student controls.
 *
 * The control is a row of buttons rather than a number input: the marks a step
 * can be worth are a short known list, and a text field invites typing 2.5 into
 * a step worth 2. It also keeps every target at 44px, which a spinner does not.
 */
function StepRow({
  step,
  value,
  generated,
  onChange,
}: {
  step: GradedStep;
  value: number;
  generated: boolean;
  onChange: (value: number) => void;
}) {
  // Whole marks plus halves, which is what CBSE step schemes actually use.
  const choices: number[] = [];
  for (let mark = 0; mark <= step.maxMarks + 0.001; mark += 0.5) choices.push(mark);

  return (
    <li className="border-line rounded-control border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MathText className="text-text min-w-0 flex-1 text-sm font-medium">{step.step}</MathText>
        {generated ? (
          <Chip
            tone={
              step.verdict === "MET" ? "correct" : step.verdict === "NOT_MET" ? "wrong" : "partial"
            }
          >
            {STEP_VERDICT_LABELS[step.verdict]}
          </Chip>
        ) : null}
      </div>

      {generated ? (
        <p className="text-text-soft mt-2 text-xs leading-relaxed">{step.reason}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {choices.map((choice) => {
          const selected = Math.abs(choice - value) < 0.001;

          return (
            <button
              key={choice}
              type="button"
              aria-pressed={selected}
              aria-label={`Award ${String(choice)} of ${String(step.maxMarks)} marks`}
              onClick={() => {
                onChange(choice);
              }}
              className={[
                "rounded-control grid h-11 min-w-11 place-items-center border px-2 text-sm font-semibold tabular-nums transition-colors",
                selected
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line-strong text-text-soft hover:border-brand-300",
              ].join(" ")}
            >
              {choice}
            </button>
          );
        })}

        <span className="text-text-faint ml-1 text-xs tabular-nums">of {step.maxMarks}</span>

        {generated && Math.abs(step.suggestedMarks - value) > 0.001 ? (
          <span className="text-text-faint ml-2 inline-flex items-center gap-1 text-xs">
            <Check className="size-3" />
            suggested {step.suggestedMarks}
          </span>
        ) : null}
      </div>
    </li>
  );
}
