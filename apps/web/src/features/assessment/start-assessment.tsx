"use client";

import {
  practiceSessionSchema,
  type AssessmentObjective,
  type StartAssessmentInput,
} from "@medhavi/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { sendJson } from "@/lib/client-api";

/**
 * The button that turns an objective into a sitting.
 *
 * A POST rather than a link, because starting an assessment is not navigation:
 * the engine has to choose the opening question before there is anything to
 * navigate to. The student lands on a sitting that already knows what it is
 * asking them first.
 *
 * `busy` stays true through the redirect. A second tap would start a second
 * diagnostic, and for the adaptive sitting it would abandon the first one
 * silently — the student would never know it had existed.
 */
export function StartAssessment({
  objective,
  subjectId,
  count,
  label,
  busyLabel = "Setting up…",
  variant = "primary",
  size = "md",
  disabled = false,
  className,
}: {
  objective: AssessmentObjective;
  subjectId?: string;
  count?: number;
  label: string;
  busyLabel?: string;
  variant?: "primary" | "secondary" | "quiet";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  className?: string;
}) {
  const { start, busy, message } = useStartAssessment();

  return (
    <div className={className}>
      <Button
        variant={variant}
        size={size}
        disabled={busy || disabled}
        onClick={() => {
          void start({
            objective,
            ...(subjectId === undefined ? {} : { subjectId }),
            count: count ?? 10,
          });
        }}
      >
        {busy ? busyLabel : label}
      </Button>

      {message ? (
        <p role="status" className="text-text-soft mt-2 text-sm">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function useStartAssessment() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function start(input: StartAssessmentInput): Promise<void> {
    setBusy(true);
    setMessage(null);

    const result = await sendJson("POST", "/api/v1/assessments", input, practiceSessionSchema);

    if (!result.ok) {
      setBusy(false);
      setMessage(result.failure.message);
      return;
    }

    router.push(`/practice/sessions/${result.data.id}`);
  }

  return { start, busy, message };
}
