"use client";

import {
  difficultySchema,
  PRACTICE_COUNT_MAX,
  questionTypeSchema,
  type ChapterSummary,
  type Difficulty,
  type PastPaperYearOption,
  type PracticeFilters,
  type QuestionType,
  type SubjectDetail,
} from "@samjho/contracts";
import { DIFFICULTY_LABELS, QUESTION_TYPE_LABELS } from "@samjho/ui";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/form";
import { Toggle } from "@/components/ui/surface";

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
 *
 * ## Why picking a year changes the mode
 *
 * The year chips are labelled "previous-year papers", so a student picking 2024
 * is asking for what the board actually set that year — not for anything that
 * happens to carry a 2024 date, which is what a bare year filter means and would
 * include questions adapted from a paper rather than taken from one. So a
 * selected year submits as `PREVIOUS_YEAR` rather than `CUSTOM`, and the year
 * narrows that pool instead of replacing its definition.
 *
 * The row is absent entirely for a subject with no board questions yet. A chip
 * that produces an empty set reads as a broken feature rather than as a bank
 * that has not reached 2009 — which is why the years come from the API with
 * their counts, rather than being generated from a range here.
 */

const TYPES = questionTypeSchema.options;
const DIFFICULTIES = difficultySchema.options;
const COUNTS = [5, 10, 20, 30];

export function PracticeSetup({
  subjects,
  yearsBySubject,
  initial,
}: {
  subjects: SubjectDetail[];
  /** Previous-year options per subject id, loaded server-side with the subjects. */
  yearsBySubject: Record<string, PastPaperYearOption[]>;
  initial: PracticeFilters & { count?: number };
}) {
  const { start, busy, message } = useStartPractice();

  const [subjectId, setSubjectId] = useState(initial.subjectId ?? subjects[0]?.id ?? "");
  const [chapterId, setChapterId] = useState(initial.chapterId ?? "");
  const [types, setTypes] = useState<QuestionType[]>(initial.types ?? []);
  const [difficulties, setDifficulties] = useState<Difficulty[]>(initial.difficulties ?? []);
  const [years, setYears] = useState<number[]>(initial.years ?? []);
  const [unseenOnly, setUnseenOnly] = useState(initial.unseenOnly);
  const [count, setCount] = useState(initial.count ?? 10);

  const subject = useMemo(
    () => subjects.find((candidate) => candidate.id === subjectId),
    [subjectId, subjects],
  );

  const chapters: ChapterSummary[] = subject?.chapters ?? [];
  const yearOptions = yearsBySubject[subjectId] ?? [];

  return (
    <form
      className="flex flex-col gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        void start({
          // See the note above: a chosen year means "what the board set", which
          // is the previous-year pool narrowed, not a date filter over the bank.
          mode: years.length > 0 ? "PREVIOUS_YEAR" : "CUSTOM",
          count,
          filters: {
            unseenOnly,
            ...(subjectId ? { subjectId } : {}),
            ...(chapterId ? { chapterId } : {}),
            ...(types.length ? { types } : {}),
            ...(difficulties.length ? { difficulties } : {}),
            ...(years.length ? { years } : {}),
            // The topic filter is deliberately absent from this form. A student
            // choosing a topic already came from a chapter page, and that link
            // carries `topicId` in the query string — a topic dropdown here
            // would be a third level of nesting for a choice nobody makes cold.
            ...(initial.topicId ? { topicId: initial.topicId } : {}),
          },
        });
      }}
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Subject">
          <select
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value);
              // A chapter from the old subject would silently match nothing.
              setChapterId("");
            }}
            className={selectClass}
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
              className={selectClass}
            >
              <option value="">Any chapter</option>
              {chapters.map((chapter) => (
                <option key={chapter.id} value={chapter.id} disabled={chapter.questionCount === 0}>
                  {chapter.name} ({chapter.questionCount})
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="bg-raised text-text-faint rounded-control flex min-h-11 items-center px-3.5 text-sm">
            Choose a subject to narrow to a chapter.
          </div>
        )}
      </div>

      {yearOptions.length > 0 ? (
        <Field label="Previous-year papers">
          <ChipGroup
            options={yearOptions.map((option) => ({
              value: option.year,
              label: `${String(option.year)} (${String(option.questionCount)})`,
            }))}
            selected={years}
            onToggle={(value) => {
              setYears(toggle(years, value));
            }}
            emptyHint="Any year"
          />
        </Field>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Field label="Question types">
          <ChipGroup
            options={TYPES.map((type) => ({ value: type, label: QUESTION_TYPE_LABELS[type] }))}
            selected={types}
            onToggle={(value) => {
              setTypes(toggle(types, value));
            }}
            emptyHint="All types"
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
            emptyHint="All levels"
          />
        </Field>
      </div>

      <Field label="How many questions">
        <div className="flex flex-wrap gap-2">
          {COUNTS.filter((option) => option <= PRACTICE_COUNT_MAX).map((option) => (
            <Toggle
              key={option}
              selected={count === option}
              onClick={() => {
                setCount(option);
              }}
            >
              {option} questions
            </Toggle>
          ))}
        </div>
      </Field>

      <label className="rounded-control border-line bg-raised/55 hover:border-brand-300 flex cursor-pointer items-start gap-3 border p-4 text-sm transition-colors">
        <input
          type="checkbox"
          checked={unseenOnly}
          onChange={(event) => {
            setUnseenOnly(event.target.checked);
          }}
          className="accent-brand-500 mt-0.5 size-4"
        />
        <span>
          <span className="text-text block font-medium">
            Prioritise questions I haven&rsquo;t seen
          </span>
          <span className="text-text-soft mt-0.5 block text-xs leading-relaxed">
            Off by default — meeting a question again after getting it wrong is how it sticks.
          </span>
        </span>
      </label>

      <div className="border-line flex flex-wrap items-center gap-3 border-t pt-6">
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

function ChipGroup<T extends string | number>({
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
      {selected.length === 0 ? (
        <span className="bg-raised text-text-faint rounded-pill px-3 py-1.5 text-xs font-medium">
          {emptyHint}
        </span>
      ) : null}

      {options.map((option) => {
        const isSelected = selected.includes(option.value);
        return (
          <Toggle
            key={String(option.value)}
            selected={isSelected}
            onClick={() => {
              onToggle(option.value);
            }}
          >
            {option.label}
          </Toggle>
        );
      })}
    </div>
  );
}

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}
