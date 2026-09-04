"use client";

import {
  practiceSessionSchema,
  type CreatePracticeSessionInput,
  type PracticeFilters,
  type PracticeMode,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * "Start practising" — the button that turns a set of filters into a session.
 *
 * A button rather than a link, because creating a session is a POST that
 * materialises a question set (the set must not change shape mid-session, so it
 * is chosen once and stored). The presets on the hub use this directly; the
 * filter builder at `/practice/new` uses the same hook underneath, so there is
 * one place that knows how a session starts.
 *
 * The failure worth designing for is not a server error — it is an empty bank.
 * Samjho's questions are being written from zero (docs/07 R1), so "nothing
 * matches those filters yet" is the *normal* outcome for months, and it gets a
 * plain sentence next to the button rather than a red error box.
 */
export function StartPractice({
  mode,
  filters,
  count,
  label,
  variant = "primary",
  className,
}: {
  mode: PracticeMode;
  filters?: Partial<PracticeFilters>;
  count?: number;
  label: string;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const { start, busy, message } = useStartPractice();

  return (
    <div className={className}>
      <Button
        variant={variant}
        disabled={busy}
        onClick={() => {
          void start({
            mode,
            filters: { unseenOnly: false, ...filters },
            count: count ?? 10,
          });
        }}
      >
        {busy ? "Building your set…" : label}
      </Button>

      {message ? (
        <p role="status" className="text-text-soft mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function useStartPractice() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(input: CreatePracticeSessionInput): Promise<void> {
    setBusy(true);
    setMessage(null);

    const result = await sendJson(
      "POST",
      "/api/v1/practice-sessions",
      input,
      practiceSessionSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setMessage(result.failure.message);
      return;
    }

    // Busy stays true through the navigation: a second tap would build a second
    // session, and the student would lose the first one without ever knowing it
    // existed.
    router.push(`/practice/sessions/${result.data.id}`);
  }

  return { start, busy, message };
}
