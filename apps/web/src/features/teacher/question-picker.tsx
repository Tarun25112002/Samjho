"use client";

import {
  CURATED_ASSIGNMENT_MAX,
  teacherBankResponseSchema,
  type TeacherBankFacets,
  type TeacherBankQuestion,
  type PastPaperYearOption,
} from "@samjho/contracts";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/surface";

/**
 * Picking questions, chapter by chapter, to build a test.
 *
 * ## What this replaces
 *
 * Before this existed, a teacher setting work chose a chapter and a number, and
 * the selector drew a random set *per student*. That is right for homework and
 * wrong for a test, for a reason that has nothing to do with engineering: if
 * every student sat different questions, their marks are not comparable and the
 * item analysis on the report page is arithmetic performed on nothing.
 *
 * It was also the only option. A teacher could draw from Samjho's bank without
 * ever seeing what was in it, and could only *browse* questions they had
 * personally scanned and imported. The reviewed, chapter-tagged, previous-year
 * collection sat in the same database being served to their students, and the
 * teacher was the one person in the product who could not look at it.
 *
 * ## The two banks are one list with a switch
 *
 * `scope` toggles between Samjho's reviewed bank and the teacher's own imports,
 * and a picked set may mix the two — which is what building a paper actually
 * looks like. The server decides what each scope means; this component only
 * names which one it wants.
 *
 * ## No answers here
 *
 * `TeacherBankQuestion` carries `hasAnswer`, a boolean, and there is no field on
 * it that could hold a solution. That is deliberate rather than incidental: this
 * is a browsing surface, and shipping every marking scheme in order to render a
 * table of stems would be a large payload to display none of.
 */
