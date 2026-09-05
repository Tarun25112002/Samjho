"use client";

import {
  createUploadResponseSchema,
  isSupportedUploadMimeType,
  MAX_UPLOAD_BYTES,
  SUPPORTED_UPLOAD_MIME_TYPES,
  UPLOAD_ACCEPT_ATTRIBUTE,
  uploadPaperInputSchema,
  type PaperUploadSourceKind,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { inputClass, selectClass, textareaClass } from "@/components/ui/form";
import { Card } from "@/components/ui/surface";
import { sendJson } from "@/lib/client-api";

/**
 * Uploading a question paper.
 *
 * ## Why the file is turned into base64 in the browser
 *
 * The API takes JSON, not multipart — see `upload.schema.ts` for why — so the
 * conversion has to happen somewhere, and here is the only place with the file.
 * `FileReader` rather than `arrayBuffer()` + manual encoding, because the
 * manual version builds a string one character at a time and blows the call
 * stack on anything over a megabyte via `String.fromCharCode(...bytes)`. That
 * is a bug that passes every test written with a small fixture.
 *
 * ## Why the size and type are checked here as well as on the server
 *
 * Not for security — this is a courtesy. A teacher on a school connection who
 * picks a 40MB scan should be told in the same second, not after a four-minute
 * upload that ends in a 413. The server checks it again because a check in a
 * browser is a suggestion.
 */
export function UploadForm({
  subjects,
  onDone,
}: {
  subjects: { id: string; name: string; code: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"file" | "text">("file");
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function chooseFile(next: File | null): void {
    setMessage(null);

    if (next && next.size > MAX_UPLOAD_BYTES) {
      setMessage(
        `That file is ${formatBytes(next.size)} — the limit is ${formatBytes(MAX_UPLOAD_BYTES)}. Split the paper, or upload just the pages you need.`,
      );
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    if (next && !isSupportedUploadMimeType(next.type)) {
      setMessage("Upload a PDF or a photo of the paper, or paste the text instead.");
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setFile(next);
    // A paper's filename is very often the best title going — "Science
    // Pre-Board 2025.pdf" — so it is offered rather than left blank, and the
    // teacher can overwrite it.
    if (next && title.trim() === "") setTitle(next.name.replace(/\.[^.]+$/, ""));
  }

  async function submit(): Promise<void> {
    setBusy(true);
    setMessage(null);

    let body: Record<string, unknown>;

    if (mode === "text") {
      body = {
        subjectId,
        title,
        sourceKind: "TEXT" satisfies PaperUploadSourceKind,
        text,
        notes: notes || undefined,
      };
    } else {
      if (!file) {
        setBusy(false);
        setMessage("Choose a file to upload.");
        return;
      }

      const kind = isSupportedUploadMimeType(file.type)
        ? SUPPORTED_UPLOAD_MIME_TYPES[file.type]
        : "PDF";

      body = {
        subjectId,
        title,
        sourceKind: kind,
        fileData: await toBase64(file),
        fileName: file.name,
        mimeType: file.type,
        notes: notes || undefined,
      };
    }

    const parsed = uploadPaperInputSchema.safeParse(body);
    if (!parsed.success) {
      setBusy(false);
      setMessage(parsed.error.issues[0]?.message ?? "Check the details above.");
      return;
    }

    const result = await sendJson(
      "POST",
      "/api/v1/teacher/uploads",
      parsed.data,
      createUploadResponseSchema,
    );
    setBusy(false);

    if (!result.ok) {
      setMessage(result.failure.message);
      return;
    }

    onDone();
    // The list, not the detail page. Extraction takes minutes, and the list
    // already polls — landing on a detail page that says "reading…" for two
    // minutes is a dead end with a back button.
    router.refresh();
  }

  return (
    <Card tone="brand">
      <form
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="border-brand-200/70 bg-card/70 rounded-pill flex w-fit flex-wrap gap-1 border p-1">
          <ModeTab active={mode === "file"} onClick={() => setMode("file")}>
            Upload a file
          </ModeTab>
          <ModeTab active={mode === "text"} onClick={() => setMode("text")}>
            Paste the text
          </ModeTab>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Subject" htmlFor="upload-subject">
            <select
              id="upload-subject"
              value={subjectId}
              onChange={(event) => setSubjectId(event.target.value)}
              className={selectClass}
            >
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.code} · {subject.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="What is this paper?" htmlFor="upload-title">
            <input
              id="upload-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Science pre-board 2025"
              className={inputClass}
            />
          </Field>
        </div>

        {mode === "file" ? (
          <Field label="The paper" htmlFor="upload-file">
            <input
              ref={fileInput}
              id="upload-file"
              type="file"
              accept={UPLOAD_ACCEPT_ATTRIBUTE}
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
              className={`${inputClass} text-text-soft file:text-on-brand file:bg-brand-500 file:rounded-pill py-2 file:mr-3 file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold`}
            />
            <p className="text-text-faint mt-1.5 text-xs">
              A PDF or a clear photo, up to {formatBytes(MAX_UPLOAD_BYTES)}. Scans are fine — the
              clearer the copy, the fewer questions you have to fix afterwards.
            </p>
          </Field>
        ) : (
          <Field label="The paper" htmlFor="upload-text">
            <textarea
              id="upload-text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={8}
              placeholder="Paste the questions here, exactly as printed…"
              className={`${textareaClass} min-h-40 font-mono text-sm`}
            />
          </Field>
        )}

        <Field label="Anything we should know? (optional)" htmlFor="upload-notes">
          <input
            id="upload-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="e.g. the answer key is on the last two pages"
            className={inputClass}
          />
          <p className="text-text-faint mt-1.5 text-xs">
            Where the answers are is the single most useful thing to say here.
          </p>
        </Field>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" disabled={busy || subjects.length === 0}>
            {busy ? "Uploading…" : "Read this paper"}
          </Button>
          <p className="text-text-faint text-xs">
            Reading takes a minute or two. You will review every question before any of it is saved.
          </p>
        </div>

        {message ? (
          <p role="alert" className="text-marker-700 text-sm">
            {message}
          </p>
        ) : null}
      </form>
    </Card>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "rounded-pill min-h-11 px-4 text-sm font-semibold transition-colors",
        active ? "bg-brand-500 text-on-brand" : "bg-card text-text-soft hover:text-text",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="text-text mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * File → base64, without the data-URL prefix.
 *
 * `readAsDataURL` returns `data:application/pdf;base64,XXXX` and the API wants
 * only the `XXXX`. Splitting on the first comma is exact: base64 has no comma
 * in its alphabet, so there is only ever one.
 */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => {
      reject(new Error("Could not read that file"));
    };
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${String(Math.round(bytes / 1024))}KB`;
}
