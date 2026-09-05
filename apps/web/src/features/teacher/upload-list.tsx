"use client";

import type { PaperUploadSummary } from "@samjho/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PaperIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Card, Chip } from "@/components/ui/surface";

import { UploadForm } from "./upload-form";

/**
 * The papers a teacher has uploaded, and what became of each.
 *
 * ## The polling
 *
 * Extraction outlives the request that started it, so a row that says "reading"
 * has to become "ready" without the teacher reloading. `router.refresh()` on an
 * interval re-runs the server component and swaps in fresh data without losing
 * scroll position or the open form — which is the whole reason to refresh
 * rather than re-fetch into client state.
 *
 * It polls **only while something is actually being read**, and stops the
 * moment nothing is. A page that refreshes itself every six seconds for ever is
 * one that quietly burns a teacher's data allowance in a browser tab they left
 * open, and it puts a floor under the API's request rate for no benefit.
 *
 * Six seconds because extraction takes one to three minutes: a shorter interval
 * is a lot of requests to learn nothing, and a longer one makes a finished job
 * feel stuck.
 */
const POLL_INTERVAL_MS = 6000;

export function UploadList({
  uploads,
  subjects,
  aiConfigured,
}: {
  uploads: PaperUploadSummary[];
  subjects: { id: string; name: string; code: string }[];
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(uploads.length === 0);

  const anyInFlight = uploads.some(
    (upload) => upload.status === "EXTRACTING" || upload.status === "UPLOADED",
  );

  useEffect(() => {
    if (!anyInFlight) return;

    const timer = setInterval(() => {
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [anyInFlight, router]);

  return (
    <div className="flex flex-col gap-6">
      {aiConfigured ? (
        <Card
          pad="flush"
          className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
        >
          <div>
            <p className="text-text text-sm font-semibold">
              {uploads.length === 0
                ? "Add the first paper to your bank"
                : `${String(uploads.length)} ${uploads.length === 1 ? "paper" : "papers"} in your queue`}
            </p>
            <p className="text-text-faint mt-0.5 text-xs">
              Review every extracted question before it reaches students.
            </p>
          </div>
          <Button onClick={() => setShowForm((open) => !open)}>
            {showForm ? "Close upload" : "Upload a paper"}
          </Button>
        </Card>
      ) : (
        <NotConfigured />
      )}

      {aiConfigured && showForm ? (
        <UploadForm subjects={subjects} onDone={() => setShowForm(false)} />
      ) : null}

      {uploads.length === 0 ? (
        <Empty />
      ) : (
        <ul className="grid gap-4">
          {uploads.map((upload) => (
            <UploadRow key={upload.id} upload={upload} />
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadRow({ upload }: { upload: PaperUploadSummary }) {
  const busy = upload.status === "EXTRACTING" || upload.status === "UPLOADED";

  return (
    <Card
      as="li"
      className="hover:border-line-strong hover:shadow-lift transition-[border-color,box-shadow]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <PaperIcon className="text-text-faint mt-0.5 size-5 shrink-0" />
          <div className="min-w-0">
            <p className="text-text font-semibold">{upload.title}</p>
            <p className="text-text-faint mt-1 text-sm">
              {upload.subject.name} · {new Date(upload.createdAt).toLocaleDateString("en-IN")}
              {upload.fileName ? ` · ${upload.fileName}` : ""}
            </p>
            <StatusLine upload={upload} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          <StatusPill status={upload.status} />
          {busy ? null : (
            <Link
              href={`/teacher/uploads/${upload.id}`}
              className="text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-pill inline-flex min-h-11 items-center px-4 text-sm font-semibold transition-colors"
            >
              {upload.status === "READY" ? "Review" : "Open"}
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}

function StatusLine({ upload }: { upload: PaperUploadSummary }) {
  if (upload.status === "FAILED") {
    return (
      <p className="text-marker-700 mt-2 text-sm leading-relaxed">
        {upload.error ?? "This paper could not be read."}
      </p>
    );
  }

  if (upload.status === "EXTRACTING" || upload.status === "UPLOADED") {
    return (
      <p className="text-text-soft mt-2 text-sm">
        Reading the paper. This usually takes a minute or two — you can leave this page.
      </p>
    );
  }

  return (
    <p className="text-text-soft mt-2 text-sm">
      {upload.extractedCount} questions found
      {upload.acceptedCount > 0 ? ` · ${String(upload.acceptedCount)} accepted` : ""}
      {upload.importedCount > 0 ? ` · ${String(upload.importedCount)} in your bank` : ""}
    </p>
  );
}

/**
 * What became of a paper.
 *
 * `IMPORTED` used to be drawn on `bg-ink-50`, a token that was deleted when the
 * `ink-*` ramp was retired. Tailwind drops a class whose colour does not resolve
 * without saying anything, so the finished state — the only genuinely *good*
 * outcome in this list — had been rendering with no background at all: bare text
 * beside four filled pills.
 */
const STATUS_LABELS = {
  UPLOADED: { text: "Queued", tone: "neutral" },
  EXTRACTING: { text: "Reading…", tone: "neutral" },
  READY: { text: "Needs review", tone: "brand" },
  FAILED: { text: "Failed", tone: "wrong" },
  IMPORTED: { text: "Imported", tone: "correct" },
} as const;

function StatusPill({ status }: { status: PaperUploadSummary["status"] }) {
  const meta = STATUS_LABELS[status];
  return <Chip tone={meta.tone}>{meta.text}</Chip>;
}

function NotConfigured() {
  return (
    <Card tone="raised">
      <p className="text-text font-semibold">Reading papers is not switched on here.</p>
      <p className="text-text-soft mt-2 text-sm leading-relaxed">
        This server has no AI provider configured, so uploaded papers cannot be read automatically.
        Everything else in your teaching space works as normal.
      </p>
    </Card>
  );
}

function Empty() {
  return (
    <Card pad="roomy">
      <p className="text-text text-heading">Turn a paper into a question bank.</p>
      <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">
        Upload a PDF or a photo of a question paper. Samjho reads it, writes out each question with
        its options and marking scheme, and files it under a chapter with a difficulty. You check
        the ones it was unsure about, and the rest is done.
      </p>
    </Card>
  );
}
