"use client";

import { AI_ACTION_LABELS, type AIAction, type AIQuota } from "@samjho/contracts";
import { MathText } from "@samjho/ui";
import { useEffect, useRef, useState } from "react";

import { ChevronRight, SparkIcon } from "@/components/icons";
import { useTutor, type TutorInput, type TutorTurn } from "./use-tutor";

/**
 * "Stuck? Ask the tutor" — the hint ladder, under the question.
 *
 * ## Why it starts closed, and why that is the pedagogy
 *
 * docs/00's rule is that when a feature could give the answer or get the
 * student to the answer, it chooses the latter; docs/05 §3 says the default
 * path is hints and a full solution is one tap further. A panel that opened
 * itself, or led with "Solve step-by-step", would quietly invert both. So the
 * entry point is one quiet row, the ladder is ordered by how much each rung
 * gives away, and the two cheapest rungs come first.
 *
 * It is also why "Solve step-by-step" is *present* rather than hidden behind a
 * confirmation. A student who wants the answer will find it — in the feedback
 * panel, in a friend's notebook, on a search engine — and making the product
 * annoying about it buys nothing except the student going somewhere worse.
 *
 * ## The disclaimer is not a footnote
 *
 * docs/05 §3 requires a visible statement that the AI can be wrong and the
 * stored solution is authoritative. It sits above the transcript, where it is
 * read before the answer rather than after it, and a degraded reply says so on
 * the reply itself rather than only in a banner.
 */
export function TutorPanel(props: TutorInput) {
  const tutor = useTutor(props);

  return (
    <section
      aria-label="AI tutor"
      className="rounded-panel border-line bg-card overflow-hidden border"
    >
      <button
        type="button"
        aria-expanded={tutor.open}
        onClick={() => {
          tutor.setOpen(!tutor.open);
        }}
        className="hover:bg-raised/60 flex min-h-14 w-full items-center gap-3 px-5 text-left transition-colors sm:px-6"
      >
        <SparkIcon className="text-brand-600 size-5 shrink-0" />
        <span className="text-text text-[0.9375rem] font-semibold">
          {props.answered ? "Ask the tutor about this" : "Stuck? Ask the tutor"}
        </span>
        <ChevronRight
          className={[
            "text-text-faint ml-auto size-5 shrink-0 transition-transform duration-150",
            tutor.open ? "rotate-90" : "",
          ].join(" ")}
        />
      </button>

      {tutor.open ? (
        <div className="border-line flex flex-col gap-4 border-t p-5 sm:p-6">
          <p className="text-text-faint text-xs leading-relaxed">
            The tutor can make mistakes. The solution in the question bank is the one that counts.
          </p>

          {tutor.turns.length > 0 ? <Transcript turns={tutor.turns} /> : null}

          {tutor.failure ? (
            <p
              role="alert"
              className="rounded-control border-marker-200 bg-marker-50 text-marker-700 border px-4 py-3 text-sm"
            >
              {tutor.failure.message}
            </p>
          ) : null}

          <ActionLadder
            actions={tutor.actions}
            busy={tutor.busy}
            onAsk={(action) => void tutor.ask(action)}
          />

          {tutor.turns.length > 0 ? (
            <FollowUp busy={tutor.busy} onAsk={(text) => void tutor.ask("SIMPLER", text)} />
          ) : null}

          {tutor.quota ? <QuotaLine quota={tutor.quota} /> : null}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The ladder, in the order the docs define.
 *
 * Not a dropdown and not a text box. Each action gets its own prompt template
 * and its own model on the server, so the action *is* the request — turning it
 * into free text on this side would throw that away and hand the student a
 * chatbot with a syllabus.
 */
function ActionLadder({
  actions,
  busy,
  onAsk,
}: {
  actions: AIAction[];
  busy: boolean;
  onAsk: (action: AIAction) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          disabled={busy}
          onClick={() => {
            onAsk(action);
          }}
          className={[
            "rounded-pill min-h-11 border px-3.5 text-sm font-medium transition-colors",
            "border-line-strong text-text-soft hover:border-brand-300 hover:text-text",
            "disabled:cursor-not-allowed disabled:opacity-55",
            // The one rung that gives everything away is drawn quieter than the
            // rest, rather than being hidden. It is available; it is just not
            // the thing the eye lands on first.
            action === "STEP_BY_STEP" ? "text-text-faint" : "",
          ].join(" ")}
        >
          {AI_ACTION_LABELS[action]}
        </button>
      ))}
    </div>
  );
}

/**
 * The conversation so far.
 *
 * Replies render through `MathText` because a tutor explaining a numerical
 * question writes LaTeX — the system prompt requires it — and an unrendered
 * `$\frac{1}{2}$` in the middle of an explanation is worse than no explanation.
 */
function Transcript({ turns }: { turns: TutorTurn[] }) {
  const end = useRef<HTMLDivElement>(null);

  // Follow the text as it streams, but only within the transcript. `block:
  // "nearest"` keeps the page where the student put it — scrolling the whole
  // window to chase a tutor reply would yank the question off screen.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  return (
    <div className="flex flex-col gap-3">
      {turns.map((turn) =>
        turn.role === "USER" ? (
          <p
            key={turn.id}
            className="bg-raised text-text-soft rounded-control self-end px-3.5 py-2 text-sm font-medium"
          >
            {turn.content}
          </p>
        ) : (
          <div key={turn.id} className="flex flex-col gap-2">
            {turn.degraded ? (
              <p className="text-half-700 bg-half-50 border-half-200 rounded-control border px-3 py-2 text-xs leading-relaxed">
                The tutor is unavailable right now, so this is the official solution from our
                question bank.
              </p>
            ) : null}

            <div className="text-text font-serif text-[0.9375rem] leading-[1.7]">
              {turn.content ? <MathText>{turn.content}</MathText> : null}
              {turn.streaming ? <Caret /> : null}
            </div>
          </div>
        ),
      )}
      <div ref={end} />
    </div>
  );
}

