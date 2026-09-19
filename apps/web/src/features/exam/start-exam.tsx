"use client";

import { examAttemptSchema } from "@medhavi/contracts";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * "Start the paper" — and the one tap that must not happen twice.
 *
 * The idempotency key is minted once per mounted button and reused on every
 * retry, which is what makes a double-tap on a slow connection produce one
 * attempt with one timer rather than two. Generating it inside the click
 * handler would defeat the whole mechanism: the second tap would carry a
 * different key and the server would rightly create a second attempt.
 */
export function StartExam({
  paperId,
  label = "Start the paper",
  fullWidth = false,
}: {
  paperId: string;
  label?: string;
  fullWidth?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const idempotencyKey = useRef(
    `exam-${paperId.slice(0, 8)}-${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`,
  );

  async function start(): Promise<void> {
    setBusy(true);
    setMessage(null);

    const result = await sendJson(
      "POST",
      "/api/v1/exam-attempts",
      { paperId, idempotencyKey: idempotencyKey.current },
      examAttemptSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setMessage(result.failure.message);
      return;
    }

    // `busy` stays true through the navigation: the clock is already running
    // server-side, and a live button on a started exam is an invitation to
    // start a second one.
    router.push(`/exams/attempts/${result.data.id}`);
  }

  return (
    <div className={fullWidth ? "w-full" : undefined}>
      <Button
        size="lg"
        fullWidth={fullWidth}
        disabled={busy}
        onClick={() => {
          void start();
        }}
      >
        {busy ? "Opening your paper…" : label}
      </Button>

      {message ? (
        <p role="status" className="text-text-soft mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
