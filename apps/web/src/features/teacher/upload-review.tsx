"use client";

import {
  bulkReviewExtractedSchema,
  bulkReviewResultSchema,
  importUploadInputSchema,
  importUploadResultSchema,
  paperUploadDetailSchema,
  updateExtractedQuestionSchema,
  type ExtractedQuestion,
  type ImportUploadResult,
  type PaperUploadDetail,
} from "@samjho/contracts";
import { MathText } from "@samjho/ui";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, selectClass } from "@/components/ui/form";
import { Card, Chip } from "@/components/ui/surface";
import { sendJson } from "@/lib/client-api";

/**
 * Reviewing what the model made of a paper.
 *
 * This screen is the reason the whole feature is trustworthy, so its job is
 * narrow and worth stating: **make the questions most likely to be wrong the
 * ones a teacher sees first, and make correcting them cost one tap.**
 *
 * ## The default sort is by confidence, not by paper order
 *
 * Reading a paper's questions in printed order is what a teacher would do if
 * they were checking all of them, and checking all of them is exactly what this
 * screen exists to avoid. The model is reliable on transcription and unreliable
 * on filing, so the rows worth a human's attention are the ones it flagged.
 * Printed order is one click away for anyone who wants to work through the
 * paper properly.
 *
 * ## Why nothing is accepted by default
 *
 * `PROPOSED` is the model's output and the import reads `ACCEPTED` only. A
 * teacher who opens this screen, changes nothing and presses Import gets
 * nothing — which is correct. Accepting by default would make the review step a
 * formality, and the one paper where it mattered would be the one nobody read.
 * "Accept all" is right there for a teacher who has read the list and is happy.
 */