export function QuestionPicker({
  subjectId,
  chapters,
  pastPaperYears,
  selected,
  onChange,
}: {
  subjectId: string;
  chapters: { id: string; name: string }[];
  /** Only years with published CBSE questions, loaded by the server. */
  pastPaperYears: PastPaperYearOption[];
  selected: TeacherBankQuestion[];
  onChange: (selected: TeacherBankQuestion[]) => void;
}) {
  const [scope, setScope] = useState<"SHARED" | "MINE">("SHARED");
  const [chapterId, setChapterId] = useState("");
  const [marks, setMarks] = useState("");
  const [previousYearOnly, setPreviousYearOnly] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [items, setItems] = useState<TeacherBankQuestion[]>([]);
  const [facets, setFacets] = useState<TeacherBankFacets | null>(null);
  const [pageInfo, setPageInfo] = useState({ hasMore: false, nextCursor: null as string | null });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const load = useCallback(
    async (cursor: string | null = null) => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      setMessage(null);
      if (cursor === null) {
        // Do not leave rows from an old chapter or paper year clickable while the
        // new query is in flight. Selection stays intact above the list, but the
        // browse surface must always describe its current filters.
        setItems([]);
        setFacets(null);
        setPageInfo({ hasMore: false, nextCursor: null });
      }

      const params = new URLSearchParams({ scope, subjectId, limit: "50" });
      if (chapterId) params.set("chapterId", chapterId);
      if (marks) params.set("marks", marks);
      // A raw `years` filter is not synonymous with a PYQ filter: an original or
      // adapted item can also carry a year. Keep the two clauses coupled so a
      // teacher who presses “2024” gets CBSE 2024 questions, never a coincidental
      // question with 2024 in its provenance.
      if (scope === "SHARED" && previousYearOnly) {
        params.set("previousYearOnly", "true");
        if (selectedYears.length > 0) params.set("years", selectedYears.join(","));
      }
      if (cursor) params.set("cursor", cursor);

      try {
        const response = await fetch(`/api/v1/teacher/questions?${params.toString()}`);
        const payload: unknown = await response.json();

        if (requestId !== requestIdRef.current) return;

        if (!response.ok) {
          setMessage("Could not load the question bank. Try again.");
          return;
        }

        const parsed = teacherBankResponseSchema.safeParse((payload as { data?: unknown }).data);
        if (!parsed.success) {
          setMessage("The question bank replied in an unexpected format.");
          return;
        }

        setItems((current) =>
          cursor === null
            ? parsed.data.items
            : [
                ...current,
                ...parsed.data.items.filter((item) => !current.some((row) => row.id === item.id)),
              ],
        );
        setFacets(parsed.data.facets);
        setPageInfo(parsed.data.pageInfo);
      } catch {
        if (requestId === requestIdRef.current) {
          setMessage("Could not reach Samjho. Check your connection.");
        }
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    },
    [scope, subjectId, chapterId, marks, previousYearOnly, selectedYears],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // A classroom subject normally does not change while this component is
  // mounted, but this makes a reused picker safe when it does: never keep a
  // selected year that is unavailable for the new subject.
  useEffect(() => {
    const available = new Set(pastPaperYears.map((paper) => paper.year));
    setSelectedYears((current) => {
      const next = current.filter((year) => available.has(year));
      return next.length === current.length ? current : next;
    });
  }, [pastPaperYears]);

  const selectedIds = new Set(selected.map((question) => question.id));
  const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);
  const atCeiling = selected.length >= CURATED_ASSIGNMENT_MAX;

  function toggle(question: TeacherBankQuestion): void {
    if (selectedIds.has(question.id)) {
      onChange(selected.filter((picked) => picked.id !== question.id));
      return;
    }

    // Appending rather than inserting in list order: the order a teacher picks
    // in becomes the order of the paper, and re-sorting their choices would take
    // away the one editorial decision this screen exists to let them make.
    if (!atCeiling) onChange([...selected, question]);
  }

  function changeScope(nextScope: "SHARED" | "MINE"): void {
    setScope(nextScope);
    // PYQs live in the reviewed shared bank. Carrying a hidden year filter into
    // “My imported papers” would look like an empty personal bank, not like a
    // source change.
    if (nextScope === "MINE") {
      setPreviousYearOnly(false);
      setSelectedYears([]);
    }
  }

  function toggleYear(year: number): void {
    setSelectedYears((current) =>
      current.includes(year)
        ? current.filter((pickedYear) => pickedYear !== year)
        : [...current, year],
    );
  }

  return (
    <div className="border-line bg-card rounded-control mt-3 border p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-text-faint text-xs font-medium">Bank</span>
          <select
            value={scope}
            onChange={(event) => changeScope(event.target.value === "MINE" ? "MINE" : "SHARED")}
            className={selectClass}
          >
            <option value="SHARED">Samjho&rsquo;s reviewed bank</option>
            <option value="MINE">My imported papers</option>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-text-faint text-xs font-medium">Chapter</span>
          <select
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            className={selectClass}
          >
            <option value="">All chapters</option>
            {chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>
                {chapter.name}
                {/*
                  The count beside each option is what makes this filter usable
                  rather than a guessing game — a teacher should not have to
                  select a chapter to discover it is empty.
                */}
                {countFor(facets, chapter.id) === null
                  ? ""
                  : ` (${String(countFor(facets, chapter.id) ?? 0)})`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-text-faint text-xs font-medium">Marks</span>
          <select
            value={marks}
            onChange={(event) => setMarks(event.target.value)}
            className={selectClass}
          >
            <option value="">Any</option>
            {(facets?.byMarks ?? []).map((row) => (
              <option key={row.marks} value={String(row.marks)}>
                {row.marks} mark{row.marks === 1 ? "" : "s"} ({row.count})
              </option>
            ))}
          </select>
        </label>

        {scope === "SHARED" ? (
          <label className="text-text-soft flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={previousYearOnly}
              disabled={pastPaperYears.length === 0}
              onChange={(event) => {
                const next = event.target.checked;
                setPreviousYearOnly(next);
                if (!next) setSelectedYears([]);
              }}
              className="size-4"
            />
            CBSE PYQs only
          </label>
        ) : null}
      </div>

      {scope === "SHARED" && pastPaperYears.length === 0 ? (
        <p role="status" className="text-text-faint mt-3 text-xs leading-relaxed">
          No published CBSE PYQs are available for this subject yet. They will appear here after
          editorial review.
        </p>
      ) : null}

      {scope === "SHARED" && previousYearOnly && pastPaperYears.length > 0 ? (
        <fieldset className="border-line bg-raised/50 rounded-control mt-3 border p-3">
          <legend className="text-text px-1 text-xs font-semibold">Narrow by paper year</legend>
          <p className="text-text-faint mb-2 text-xs leading-relaxed">
            Leave every year unselected to browse all available PYQs, or choose one or more years to
            build a focused paper.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={selectedYears.length === 0}
              onClick={() => setSelectedYears([])}
              className={yearChipClass(selectedYears.length === 0)}
            >
              All available
            </button>
            {pastPaperYears.map((paper) => {
              const active = selectedYears.includes(paper.year);
              return (
                <button
                  key={paper.year}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleYear(paper.year)}
                  className={yearChipClass(active)}
                >
                  {String(paper.year)}
                  <span className="text-text-faint ml-1 font-normal">
                    {String(paper.questionCount)}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="border-line mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
        <p className="text-text-soft text-sm">
          <strong className="text-text font-semibold tabular-nums">{selected.length}</strong> picked
          · {totalMarks} mark{totalMarks === 1 ? "" : "s"}
          {atCeiling ? ` · ${String(CURATED_ASSIGNMENT_MAX)} is the most a test can hold` : ""}
        </p>
        {selected.length > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              onChange([]);
            }}
          >
            Clear
          </Button>
        ) : null}
      </div>

      {message ? (
        <p role="status" className="text-text-soft mt-3 text-sm">
          {message}
        </p>
      ) : null}

      <ul className="mt-3 flex max-h-96 flex-col gap-2 overflow-y-auto pr-1">
        {loading && items.length === 0 ? (
          <li className="text-text-faint py-6 text-center text-sm">Loading questions…</li>
        ) : items.length === 0 ? (
          <li className="text-text-soft py-6 text-center text-sm">
            {scope === "MINE"
              ? "You have not published any questions matching this yet. Import a paper from Papers first."
              : "Nothing in Samjho's bank matches this filter yet."}
          </li>
        ) : (
          items.map((question) => {
            const picked = selectedIds.has(question.id);

            return (
              <li key={question.id}>
                <button
                  type="button"
                  aria-pressed={picked}
                  disabled={!picked && atCeiling}
                  onClick={() => {
                    toggle(question);
                  }}
                  className={[
                    "rounded-control w-full border p-3 text-left transition-colors",
                    picked
                      ? "border-brand-300 bg-brand-50"
                      : "border-line hover:border-brand-300 disabled:opacity-50",
                  ].join(" ")}
                >
                  <span className="flex items-baseline justify-between gap-3">
                    {/*
                      Clamped to two lines. The stem may hold LaTeX, which is not
                      typeset here on purpose: this is a list to scan, and twelve
                      rendered formulas is a wall rather than a list.
                    */}
                    <span className="text-text line-clamp-2 min-w-0 text-sm leading-relaxed">
                      {question.body}
                    </span>
                    <span className="text-text-faint shrink-0 text-xs tabular-nums">
                      {question.marks}m
                    </span>
                  </span>

                  <span className="mt-2 flex flex-wrap items-center gap-1.5">
                    {scope === "SHARED" && previousYearOnly ? (
                      <Chip tone="brand">CBSE PYQ</Chip>
                    ) : null}
                    <Chip tone="neutral">{question.chapter.name}</Chip>
                    <Chip tone="neutral">{question.difficulty.toLowerCase()}</Chip>
                    {question.subPartCount > 0 ? (
                      <Chip tone="neutral">{question.subPartCount} parts</Chip>
                    ) : null}
                    {question.sourceTitle ? (
                      <span className="text-text-faint truncate text-xs">
                        {question.sourceTitle}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>

      {pageInfo.hasMore ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={loading || pageInfo.nextCursor === null}
            onClick={() => {
              if (pageInfo.nextCursor !== null) void load(pageInfo.nextCursor);
            }}
          >
            {loading ? "Loading…" : "Show more questions"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function countFor(facets: TeacherBankFacets | null, chapterId: string): number | null {
  if (facets === null) return null;
  return facets.byChapter.find((row) => row.chapterId === chapterId)?.count ?? 0;
}

function yearChipClass(active: boolean): string {
  return [
    "rounded-pill min-h-9 border px-3 text-xs font-semibold tabular-nums transition-colors",
    active
      ? "border-brand-300 bg-brand-50 text-brand-700"
      : "border-line-strong bg-card text-text-soft hover:border-brand-300",
  ].join(" ");
}

const selectClass =
  "rounded-control border-line-strong bg-card text-text min-h-11 border px-3 text-sm";
