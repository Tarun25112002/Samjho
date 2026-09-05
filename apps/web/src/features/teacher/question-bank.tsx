"use client";

import {
  teacherQuestionStatusSchema,
  type TeacherBankResponse,
  type TeacherBankQuestion,
} from "@samjho/contracts";
import { MathText } from "@samjho/ui";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * The teacher's own question bank, filtered.
 *
 * ## Why the filters live in the URL
 *
 * Because a filtered view is a thing a teacher wants to come back to, send to a
 * colleague, or reach with the back button after opening a question. Filter
 * state in `useState` is state that vanishes on every navigation and cannot be
 * linked to; in the query string it is free to share and the server component
 * above can read it and fetch the right page directly — so the first paint is
 * already filtered, rather than showing everything and then narrowing.
 *
 * ## Why every filter shows its count
 *
 * A filter that cannot say "Hard (12)" before you press it makes a teacher try
 * every combination to find out which ones have anything behind them. The
 * counts come back with the page, from `facets` — each one computed with the
 * *other* filters applied but not its own, so switching from Hard to Easy shows
 * what Easy would actually give you rather than a row of zeroes.
 */
export function QuestionBank({
  data,
  chapters,
  subjects,
}: {
  data: TeacherBankResponse;
  chapters: { id: string; name: string }[];
  subjects: { id: string; name: string; code: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  function setParam(key: string, value: string | null): void {
    const next = new URLSearchParams(params.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    // The cursor belongs to the previous filter combination. Carrying it over
    // pages into the middle of a different result set, which reads as missing
    // questions.
    next.delete("cursor");
    router.push(`/teacher/questions${next.toString() ? `?${next.toString()}` : ""}`);
  }

  const activeDifficulty = params.get("difficulty");
  const activeChapter = params.get("chapterId");
  const activeMarks = params.get("marks");

  return (
    <div className="flex flex-col gap-6">
      <div className="border-line bg-card rounded-panel flex flex-col gap-4 border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-text-soft flex items-center gap-2 text-sm">
            Subject
            <select
              value={params.get("subjectId") ?? ""}
              onChange={(event) => setParam("subjectId", event.target.value || null)}
              className={filterInput}
            >
              <option value="">All subjects</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-text-soft flex items-center gap-2 text-sm">
            Chapter
            <select
              value={activeChapter ?? ""}
              onChange={(event) => setParam("chapterId", event.target.value || null)}
              className={filterInput}
            >
              <option value="">All chapters</option>
              {chapters.map((chapter) => {
                const count = data.facets.byChapter.find(
                  (facet) => facet.chapterId === chapter.id,
                )?.count;
                return (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.name}
                    {count === undefined ? "" : ` (${String(count)})`}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="text-text-soft flex items-center gap-2 text-sm">
            Status
            <select
              value={params.get("status") ?? ""}
              onChange={(event) => setParam("status", event.target.value || null)}
              className={filterInput}
            >
              <option value="">Any</option>
              <option value="PUBLISHED">Set for students</option>
              <option value="DRAFT">Not set yet</option>
              <option value="ARCHIVED">Withdrawn</option>
            </select>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-text-faint text-xs font-bold tracking-[0.1em] uppercase">
            Difficulty
          </span>
          <Chip active={activeDifficulty === null} onClick={() => setParam("difficulty", null)}>
            Any {data.facets.total}
          </Chip>
          {data.facets.byDifficulty.map((facet) => (
            <Chip
              key={facet.difficulty}
              active={activeDifficulty === facet.difficulty}
              onClick={() =>
                setParam(
                  "difficulty",
                  activeDifficulty === facet.difficulty ? null : facet.difficulty,
                )
              }
            >
              {LABELS[facet.difficulty]} {facet.count}
            </Chip>
          ))}
        </div>

        {data.facets.byMarks.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-text-faint text-xs font-bold tracking-[0.1em] uppercase">
              Marks
            </span>
            <Chip active={activeMarks === null} onClick={() => setParam("marks", null)}>
              Any
            </Chip>
            {data.facets.byMarks.map((facet) => (
              <Chip
                key={facet.marks}
                active={activeMarks === String(facet.marks)}
                onClick={() =>
                  setParam(
                    "marks",
                    activeMarks === String(facet.marks) ? null : String(facet.marks),
                  )
                }
              >
                {facet.marks} {facet.count > 0 ? `· ${String(facet.count)}` : ""}
              </Chip>
            ))}
          </div>
        ) : null}
      </div>

      {data.items.length === 0 ? (
        <Empty filtered={params.toString().length > 0} />
      ) : (
        <ul className="flex flex-col gap-3">
          {data.items.map((question) => (
            <QuestionRow key={question.id} question={question} />
          ))}
        </ul>
      )}

      {data.pageInfo.hasMore && data.pageInfo.nextCursor ? (
        <div className="flex justify-center">
          <Button variant="secondary" onClick={() => setParam("cursor", data.pageInfo.nextCursor)}>
            Show more
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function QuestionRow({ question }: { question: TeacherBankQuestion }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: "PUBLISHED" | "DRAFT"): Promise<void> {
    const parsed = teacherQuestionStatusSchema.safeParse({ status });
    if (!parsed.success) return;

    setBusy(true);
    setError(null);

    const result = await sendJson(
      "PUT",
      `/api/v1/teacher/questions/${encodeURIComponent(question.id)}/status`,
      parsed.data,
      teacherQuestionStatusSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setError(result.failure.message);
      return;
    }

    router.refresh();
  }

  return (
    <li className="border-line bg-card rounded-panel border p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-text-faint flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className={DIFFICULTY_TONE[question.difficulty]}>
              {LABELS[question.difficulty]}
            </span>
            <span>·</span>
            <span>{question.chapter.name}</span>
            <span>·</span>
            <span>
              {question.marks} {question.marks === 1 ? "mark" : "marks"}
            </span>
            <span>·</span>
            <span>{question.type.replaceAll("_", " ").toLowerCase()}</span>
            {question.subPartCount > 0 ? <span>· {question.subPartCount} parts</span> : null}
          </div>

          <div className="text-text mt-2 line-clamp-3 text-sm leading-relaxed">
            <MathText>{question.body}</MathText>
          </div>

          {!question.hasAnswer && question.subPartCount === 0 ? (
            <p className="text-marker-700 mt-2 text-xs">
              No solution yet — cannot be set for students until it has one.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {question.status === "PUBLISHED" ? (
            <>
              <span className="rounded-pill bg-brand-100 text-brand-700 px-3 py-1.5 text-xs font-bold">
                Set for students
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void setStatus("DRAFT")}
                className="text-text-faint hover:text-text text-sm font-semibold"
              >
                Withdraw
              </button>
            </>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => void setStatus("PUBLISHED")}
            >
              Set for students
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-marker-700 mt-3 text-sm">
          {error}
        </p>
      ) : null}
    </li>
  );
}

function Empty({ filtered }: { filtered: boolean }) {
  return (
    <section className="border-line bg-card rounded-panel border p-7 text-center">
      <p className="text-text font-semibold">
        {filtered ? "Nothing matches those filters." : "Your bank is empty."}
      </p>
      <p className="text-text-soft mx-auto mt-2 max-w-md text-sm leading-relaxed">
        {filtered
          ? "Widen the filters, or upload another paper to fill the gap."
          : "Upload a question paper and Samjho pulls the questions out of it, sorted by chapter and difficulty."}
      </p>
    </section>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-pill min-h-11 px-4 text-sm font-semibold transition-colors",
        active ? "bg-brand-500 text-on-brand" : "bg-raised text-text-soft hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

const LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" } as const;

const DIFFICULTY_TONE = {
  EASY: "text-text-faint",
  MEDIUM: "text-text-soft",
  HARD: "text-marker-700",
} as const;

const filterInput =
  "border-line bg-card text-text rounded-control min-h-11 border px-3 text-sm outline-none focus:border-brand-500";
