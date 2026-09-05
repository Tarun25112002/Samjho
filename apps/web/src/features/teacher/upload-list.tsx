"use client";

import type { PaperUploadSummary } from "@samjho/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { PaperIcon } from "@/components/icons";

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
        <div className="border-line bg-card rounded-panel flex flex-wrap items-center justify-between gap-4 border px-5 py-4 sm:px-6">
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
        </div>
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
    <li className="border-line bg-card rounded-panel border p-5 transition-[border-color,box-shadow] hover:border-line-strong hover:shadow-lift sm:p-6">
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
              className="text-brand-700 rounded-pill bg-brand-50 min-h-11 px-4 text-sm font-semibold transition-colors hover:bg-brand-100"
            >
              {upload.status === "READY" ? "Review" : "Open"}
            </Link>
          )}
        </div>
      </div>
    </li>
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

const STATUS_LABELS = {
  UPLOADED: { text: "Queued", tone: "wait" },
  EXTRACTING: { text: "Reading…", tone: "wait" },
  READY: { text: "Needs review", tone: "action" },
  FAILED: { text: "Failed", tone: "bad" },
  IMPORTED: { text: "Imported", tone: "good" },
} as const;

function StatusPill({ status }: { status: PaperUploadSummary["status"] }) {
  const meta = STATUS_LABELS[status];

  const tones = {
    wait: "bg-raised text-text-soft",
    action: "bg-brand-100 text-brand-700",
    good: "bg-ink-50 text-text-soft",
    bad: "bg-marker-50 text-marker-700",
  } as const;

  return (
    <span
      className={`rounded-pill min-h-8 px-3 py-1.5 text-xs font-bold tracking-[0.04em] ${tones[meta.tone]}`}
    >
      {meta.text}
    </span>
  );
}

function NotConfigured() {
  return (
    <section className="border-line bg-raised rounded-panel border p-5 sm:p-6">
      <p className="text-text font-semibold">Reading papers is not switched on here.</p>
      <p className="text-text-soft mt-2 text-sm leading-relaxed">
        This server has no AI provider configured, so uploaded papers cannot be read automatically.
        Everything else in your teaching space works as normal.
      </p>
    </section>
  );
}

function Empty() {
  return (
    <section className="border-line bg-card rounded-panel border p-7 sm:p-9">
      <p className="text-text text-xl font-semibold tracking-[-0.02em]">
        Turn a paper into a question bank.
      </p>
      <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">
        Upload a PDF or a photo of a question paper. Samjho reads it, writes out each question with
        its options and marking scheme, and files it under a chapter with a difficulty. You check
        the ones it was unsure about, and the rest is done.
      </p>
    </section>
  );
}
