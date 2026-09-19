"use client";

import type { AIAction } from "@medhavi/contracts";

import { ActionLadder, FollowUp, QuotaLine, Transcript } from "./tutor-panel";
import { useTutor, type TutorTurn } from "./use-tutor";

/**
 * A past conversation, continued.
 *
 * ## Why this is not just `TutorPanel` with a prop
 *
 * The panel is a disclosure that lives under a question: it starts closed,
 * creates its conversation lazily, and resets whenever the question changes.
 * None of those is right here — the conversation already exists, there is no
 * question on the page to reset against, and a collapsed panel on a page whose
 * entire purpose is the transcript would be a page with nothing on it.
 *
 * What the two genuinely share is the transcript, the action ladder and the
 * follow-up box, and those are imported rather than re-written, so a change to
 * how a tutor reply renders lands in both places.
 *
 * ## Actions come from the server
 *
 * `availableActions` is whatever the API said this conversation may currently
 * use. The panel computes its own copy so it can draw chips before any request
 * exists; here the conversation is already loaded, so there is nothing to gain
 * from guessing and a wrong guess would be a chip that errors.
 */
export function ResumedConversation({
  conversationId,
  questionId,
  availableActions,
  initialTurns,
  readOnly,
}: {
  conversationId: string;
  questionId: string | null;
  availableActions: AIAction[];
  initialTurns: TutorTurn[];
  readOnly: boolean;
}) {
  const tutor = useTutor({
    conversationId,
    initialTurns,
    ...(questionId === null ? {} : { questionId }),
    answered: true,
    answeredWrong: false,
  });

  return (
    <div className="flex flex-col gap-4">
      <p className="text-text-faint text-xs leading-relaxed">
        The tutor can make mistakes. The solution in the question bank is the one that counts.
      </p>

      {tutor.turns.length > 0 ? (
        <Transcript turns={tutor.turns} />
      ) : (
        <p className="text-text-soft text-sm">
          Nothing was said in this conversation before it was saved.
        </p>
      )}

      {tutor.failure ? (
        <p
          role="alert"
          className="rounded-control border-marker-200 bg-marker-50 text-marker-700 border px-4 py-3 text-sm"
        >
          {tutor.failure.message}
        </p>
      ) : null}

      {readOnly ? null : (
        <>
          <ActionLadder
            actions={availableActions}
            busy={tutor.busy}
            onAsk={(action) => void tutor.ask(action)}
          />

          <FollowUp busy={tutor.busy} onAsk={(text) => void tutor.ask("SIMPLER", text)} />
        </>
      )}

      {tutor.quota ? <QuotaLine quota={tutor.quota} /> : null}
    </div>
  );
}
