"use client";

import {
  adminQuestionSchema,
  QUESTION_STATUS_TRANSITIONS,
  type AdminQuestion,
  type QuestionStatus,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { sendJson, type ApiFailure } from "@/lib/client-api";

/**
 * Moving a question through its lifecycle.
 *
 * The buttons are generated from `QUESTION_STATUS_TRANSITIONS` in contracts —
 * the same table the API enforces — so this UI cannot offer a move the server
 * will refuse. That is a convenience, not a control: the API checks again,
 * because a button that is not rendered is not a button that cannot be called.
 *
 * `publicationBlockers` is computed server-side and arrives on the question, so
 * the reason publishing is unavailable is stated here in the same words the API
 * would have used. An editor should never have to click a button to find out why
 * it would not have worked.
 */

const LABELS: Record<QuestionStatus, string> = {
  DRAFT: "Move back to draft",
  IN_REVIEW: "Send for review",
  PUBLISHED: "Publish",
  ARCHIVED: "Withdraw",
};

const STATUS_TEXT: Record<QuestionStatus, string> = {
  DRAFT: "Draft — not visible to students",
  IN_REVIEW: "In review — not visible to students",
  PUBLISHED: "Published — students can see this",
  ARCHIVED: "Withdrawn — kept, but not served",
};

export function StatusControls({ question }: { question: AdminQuestion }) {
  const router = useRouter();
  const [busy, setBusy] = useState<QuestionStatus | null>(null);
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [reason, setReason] = useState("");

  const blocked = question.publicationBlockers.length > 0;

  async function move(status: QuestionStatus): Promise<void> {
    setBusy(status);
    setFailure(null);

    const result = await sendJson(
      "PUT",
      `/api/v1/admin/questions/${question.id}/status`,
      { status, reason: reason.trim() === "" ? null : reason.trim() },
      adminQuestionSchema,
    );

    setBusy(null);

    if (!result.ok) {
      setFailure(result.failure);
      return;
    }

    setReason("");
    router.refresh();
  }

  return (
    <section className="border-line space-y-4 rounded-xl border p-4">
      <div>
        <h2 className="text-text text-sm font-semibold">Status</h2>
        <p className="text-text-soft text-sm">{STATUS_TEXT[question.status]}</p>
      </div>

      {blocked ? (
        <ul className="text-text-soft list-disc space-y-1 pl-5 text-xs">
          {question.publicationBlockers.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : null}

      <label className="block space-y-1.5">
        <span className="text-text text-sm font-medium">
          Reason <span className="text-text-soft font-normal">(recorded in the log)</span>
        </span>
        <input
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
          }}
          placeholder="Student reported the answer key is wrong"
          className="border-line-strong w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {QUESTION_STATUS_TRANSITIONS[question.status].map((status) => {
          const disabled = busy !== null || (status === "PUBLISHED" && blocked);

          return (
            <button
              key={status}
              type="button"
              disabled={disabled}
              onClick={() => {
                void move(status);
              }}
              className="border-line-strong min-h-11 rounded-lg border px-4 text-sm disabled:opacity-50"
            >
              {busy === status ? "Working…" : LABELS[status]}
            </button>
          );
        })}
      </div>

      {failure ? (
        <p role="alert" className="text-marker-700 text-xs">
          {failure.message}
        </p>
      ) : null}
    </section>
  );
}
