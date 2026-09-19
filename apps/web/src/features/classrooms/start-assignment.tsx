"use client";

import { startAssignmentResponseSchema, type AssignmentProgress } from "@medhavi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * Starts (or safely resumes) a teacher assignment.
 *
 * Both the classroom page and the daily plan need this exact mutation. Keeping
 * it in one component means both routes use the assignment endpoint that
 * enforces membership and its one-submission-per-student invariant, instead of
 * either surface trying to build a practice set locally.
 */
export function StartAssignment({
  assignmentId,
  progress = "NOT_STARTED",
  label,
  variant,
  size = "sm",
}: {
  assignmentId: string;
  progress?: Extract<AssignmentProgress, "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "LATE">;
  label?: string;
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(): Promise<void> {
    setBusy(true);
    setMessage(null);
    const result = await sendJson(
      "POST",
      `/api/v1/classrooms/assignments/${encodeURIComponent(assignmentId)}/start`,
      {},
      startAssignmentResponseSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setMessage(result.failure.message);
      return;
    }

    // The response is the canonical session. A double click, two tabs, or a
    // visit from the daily plan all land on the same submission rather than
    // creating parallel versions of a teacher's work.
    router.push(
      result.data.status === "COMPLETED"
        ? `/practice/sessions/${result.data.id}/result`
        : `/practice/sessions/${result.data.id}`,
    );
  }

  const defaultLabel =
    progress === "NOT_STARTED"
      ? "Start assigned practice"
      : progress === "IN_PROGRESS"
        ? "Resume practice"
        : "Review your work";

  return (
    <div>
      <Button
        variant={variant ?? (progress === "NOT_STARTED" ? "primary" : "secondary")}
        size={size}
        disabled={busy}
        onClick={() => void start()}
      >
        {busy ? "Opening…" : (label ?? defaultLabel)}
      </Button>
      {message ? (
        <p role="alert" className="text-marker-700 mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}
