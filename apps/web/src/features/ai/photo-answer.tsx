"use client";

import { answerTranscriptionSchema, type AnswerTranscription } from "@samjho/contracts";
import { MathText } from "@samjho/ui";
import { useRef, useState } from "react";

import { CameraIcon, Check, Cross } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/surface";
import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * Photograph a handwritten answer instead of typing it.
 *
 * ## Why this matters more than it looks
 *
 * Students do their real work on paper. Every long-answer question in this
 * product asks them to do it twice — once in the exercise book where they
 * actually think, and again in a textarea on a phone, where nobody wants to
 * type three lines of algebra. The second copy is where they give up, and a
 * long-answer bank nobody attempts is a bank that teaches nothing.
 *
 * ## The transcription is shown, never submitted
 *
 * The student reads back what the machine thinks they wrote and presses "Use
 * this" — or does not. That is not an extra tap for its own sake: reading
 * handwritten mathematics is the weak link, and a misread exponent that goes
 * straight into a graded answer produces a wrong mark the student cannot trace.
 * Shown first, the same misreading takes one second to spot and fix.
 *
 * It replaces the field rather than appending to it, and it warns before it
 * replaces anything the student has already typed. Losing typed working to a
 * button press would be the one unforgivable bug in this component.
 *
 * ## Downscaling happens here
 *
 * A modern phone photograph is four to eight megabytes, and the API takes JSON
 * inside a 1 MB body. The canvas pass below fits it to 1,600px on the long edge
 * at JPEG 0.72, which lands around 200-400 KB and is far more resolution than
 * handwriting needs. Doing it client-side also means the large version never
 * leaves the phone.
 */
export function PhotoAnswer({
  questionId,
  hasTypedText,
  onAccept,
}: {
  questionId: string;
  /** Whether the answer field already has something in it worth protecting. */
  hasTypedText: boolean;
  onAccept: (text: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<AnswerTranscription | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [confirmingOverwrite, setConfirmingOverwrite] = useState(false);

  async function capture(file: File): Promise<void> {
    setBusy(true);
    setFailure(null);
    setReading(null);

    let image: { mimeType: "image/jpeg"; data: string };
    try {
      image = await downscale(file);
    } catch {
      setBusy(false);
      setFailure({
        message: "That file could not be read as a photo. Try taking it again.",
        fieldErrors: {},
      });
      return;
    }

    const result = await sendJson(
      "POST",
      "/api/v1/ai/transcribe",
      { questionId, image },
      answerTranscriptionSchema,
    );

    setBusy(false);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setReading(result.data);
    setConfirmingOverwrite(false);
  }

  function accept(): void {
    if (!reading) return;

    if (hasTypedText && !confirmingOverwrite) {
      setConfirmingOverwrite(true);
      return;
    }

    onAccept(reading.text);
    setReading(null);
    setConfirmingOverwrite(false);
  }

  return (
    <div className="mt-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        // Opens the rear camera directly on a phone and is ignored on a desktop,
        // where it falls back to an ordinary file picker. Exactly the behaviour
        // both want, from one attribute.
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared so that photographing the same file twice still fires a
          // change event. Without this, a retake of an identical filename is
          // silently ignored.
          event.target.value = "";
          if (file) void capture(file);
        }}
      />

      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        <CameraIcon className="size-4" />
        {busy ? "Reading your page…" : "Photograph my written answer"}
      </Button>

      {failure ? (
        <p role="alert" className="text-marker-700 mt-2 text-sm">
          {failure.message}
        </p>
      ) : null}

      {reading ? (
        <div className="rounded-control border-line bg-raised mt-3 border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-text text-sm font-semibold">
              {reading.generated ? "This is what we read" : "Nothing could be read"}
            </p>
            {reading.generated ? (
              <Chip tone={reading.confidence === "HIGH" ? "correct" : "partial"}>
                {reading.confidence === "HIGH"
                  ? "Clear"
                  : reading.confidence === "MEDIUM"
                    ? "Mostly clear"
                    : "Hard to read"}
              </Chip>
            ) : null}
          </div>

          {reading.caveat ? (
            <p className="text-sand-800 mt-2 text-xs leading-relaxed">{reading.caveat}</p>
          ) : null}

          {reading.text ? (
            <>
              <MathText className="text-text border-line mt-3 block border-l-2 pl-3 text-sm leading-relaxed whitespace-pre-wrap">
                {reading.text}
              </MathText>

              <p className="text-text-faint mt-2 text-xs leading-relaxed">
                Check it against your page before you use it — anything it got wrong, you can fix in
                the answer box afterwards.
              </p>

              {confirmingOverwrite ? (
                <p role="alert" className="text-marker-700 mt-2 text-sm">
                  This will replace what you have already written. Press again to go ahead.
                </p>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={accept}>
                  <Check className="size-4" />
                  {confirmingOverwrite ? "Yes, replace it" : "Use this"}
                </Button>
                <Button
                  variant="quiet"
                  size="sm"
                  onClick={() => {
                    setReading(null);
                    setConfirmingOverwrite(false);
                  }}
                >
                  <Cross className="size-4" />
                  Discard
                </Button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** Long edge, in pixels. Generous for handwriting and small enough to send. */
const MAX_EDGE = 1_600;
const JPEG_QUALITY = 0.72;

/**
 * Fit a photograph into something that can travel as JSON.
 *
 * Decoded with `createImageBitmap`, which works off the main thread, so a
 * four-megapixel photograph does not freeze the page while it is resized.
 */
async function downscale(file: File): Promise<{ mimeType: "image/jpeg"; data: string }> {
  // No orientation option: the current default already applies the EXIF
  // rotation, which is what matters here — a page photographed in portrait on a
  // phone arrives sideways otherwise, and a sideways page is one the reader
  // will refuse.
  const bitmap = await createImageBitmap(file);

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d context");

  // A photograph of paper has no transparency, but a PNG source does, and
  // flattening onto white keeps a transparent margin from becoming black.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  const data = dataUrl.slice(dataUrl.indexOf(",") + 1);

  return { mimeType: "image/jpeg", data };
}