/**
 * A blinking caret while the answer arrives.
 *
 * The whole reason this endpoint streams is that a spinner for eight seconds
 * reads as broken while moving text reads as a tutor thinking — but the gap
 * before the *first* token is still a few seconds of nothing. The caret fills
 * exactly that gap, and then keeps marking where the text is up to.
 */
function Caret() {
  return (
    <span
      aria-label="The tutor is writing"
      role="status"
      className="bg-brand-500 ml-0.5 inline-block h-[1.05em] w-[2px] animate-pulse align-text-bottom"
    />
  );
}

/**
 * A follow-up in the student's own words.
 *
 * Appears only after the tutor has said something, because that is what makes
 * the box answerable — "but why is it negative?" refers to a previous reply,
 * and an empty box under an empty transcript is an invitation to use this as a
 * general chatbot, which it is not.
 *
 * Capped at 500 characters to match the contract, so the limit is visible here
 * rather than arriving as a validation error.
 */
function FollowUp({ busy, onAsk }: { busy: boolean; onAsk: (text: string) => void }) {
  const [text, setText] = useState("");
  const trimmed = text.trim();

  return (
    <form
      className="flex gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (!trimmed || busy) return;
        onAsk(trimmed);
        setText("");
      }}
    >
      <input
        type="text"
        value={text}
        maxLength={500}
        disabled={busy}
        placeholder="Ask a follow-up…"
        aria-label="Ask the tutor a follow-up question"
        onChange={(event) => {
          setText(event.target.value);
        }}
        className="rounded-control border-line-strong bg-card text-text placeholder:text-text-faint focus:border-brand-500 min-h-11 flex-1 border px-3.5 text-sm outline-none disabled:opacity-55"
      />
      <button
        type="submit"
        disabled={busy || trimmed.length === 0}
        className="rounded-pill bg-brand-500 text-on-brand hover:bg-brand-400 min-h-11 shrink-0 px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55"
      >
        Ask
      </button>
    </form>
  );
}

/**
 * What is left of today's allowance.
 *
 * Shown only once the student has actually used a message, and only when it is
 * getting low. A counter on screen from the first tap turns a generous limit
 * into something to ration; a limit that arrives unannounced at message thirty
 * feels punitive (docs/05 §5.1). The middle is a number that appears when it
 * starts to matter.
 */
function QuotaLine({ quota }: { quota: AIQuota }) {
  if (quota.messagesRemaining > 5) return null;

  return (
    <p className="text-text-faint text-xs">
      {quota.messagesRemaining === 0
        ? "You have used today's tutor allowance. It resets after midnight, and the full solution is always on this page."
        : `${String(quota.messagesRemaining)} tutor ${quota.messagesRemaining === 1 ? "question" : "questions"} left today.`}
    </p>
  );
}
