"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The countdown on a timed set.
 *
 * ## It counts to an instant, not from a duration
 *
 * The props pair `deadlineAt` — the absolute instant the API computed — with a
 * `clockAnchor` from the API response that rendered the active session. Every
 * tick subtracts the elapsed
 * browser-monotonic time from that server-derived remaining time, rather than
 * trusting the device's editable wall clock. That difference matters in three
 * ordinary situations, all of which happen on a school phone:
 *
 *  - **The tab is backgrounded.** Mobile browsers throttle `setInterval` in
 *    hidden tabs, sometimes to once a minute. A decrementing counter loses
 *    exactly as much time as the browser withheld, so a student who locks their
 *    phone for ten minutes comes back with ten minutes they did not earn.
 *  - **The page is reloaded.** The new server anchor includes elapsed time; a
 *    duration does not start again from the top.
 *  - **The device clock is wrong.** Moving a phone's wall clock cannot make a
 *    set close early. The API still refuses late submissions against its stored
 *    deadline, which covers a browser that was asleep too long to repaint.
 *
 * ## Why it fires a callback instead of submitting
 *
 * Reaching zero calls `onExpire` once, and the runner decides what that means.
 * The alternative — this component posting to the API — would put a network
 * write inside a `setInterval` in a component that unmounts on navigation, which
 * is the shape of bug that fires twice on a slow connection and once after the
 * student has already left the page.
 */
export function SessionTimer({
  deadlineAt,
  clockAnchor,
  onExpire,
}: {
  deadlineAt: string;
  /** An API-checked server instant, supplied by the active-session page. */
  clockAnchor: string;
  onExpire: () => void;
}) {
  /*
   * A Client Component is still pre-rendered by Next. Reading a clock in the
   * state initializer would make the server's first timer text differ from the
   * browser's hydration text, and `Date.now()` would trust a device clock that
   * can be wrong or changed mid-set.
   *
   * Keep the initial output intentionally clock-free, then take the first
   * reading in the effect below. The server remains authoritative about the
   * deadline; this only ensures the display joins it after hydration.
   */
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  /**
   * `onExpire` through a ref so the interval is not torn down and rebuilt every
   * time the parent re-renders with a new closure — which, in the runner, is on
   * every keystroke in a long-answer box.
   */
  const expireRef = useRef(onExpire);
  expireRef.current = onExpire;

  /** Guards against a second call if a tick lands while the parent is settling. */
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
    const startedAt = performance.now();
    const initialRemaining = remainingFrom(deadlineAt, clockAnchor);

    const tick = () => {
      const elapsed = Math.max(0, performance.now() - startedAt);
      const remaining = Math.max(0, initialRemaining - elapsed);
      setRemainingMs(remaining);

      if (remaining <= 0 && !firedRef.current) {
        firedRef.current = true;
        expireRef.current();
      }
    };

    tick();
    // Every 500ms rather than every 1000. A one-second interval drifts against
    // the wall clock, so the displayed number visibly skips a second every
    // minute or so — a distracting thing to watch on a screen where the number
    // is the point.
    const timer = setInterval(tick, 500);

    return () => {
      clearInterval(timer);
    };
  }, [clockAnchor, deadlineAt]);

  const ready = remainingMs !== null;
  const expired = ready && remainingMs <= 0;
  // Under two minutes. Chosen because it is long enough to finish the question
  // in hand: a warning that arrives at ten seconds is a jump scare, not a cue.
  const urgent = ready && !expired && remainingMs < 2 * 60 * 1000;

  return (
    <div
      className={[
        "rounded-pill inline-flex shrink-0 items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold tabular-nums",
        expired
          ? "border-line-strong text-text-faint"
          : // `marker` is the palette's red — the colour a teacher's pen makes,
            // already carrying "this went wrong" everywhere else in the product.
            // Reaching for it here means the urgent state needs no explanation.
            urgent
            ? "border-marker-200 bg-marker-50 text-marker-700"
            : "border-line-strong text-text-soft",
      ].join(" ")}
      role="timer"
      aria-live="off"
      // The label is the whole message for a screen reader; the digits alone
      // read as a bare number with no indication of what it counts.
      aria-label={
        !ready
          ? "Checking time remaining"
          : expired
            ? "Time is up"
            : `${formatClock(remainingMs)} remaining`
      }
    >
      <ClockIcon className="size-4" />
      {/*
        `aria-hidden` on the digits and a live region on nothing: a countdown
        announced every tick is unusable with a screen reader, and the two
        moments that matter — starting, and running out — are announced by the
        surrounding UI instead.
      */}
      <span aria-hidden>{!ready ? "—" : expired ? "Time up" : formatClock(remainingMs)}</span>
      {expired ? (
        <span role="alert" className="sr-only">
          Time is up. Your set is being marked.
        </span>
      ) : null}
    </div>
  );
}

function remainingFrom(deadlineAt: string, clockAnchor: string): number {
  return Math.max(0, Date.parse(deadlineAt) - Date.parse(clockAnchor));
}

/**
 * `m:ss` under an hour, `h:mm:ss` over it.
 *
 * Dropping the hour when there is none keeps the common case — a thirty-minute
 * set — at four characters rather than seven, which is what lets it sit in the
 * runner's header on a 360px screen without pushing Exit off the edge.
 */
function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const mm = String(minutes).padStart(hours > 0 ? 2 : 1, "0");
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${String(hours)}:${mm}:${ss}` : `${mm}:${ss}`;
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
