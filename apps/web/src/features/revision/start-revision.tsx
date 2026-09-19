"use client";

import { practiceSessionSchema, type StartRevisionInput } from "@medhavi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * "Start today's revision" — the one button this whole feature exists to get
 * pressed.
 *
 * Deliberately not `StartPractice` with a different mode. That component takes
 * filters and a count and lets the caller describe a set; a review session is
 * described by the *schedule*, and the server decides what is in it. Reusing the
 * practice starter would have meant the client naming question ids or filters
 * for a set it does not get to choose — which is both wrong and the shape of a
 * path a student could use to review whatever they liked.
 *
 * The optional timer is off by default and stays off, because timing a review
 * measures a different thing from reviewing: retrieval under pressure is not
 * retrieval, and a student rebuilding a shaky topic should be allowed to think.
 * It is offered because rehearsing pace is also a real goal — the student's
 * choice, not the schedule's.
 */
export function StartRevision({
  subjectId,
  count,
  label = "Start today's revision",
  variant = "primary",
  timeLimitMinutes,
}: {
  subjectId?: string;
  count?: number;
  label?: string;
  variant?: "primary" | "secondary";
  timeLimitMinutes?: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setMessage(null);

    const input: StartRevisionInput = {
      count: count ?? 20,
      ...(subjectId === undefined ? {} : { subjectId }),
      ...(timeLimitMinutes === undefined ? {} : { timeLimitMinutes }),
    };

    const result = await sendJson(
      "POST",
      "/api/v1/revision/sessions",
      input,
      practiceSessionSchema,
    );

    if (!result.ok) {
      setBusy(false);
      // The expected failure here is "nothing is due", which is a *success* for
      // the student and gets a plain sentence rather than an error box. It is
      // reachable normally: the queue was rendered on the server, and the
      // student may have cleared it in another tab since.
      setMessage(result.failure.message);
      return;
    }

    // Busy stays true through the navigation. A second tap would build a second
    // review session over the same due questions, and answering in one would
    // leave the other holding questions that are no longer due.
    router.push(`/practice/sessions/${result.data.id}`);
  }

  return (
    <div>
      <Button
        variant={variant}
        disabled={busy}
        onClick={() => {
          void start();
        }}
      >
        {busy ? "Building your review…" : label}
      </Button>

      {message ? (
        <p role="status" className="text-text-soft mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
