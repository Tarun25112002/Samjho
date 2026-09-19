"use client";

import {
  draftedQuestionsSchema,
  importResultSchema,
  type AdminChapter,
  type AuthorableType,
  type Difficulty,
  type DraftedQuestions,
  type ImportResult,
} from "@medhavi/contracts";
import { DIFFICULTY_LABELS, MathText, QUESTION_TYPE_LABELS } from "@medhavi/ui";
import { useState } from "react";

import { SparkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/surface";
import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * Commissioning questions, and reading what came back.
 *
 * ## Two buttons, and the gap between them is the feature
 *
 * "Draft these" calls a model and writes nothing. "Add the valid ones as
 * drafts" calls the import endpoint an editor already had. Between the two sits
 * the thing that makes this safe to ship: every row rendered in full, with the
 * answer, the solution and the marking scheme visible, and the ordinary import
 * report saying which of them a hand-typed question would have been rejected
 * for.
 *
 * An editor who does not read them can still press the second button. That is
 * true of the paste-a-file import too, and the answer is the same in both
 * cases: they land as DRAFT and nothing reaches a student until somebody
 * publishes them.
 *
 * ## Why invalid rows are shown rather than hidden
 *
 * Because "three of six were rejected" is the most informative thing on the
 * page. It tells the editor the brief was wrong — a 3-mark question asked for
 * with no scheme, a type the topic does not suit — far faster than reading
 * three good questions would.
 */
export function DraftWithAI({
  subjectId,
  chapters,
}: {
  subjectId: string;
  chapters: AdminChapter[];
}) {
  const [chapterSlug, setChapterSlug] = useState(chapters[0]?.slug ?? "");
  const [topicSlugs, setTopicSlugs] = useState<string[]>(
    chapters[0]?.topics[0] ? [chapters[0].topics[0].slug] : [],
  );
  const [type, setType] = useState<AuthorableType>("MCQ");
  const [difficulty, setDifficulty] = useState<Difficulty>("MEDIUM");
  const [marks, setMarks] = useState(1);
  const [count, setCount] = useState(3);
  const [notes, setNotes] = useState("");

  const [drafting, setDrafting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<DraftedQuestions | null>(null);
  const [imported, setImported] = useState<ImportResult | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);

  const chapter = chapters.find((row) => row.slug === chapterSlug);

  function chooseChapter(slug: string): void {
    setChapterSlug(slug);
    const next = chapters.find((row) => row.slug === slug);
    setTopicSlugs(next?.topics[0] ? [next.topics[0].slug] : []);
    setResult(null);
    setImported(null);
  }

  function toggleTopic(slug: string): void {
    setTopicSlugs((current) =>
      current.includes(slug)
        ? current.filter((row) => row !== slug)
        : [...current, slug].slice(0, 3),
    );
  }

  async function draft(): Promise<void> {
    setDrafting(true);
    setFailure(null);
    setImported(null);
    setResult(null);

    const response = await sendJson(
      "POST",
      "/api/v1/admin/questions/ai-draft",
      {
        subjectId,
        chapter: chapterSlug,
        topics: topicSlugs,
        type,
        difficulty,
        marks,
        count,
        notes: notes.trim() === "" ? null : notes.trim(),
      },
      draftedQuestionsSchema,
    );

    setDrafting(false);

    if (!response.ok) {
      setFailure(response.failure);
      return;
    }

    setResult(response.data);
  }

  async function keepValid(): Promise<void> {
    if (!result) return;

    // Only the rows the validator passed. Sending a rejected one would fail the
    // whole import — it is all-or-nothing by design — and the editor would be
    // left with a report instead of the four good questions they could see.
    const rejected = new Set(result.validation.errors.map((error) => error.row));
    const rows = result.rows.filter((_, index) => !rejected.has(index));
    if (rows.length === 0) return;

    setImporting(true);
    setFailure(null);

    const response = await sendJson(
      "POST",
      "/api/v1/admin/questions/import",
      { subjectId, dryRun: false, status: "DRAFT", rows },
      importResultSchema,
    );

    setImporting(false);

    if (!response.ok) {
      setFailure(response.failure);
      return;
    }

    setImported(response.data);
    setResult(null);
  }

  const validCount = result ? result.rows.length - result.validation.errors.length : 0;

  return (
    <Card as="section">
      <div className="flex flex-wrap items-center gap-2">
        <SparkIcon className="text-brand-600 size-5" />
        <h2 className="text-text text-base font-semibold">Draft questions with Medhavi</h2>
      </div>

      <p className="text-text-faint mt-2 text-sm leading-relaxed">
        Written fresh against the syllabus, never copied from a paper, and recorded as original.
        Nothing is saved until you add it, and what you add lands as a draft for review like
        anything else.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Chapter">
          <select
            className="border-line-strong rounded-control text-text h-11 w-full border px-3 text-sm"
            value={chapterSlug}
            onChange={(event) => {
              chooseChapter(event.target.value);
            }}
          >
            {chapters.map((row) => (
              <option key={row.id} value={row.slug}>
                {row.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Type">
          <select
            className="border-line-strong rounded-control text-text h-11 w-full border px-3 text-sm"
            value={type}
            onChange={(event) => {
              setType(event.target.value as AuthorableType);
            }}
          >
            {AUTHORABLE.map((row) => (
              <option key={row} value={row}>
                {QUESTION_TYPE_LABELS[row]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Difficulty">
          <select
            className="border-line-strong rounded-control text-text h-11 w-full border px-3 text-sm"
            value={difficulty}
            onChange={(event) => {
              setDifficulty(event.target.value as Difficulty);
            }}
          >
            {(["EASY", "MEDIUM", "HARD"] as const).map((row) => (
              <option key={row} value={row}>
                {DIFFICULTY_LABELS[row]}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Marks each">
            <NumberField value={marks} min={1} max={20} onChange={setMarks} />
          </Field>
          <Field label="How many">
            <NumberField value={count} min={1} max={6} onChange={setCount} />
          </Field>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-text-soft text-sm font-medium">
          Topics <span className="text-text-faint">— the first one is the primary</span>
        </legend>

        <div className="mt-2 flex flex-wrap gap-2">
          {(chapter?.topics ?? []).map((topic) => {
            const selected = topicSlugs.includes(topic.slug);

            return (
              <button
                key={topic.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  toggleTopic(topic.slug);
                }}
                className={[
                  "rounded-control h-11 border px-3 text-sm font-medium transition-colors",
                  selected
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-line-strong text-text-soft hover:border-brand-300",
                ].join(" ")}
              >
                {topic.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Anything else? (optional)" className="mt-4">
        <textarea
          rows={2}
          className="border-line-strong rounded-control text-text w-full border px-3 py-2 text-sm"
          placeholder="Use real-world contexts. Avoid questions about circles."
          value={notes}
          onChange={(event) => {
            setNotes(event.target.value);
          }}
        />
      </Field>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button disabled={drafting || topicSlugs.length === 0} onClick={() => void draft()}>
          <SparkIcon className="size-4" />
          {drafting ? "Writing…" : "Draft these"}
        </Button>
        {topicSlugs.length === 0 ? (
          <p className="text-text-faint text-sm">Pick at least one topic.</p>
        ) : null}
      </div>

      {failure ? (
        <p role="alert" className="text-marker-700 mt-3 text-sm">
          {failure.message}
        </p>
      ) : null}

      {imported ? (
        <p className="rounded-control border-tick-200 bg-tick-50 text-tick-700 mt-4 border px-3 py-2 text-sm">
          {imported.written} added as drafts. They are in the question list, unpublished.
        </p>
      ) : null}

      {result ? (
        <DraftReview
          result={result}
          validCount={validCount}
          importing={importing}
          onKeep={() => void keepValid()}
        />
      ) : null}
    </Card>
  );
}

const AUTHORABLE = [
  "MCQ",
  "ASSERTION_REASON",
  "VERY_SHORT_ANSWER",
  "SHORT_ANSWER",
  "LONG_ANSWER",
] as const satisfies readonly AuthorableType[];

function DraftReview({
  result,
  validCount,
  importing,
  onKeep,
}: {
  result: DraftedQuestions;
  validCount: number;
  importing: boolean;
  onKeep: () => void;
}) {
  if (!result.generated) {
    return (
      <p className="text-text-faint mt-4 text-sm">
        Nothing came back. Medhavi could not write these just now — the brief is still here, so try
        again in a moment.
      </p>
    );
  }

  const errorsByRow = new Map(result.validation.errors.map((error) => [error.row, error]));

  return (
    <div className="border-line mt-5 border-t pt-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-text text-sm font-semibold">
          {validCount} of {result.rows.length} would import cleanly
        </p>
        {result.validation.errors.length > 0 ? (
          <Chip tone="partial">{result.validation.errors.length} rejected</Chip>
        ) : null}
      </div>

      {result.caveat ? (
        <p className="text-text-faint mt-2 text-xs leading-relaxed">{result.caveat}</p>
      ) : null}

      <ol className="mt-4 flex flex-col gap-4">
        {result.rows.map((row, index) => (
          <DraftRow key={index} row={row} error={errorsByRow.get(index)} />
        ))}
      </ol>

      <div className="mt-5">
        <Button disabled={importing || validCount === 0} onClick={onKeep}>
          {importing ? "Adding…" : `Add the ${validCount} valid ones as drafts`}
        </Button>
      </div>
    </div>
  );
}

/**
 * One drafted question, shown whole.
 *
 * Including the answer, the solution and the marking scheme, because the answer
 * is the part that is wrong when one of these is wrong. A review UI that showed
 * only the question would be a review of the half that is easy to get right.
 */
function DraftRow({
  row,
  error,
}: {
  row: Record<string, unknown>;
  error: { issues: Array<{ path: string; message: string }> } | undefined;
}) {
  const body = typeof row.body === "string" ? row.body : "";
  const options = Array.isArray(row.options) ? row.options : [];
  const answer = (row.answer ?? {}) as {
    correctValue?: string | null;
    solution?: string;
    markingScheme?: Array<{ step: string; marks: number }> | null;
  };

  return (
    <li
      className={[
        "rounded-control border p-4",
        error ? "border-marker-200 bg-marker-50" : "border-line",
      ].join(" ")}
    >
      <MathText className="text-text block text-sm leading-relaxed">{body}</MathText>

      {options.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1">
          {options.map((option, index) => {
            const row_ = option as { label?: string; body?: string; isCorrect?: boolean };

            return (
              <li key={index} className="flex gap-2 text-sm">
                <span
                  className={row_.isCorrect ? "text-tick-700 font-semibold" : "text-text-faint"}
                >
                  {row_.label}.
                </span>
                <MathText className="text-text-soft">{row_.body ?? ""}</MathText>
                {row_.isCorrect ? <span className="text-tick-700 text-xs">correct</span> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {answer.correctValue ? (
        <p className="text-text-soft mt-3 text-sm">
          <span className="text-text-faint">Answer: </span>
          {answer.correctValue}
        </p>
      ) : null}

      {answer.solution ? (
        <MathText className="text-text-soft border-line mt-3 block border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
          {answer.solution}
        </MathText>
      ) : null}

      {answer.markingScheme && answer.markingScheme.length > 0 ? (
        <ol className="text-text-faint mt-3 flex flex-col gap-1 text-xs">
          {answer.markingScheme.map((step, index) => (
            <li key={index}>
              {step.step} — {step.marks} mark(s)
            </li>
          ))}
        </ol>
      ) : null}

      {error ? (
        <ul className="text-marker-700 mt-3 flex flex-col gap-1 text-xs">
          {error.issues.map((issue, index) => (
            <li key={index}>
              <span className="font-semibold">{issue.path}</span>: {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={["flex flex-col gap-1.5", className].filter(Boolean).join(" ")}>
      <span className="text-text-soft text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value}
      className="border-line-strong rounded-control text-text h-11 w-full border px-3 text-sm tabular-nums"
      onChange={(event) => {
        const next = Number.parseInt(event.target.value, 10);
        if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
      }}
    />
  );
}
