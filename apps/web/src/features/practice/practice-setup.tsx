"use client";

import {
  difficultySchema,
  PRACTICE_COUNT_MAX,
  questionTypeSchema,
  type ChapterSummary,
  type Difficulty,
  type PracticeFilters,
  type QuestionType,
  type SubjectDetail,
} from "@samjho/contracts";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@samjho/ui";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";

import { useStartPractice } from "./start-practice";

/**
 * Build a custom set.
 *
 * ## Every control narrows; nothing is required
 *
 * The default is "everything you're studying", and each control removes
 * questions from that. A setup screen that makes a student choose a subject
 * before it will do anything is a setup screen that gets abandoned — docs/00
 * §5's target is two taps from opening the app to answering a question, and this
 * page is the one most at risk of eating them.
 *
 * ## Why the counts are on the chapters
 *
 * The bank is being written from zero (docs/07 R1), so most chapters are empty
 * most of the time. Showing the count next to each chapter is the difference
 * between "the app is broken" and "that chapter hasn't been written yet" — the
 * student finds out before they press the button rather than after.
 */

const TYPES = questionTypeSchema.options;
const DIFFICULTIES = difficultySchema.options;
const COUNTS = [5, 10, 20, 30];

export function PracticeSetup({
  subjects,
  initial,
}: {
  subjects: SubjectDetail[];
  initial: PracticeFilters & { count?: number };
}) {
  const { start, busy, message } = useStartPractice();

  const [subjectId, setSubjectId] = useState(initial.subjectId ?? subjects[0]?.id ?? "");
  const [chapterId, setChapterId] = useState(initial.chapterId ?? "");
  const [types, setTypes] = useState<QuestionType[]>(initial.types ?? []);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(initial.difficulties ?? []);
  const [unseenOnly, setUnseenOnly] = useState(initial.unseenOnly);
  const [count, setCount] = useState(initial.count ?? 10);

  const subject = useMemo(
    () => subjects.find((candidate) => candidate.id === subjectId),
    [subjectId, subjects],
  );

  const chapters: ChapterSummary[] = subject?.chapters ?? [];

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void start({
          mode: "CUSTOM",
          count,
          filters: {
            unseenOnly,
            ...(subjectId ? { subjectId } : {}),
            ...(chapterId ? { chapterId } : {}),
            ...(types.length ? { types } : {}),
            ...(difficulties.length ? { difficulties } : {}),
            // The topic filter is deliberately absent from this form. A student
            // choosing a topic already came from a chapter page, and that link
            // carries `topicId` in the query string — a topic dropdown here
            // would be a third level of nesting for a choice nobody makes cold.
            ...(initial.topicId ? { topicId: initial.topicId } : {}),
          },
        });
      }}
    >
      <Field label="Subject">
        <select
          value={subjectId}
          onChange={(event) => {
            setSubjectId(event.target.value);
            // A chapter from the old subject would silently match nothing.
            setChapterId("");
          }}
          className="border-line-strong bg-card text-text rounded-control min-h-11 w-full border px-3.5 text-base"
        >
          <option value="">Any subject</option>
          {subjects.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </Field>

      {chapters.length > 0 ? (
        <Field label="Chapter">
          <select
            value={chapterId}
            onChange={(event) => {
              setChapterId(event.target.value);
            }}
            className="border-line-strong bg-card text-text rounded-control min-h-11 w-full border px-3.5 text-base"
          >
            <option value="">Any chapter</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id} disabled={chapter.questionCount === 0}>
                {chapter.name} ({chapter.questionCount})
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Question types">
        <ChipGroup
          options={TYPES.map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] }))}
          selected={types}
          onToggle={(value) => {
            setTypes(toggle(types, value));
          }}
          emptyHint="Any type"
        />
      </Field>

      <Field label="Difficulty">
        <ChipGroup
          options={DIFFICULTIES.map((level) => ({
            value: level,
            label: DIFFICULTY_LABELS[level],
          }))}
          selected={difficulties}
          onToggle={(value) => {
            setDifficulties(toggle(difficulties, value));
          }}
          emptyHint="Any difficulty"
        />
      </Field>

      <Field label="How many questions">
        <div className="flex flex-wrap gap-2">
          {COUNTS.filter((option) => option <= PRACTICE_COUNT_MAX).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={count === option}
              onClick={() => {
                setCount(option);
              }}
              className={[
                "rounded-control min-h-11 border px-5 text-sm font-semibold transition-colors",
                count === option
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-line-strong text-text-soft hover:border-brand-300",
              ].join(" ")}
            >
              {option}
            </button>
          ))}
        </div>
      </Field>

      <label className="rounded-control border-line bg-card flex cursor-pointer items-start gap-3 border p-4 text-sm">
        <input
          type="checkbox"
          checked={unseenOnly}
          onChange={(event) => {
            setUnseenOnly(event.target.checked);
          }}
          className="accent-brand-500 mt-0.5 size-4"
        />
        <span>
          <span className="text-text block font-medium">Only questions I haven&rsquo;t seen</span>
          <span className="text-text-soft mt-0.5 block text-xs leading-relaxed">
            Off by default — meeting a question again after getting it wrong is how it sticks.
          </span>
        </span>
      </label>

      <div>
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "Building your set…" : "Start practising"}
        </Button>

        {message ? (
          <p role="status" className="text-text-soft mt-2 text-sm">
            {message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-text text-sm font-semibold">{label}</span>
      {children}
    </div>
  );
}

function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  emptyHint,
}: {
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (value: T) => void;
  emptyHint: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {selected.length === 0 ? <span className="text-text-faint text-xs">{emptyHint}</span> : null}

      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            onClick={() => {
              onToggle(option.value);
            }}
            className={[
              "rounded-pill min-h-11 border px-3.5 text-sm font-medium transition-colors",
              isSelected
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-line-strong text-text-soft hover:border-brand-300",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}