export function UploadReview({ upload: initial }: { upload: PaperUploadDetail }) {
  const router = useRouter();
  const [upload, setUpload] = useState(initial);
  const [sort, setSort] = useState<"confidence" | "paper">("confidence");
  const [filter, setFilter] = useState<"all" | "PROPOSED" | "ACCEPTED" | "REJECTED">("all");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportUploadResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // The server component re-renders on `router.refresh()`; without this the
  // screen would keep showing the props it first mounted with.
  useEffect(() => {
    setUpload(initial);
  }, [initial]);

  const visible = useMemo(() => {
    const rows = upload.items.filter((item) => filter === "all" || item.status === filter);

    return sort === "paper"
      ? [...rows].sort((left, right) => left.orderIndex - right.orderIndex)
      : [...rows].sort(
          (left, right) =>
            // Nulls first: "the model did not say" is at least as suspect as a
            // low score, and burying it at the bottom hides the rows a teacher
            // most needs to look at.
            (left.confidence ?? -1) - (right.confidence ?? -1) ||
            left.orderIndex - right.orderIndex,
        );
  }, [upload.items, filter, sort]);

  const accepted = upload.items.filter((item) => item.status === "ACCEPTED").length;
  const imported = upload.items.filter((item) => item.status === "IMPORTED").length;
  const pending = upload.items.filter((item) => item.status === "PROPOSED").length;

  async function bulk(itemIds: string[], status: "ACCEPTED" | "REJECTED"): Promise<void> {
    if (itemIds.length === 0) return;

    const parsed = bulkReviewExtractedSchema.safeParse({ itemIds, status });
    if (!parsed.success) return;

    setBusy(true);
    setMessage(null);

    const response = await sendJson(
      "POST",
      `/api/v1/teacher/uploads/${encodeURIComponent(upload.id)}/review`,
      parsed.data,
      bulkReviewResultSchema,
    );
    setBusy(false);

    if (!response.ok) {
      setMessage(response.failure.message);
      return;
    }

    // Applied locally as well as refreshed: a bulk accept over forty rows should
    // land instantly, and waiting for a server round trip to see the state
    // change makes the button feel broken.
    setUpload((current) => ({
      ...current,
      items: current.items.map((item) =>
        itemIds.includes(item.id) && item.status !== "IMPORTED" ? { ...item, status } : item,
      ),
    }));
    router.refresh();
  }

  async function updateItem(itemId: string, patch: Record<string, unknown>): Promise<void> {
    const parsed = updateExtractedQuestionSchema.safeParse(patch);
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "That change could not be applied.");
      return;
    }

    setBusy(true);
    setMessage(null);

    const response = await sendJson(
      "PATCH",
      `/api/v1/teacher/uploads/${encodeURIComponent(upload.id)}/items/${encodeURIComponent(itemId)}`,
      parsed.data,
      paperUploadDetailSchema,
    );
    setBusy(false);

    if (!response.ok) {
      setMessage(response.failure.message);
      return;
    }

    // The endpoint answers with the whole upload, so one round trip both applies
    // the change and re-syncs everything else a teacher may have changed in
    // another tab.
    setUpload(response.data);
  }

  async function runImport(dryRun: boolean): Promise<void> {
    const parsed = importUploadInputSchema.safeParse({ dryRun });
    if (!parsed.success) return;

    setBusy(true);
    setMessage(null);
    setResult(null);

    const response = await sendJson(
      "POST",
      `/api/v1/teacher/uploads/${encodeURIComponent(upload.id)}/import`,
      parsed.data,
      importUploadResultSchema,
    );
    setBusy(false);

    if (!response.ok) {
      setMessage(response.failure.message);
      return;
    }

    setResult(response.data);
    if (!dryRun) router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <Summary
        upload={upload}
        accepted={accepted}
        imported={imported}
        pending={pending}
        busy={busy}
        onAcceptAll={() =>
          void bulk(
            upload.items.filter((item) => item.status === "PROPOSED").map((item) => item.id),
            "ACCEPTED",
          )
        }
        onCheck={() => void runImport(true)}
        onImport={() => void runImport(false)}
      />

      {result ? <ImportOutcome result={result} /> : null}

      {message ? (
        <p role="alert" className="text-marker-700 text-sm">
          {message}
        </p>
      ) : null}

      <Card className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All {upload.items.length}
          </FilterChip>
          <FilterChip active={filter === "PROPOSED"} onClick={() => setFilter("PROPOSED")}>
            To check {pending}
          </FilterChip>
          <FilterChip active={filter === "ACCEPTED"} onClick={() => setFilter("ACCEPTED")}>
            Accepted {accepted}
          </FilterChip>
          <FilterChip active={filter === "REJECTED"} onClick={() => setFilter("REJECTED")}>
            Rejected {upload.items.filter((item) => item.status === "REJECTED").length}
          </FilterChip>
        </div>

        <label className="text-text-soft flex flex-col gap-1.5 text-sm font-medium">
          Sort
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value === "paper" ? "paper" : "confidence")}
            className={`${selectClass} w-auto`}
          >
            <option value="confidence">Least sure first</option>
            <option value="paper">Paper order</option>
          </select>
        </label>
      </Card>

      {visible.length === 0 ? (
        <p className="text-text-soft py-8 text-center text-sm">Nothing here.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {visible.map((item) => (
            <ReviewCard
              key={item.id}
              item={item}
              chapters={upload.chapters}
              busy={busy}
              onChange={(patch) => void updateItem(item.id, patch)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Summary({
  upload,
  accepted,
  imported,
  pending,
  busy,
  onAcceptAll,
  onCheck,
  onImport,
}: {
  upload: PaperUploadDetail;
  accepted: number;
  imported: number;
  pending: number;
  busy: boolean;
  onAcceptAll: () => void;
  onCheck: () => void;
  onImport: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className="text-text text-subheading">{upload.title}</h2>
          <p className="text-text-faint mt-1 text-sm">
            {upload.subject.name} · {upload.extractedCount} questions found
            {upload.model ? ` · read by ${upload.model}` : ""}
          </p>
          <p className="text-text-soft mt-2 text-sm leading-relaxed">
            {imported > 0 ? `${String(imported)} already in your bank · ` : ""}
            {accepted} accepted · {pending} still to check
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {pending > 0 ? (
            <Button variant="secondary" size="sm" disabled={busy} onClick={onAcceptAll}>
              Accept all {pending}
            </Button>
          ) : null}
          <Button variant="secondary" size="sm" disabled={busy || accepted === 0} onClick={onCheck}>
            Check
          </Button>
          <Button size="sm" disabled={busy || accepted === 0} onClick={onImport}>
            {busy ? "Working…" : `Import ${String(accepted)}`}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * The result of a check or an import.
 *
 * A dry run and a real import share this component because they answer the same
 * question — what would happen / what did happen — and a teacher comparing two
 * differently-shaped reports has to work out which one they are looking at.
 */
function ImportOutcome({ result }: { result: ImportUploadResult }) {
  if (result.errors.length > 0) {
    return (
      <section className="border-marker-200 bg-marker-50 rounded-panel border p-5 sm:p-6">
        <p className="text-marker-700 font-semibold">
          {result.errors.length} {result.errors.length === 1 ? "question needs" : "questions need"}{" "}
          fixing before anything is saved.
        </p>
        <p className="text-text-soft mt-1 text-sm">
          Nothing was written — it is all or nothing, so you never have to work out which half
          landed.
        </p>
        <ul className="mt-3 flex flex-col gap-2">
          {result.errors.map((error) => (
            <li key={error.itemId} className="text-text-soft text-sm">
              <span className="text-text font-semibold">
                {error.printedNumber ? `Q${error.printedNumber}` : "One question"}
              </span>{" "}
              — {error.issues.map((issue) => issue.message).join("; ")}
            </li>
          ))}
        </ul>
      </section>
    );
  }

  return (
    <Card tone="brand">
      <p className="text-text font-semibold">
        {result.dryRun
          ? `${String(result.valid)} ready to import.`
          : `${String(result.written)} added to your question bank.`}
      </p>
      <p className="text-text-soft mt-1 text-sm">
        {result.dryRun
          ? "Nothing saved yet — press Import when you are happy."
          : result.alreadyImported > 0
            ? `${String(result.alreadyImported)} were already there and were left alone.`
            : "They are set for students and can be used in an assignment."}
      </p>
    </Card>
  );
}

function ReviewCard({
  item,
  chapters,
  busy,
  onChange,
}: {
  item: ExtractedQuestion;
  chapters: PaperUploadDetail["chapters"];
  busy: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const [open, setOpen] = useState(false);
  const settled = item.status === "IMPORTED";

  return (
    <li
      className={[
        "rounded-panel border p-5 transition-[border-color,box-shadow,opacity] sm:p-6",
        item.status === "ACCEPTED"
          ? "border-brand-200 bg-brand-50/50"
          : item.status === "REJECTED"
            ? "border-line bg-raised/50 opacity-70"
            : "border-line bg-card",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-text-faint flex flex-wrap items-center gap-2 text-xs font-semibold">
            {item.printedNumber ? <span>Q{item.printedNumber}</span> : null}
            <span>{item.type.replaceAll("_", " ").toLowerCase()}</span>
            <span>·</span>
            <span>
              {item.marks} {item.marks === 1 ? "mark" : "marks"}
            </span>
            <Confidence value={item.confidence} />
          </div>

          <div className="text-text mt-2 text-sm leading-relaxed">
            <MathText>{item.payload.body}</MathText>
          </div>

          {item.payload.options.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {item.payload.options.map((option) => (
                <li key={option.label} className="text-text-soft text-sm">
                  <span
                    className={option.isCorrect ? "text-brand-700 font-bold" : "text-text-faint"}
                  >
                    {option.label}.
                  </span>{" "}
                  <MathText>{option.body}</MathText>
                </li>
              ))}
            </ul>
          ) : null}

          {item.note ? (
            <p className="text-marker-700 mt-3 text-xs leading-relaxed">Note: {item.note}</p>
          ) : null}

          {!item.payload.answer ? (
            <p className="text-marker-700 mt-2 text-xs leading-relaxed">
              No answer was printed on the paper, and none was invented. Add a solution before this
              can be set for students.
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {settled ? (
            <Chip tone="correct">In your bank</Chip>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onChange({ status: item.status === "ACCEPTED" ? "PROPOSED" : "ACCEPTED" })
                }
                className={[
                  "rounded-pill min-h-11 px-4 text-sm font-semibold transition-colors",
                  item.status === "ACCEPTED"
                    ? "bg-brand-500 text-on-brand"
                    : "bg-raised text-text-soft hover:text-text",
                ].join(" ")}
              >
                {item.status === "ACCEPTED" ? "Accepted" : "Accept"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  onChange({ status: item.status === "REJECTED" ? "PROPOSED" : "REJECTED" })
                }
                className="text-text-faint hover:text-marker-700 rounded-pill min-h-11 px-3 text-sm font-semibold transition-colors"
              >
                {item.status === "REJECTED" ? "Rejected" : "Skip"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="text-brand-700 inline-flex min-h-11 items-center text-sm font-semibold hover:underline"
          >
            {open ? "Done" : "Fix details"}
          </button>
        </div>
      </div>

      {open ? (
        <Editor item={item} chapters={chapters} busy={busy || settled} onChange={onChange} />
      ) : (
        <p className="text-text-faint mt-3 text-xs">
          {item.chapter?.name ?? "No chapter yet"} · {item.difficulty.toLowerCase()}
        </p>
      )}
    </li>
  );
}

/**
 * The two fields the model gets wrong, plus the two it sometimes does.
 *
 * Chapter and difficulty come first and are always visible, because they are
 * what the review is actually for. Type and marks are here too because a
 * mis-typed question fails import with a validation message, and fixing it here
 * is better than sending the teacher to the admin editor.
 */
function Editor({
  item,
  chapters,
  busy,
  onChange,
}: {
  item: ExtractedQuestion;
  chapters: PaperUploadDetail["chapters"];
  busy: boolean;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  return (
    <div className="border-line bg-raised/55 rounded-control mt-5 grid gap-4 border p-4 sm:grid-cols-2">
      <label className="text-text block text-sm font-semibold">
        Chapter
        <select
          disabled={busy}
          value={item.chapter?.id ?? ""}
          onChange={(event) => onChange({ chapterId: event.target.value || null })}
          className={editorInput}
        >
          <option value="">Not filed yet</option>
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-text block text-sm font-semibold">
        Difficulty
        <select
          disabled={busy}
          value={item.difficulty}
          onChange={(event) => onChange({ difficulty: event.target.value })}
          className={editorInput}
        >
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
      </label>

      <label className="text-text block text-sm font-semibold">
        Marks
        <input
          disabled={busy}
          type="number"
          min={1}
          max={20}
          defaultValue={item.marks}
          onBlur={(event) => {
            const marks = Number(event.target.value);
            if (Number.isInteger(marks) && marks !== item.marks) onChange({ marks });
          }}
          className={editorInput}
        />
      </label>

      <label className="text-text block text-sm font-semibold">
        Type
        <select
          disabled={busy}
          value={item.type}
          onChange={(event) => onChange({ type: event.target.value })}
          className={editorInput}
        >
          {QUESTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {type.replaceAll("_", " ").toLowerCase()}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function Confidence({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-marker-700">unsure</span>;
  }

  if (value >= 0.8) return null;

  return (
    <span className={value < 0.5 ? "text-marker-700" : "text-text-faint"}>
      {Math.round(value * 100)}% sure
    </span>
  );
}

/**
 * A filter that is also its own count.
 *
 * A button rather than the `Chip` in `ui/surface`: that one is a label, this one
 * is pressed, and a 44px target with an `aria-pressed` state is a different
 * object from a 24px status marker even though they share a silhouette.
 */
function FilterChip({
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

const QUESTION_TYPES = [
  "MCQ",
  "ASSERTION_REASON",
  "VERY_SHORT_ANSWER",
  "SHORT_ANSWER",
  "LONG_ANSWER",
  "CASE_BASED",
  "NUMERICAL",
  "TRUE_FALSE",
  "FILL_BLANK",
  "MATCH_FOLLOWING",
] as const;

const editorInput = `${inputClass} mt-1.5 font-normal`;
