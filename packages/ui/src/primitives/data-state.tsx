import type { ReactNode } from "react";

import type { DisplayError } from "./display-error.js";
import { Skeleton } from "./skeleton.js";

/**
 * The four states every piece of remote data has, in one place.
 *
 * Written now, before there is much data to fetch, because the alternative is
 * what always happens otherwise: each page invents its own spinner, half of them
 * forget the empty case, and the error case becomes a blank screen that a
 * student reads as "the app is broken" — when it usually means "your hostel
 * wifi dropped".
 *
 * The empty state is the one that earns this component its place. A chapter with
 * no questions yet is *normal* for a platform building its bank from zero
 * (docs/07 R1), and it will stay normal for months. It deserves a real message
 * and a way forward, not an empty list that looks like a bug.
 *
 * ## Why this can be rendered from a Server Component
 *
 * There is no `"use client"` here, deliberately. `children` is a *function* of
 * the data, and a function cannot cross the server/client boundary — marking
 * this module client-only would make it unusable from the very pages that need
 * it most. So it stays a plain component that renders in whichever environment
 * its caller lives in. The one consequence: `onRetry` may only be passed from a
 * Client Component, because it becomes a real `onClick`. That is the correct
 * constraint anyway — retrying is interaction, and a server-rendered list has no
 * client state to retry into.
 */

export interface DataStateProps<T> {
  loading?: boolean;
  /** Build with `describeError`, which is what keeps internals off the page. */
  error?: DisplayError | null;
  data: T | null | undefined;
  /** Treated as empty when this returns true. Defaults to "empty array". */
  isEmpty?: (data: T) => boolean;
  /**
   * Loading placeholder. Defaults to a skeleton; pass one shaped like the real
   * content when the default's proportions are wrong (docs/01 §8).
   */
  loadingFallback?: ReactNode;
  /** Announced to screen readers while loading, since the skeleton is silent. */
  loadingLabel?: string;
  emptyTitle?: string;
  emptyBody?: ReactNode;
  /**
   * The thing that fills the emptiness — a link to a chapter, a "start
   * practising" button. `docs/01` §8: an empty state "always includes the action
   * that fills it". A dead end that says "nothing here" is a bug report waiting
   * to happen.
   */
  emptyAction?: ReactNode;
  /** Client Components only. Omitted means no "Try again" button is offered. */
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
  children: (data: T) => ReactNode;
}

function defaultIsEmpty(data: unknown): boolean {
  return Array.isArray(data) && data.length === 0;
}

function classes(...values: (string | false | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}

export function DataState<T>({
  loading = false,
  error = null,
  data,
  isEmpty = defaultIsEmpty,
  loadingFallback,
  loadingLabel = "Loading…",
  emptyTitle = "Nothing here yet",
  emptyBody,
  emptyAction,
  onRetry,
  retryLabel = "Try again",
  className,
  children,
}: DataStateProps<T>) {
  // Error first. A failed request that returned no data would otherwise fall
  // through to the empty branch and tell the student "nothing here yet" — which
  // is a lie, and the kind that makes someone stop trusting a number they see.
  if (error) {
    return (
      <div role="alert" className={classes("samjho-state", "samjho-state--error", className)}>
        <p className="samjho-state__title">{error.message}</p>

        {error.requestId ? (
          // The id from the API's error envelope. A student can quote it and it
          // pins the exact request in the logs — which is the entire reason
          // requestId exists.
          <p className="samjho-state__meta">
            Reference: <code>{error.requestId}</code>
          </p>
        ) : null}

        {/*
          Only offered when retrying could actually help. A "Try again" button
          under a 404 teaches people that buttons here do nothing.
        */}
        {onRetry && error.retryable ? (
          <p className="samjho-state__actions">
            <button type="button" className="samjho-state__retry" onClick={onRetry}>
              {retryLabel}
            </button>
          </p>
        ) : null}
      </div>
    );
  }

  if (loading) {
    return (
      // `role="status"` with polite live semantics, so a screen reader announces
      // the wait instead of leaving the user in silence while the skeleton — which
      // is aria-hidden — does the visual work.
      <div role="status" aria-live="polite" className={classes("samjho-state--loading", className)}>
        <span className="samjho-visually-hidden">{loadingLabel}</span>
        {loadingFallback ?? <Skeleton />}
      </div>
    );
  }

  if (data === null || data === undefined || isEmpty(data)) {
    return (
      <div className={classes("samjho-state", "samjho-state--empty", className)}>
        <p className="samjho-state__title">{emptyTitle}</p>
        {emptyBody ? <div className="samjho-state__body">{emptyBody}</div> : null}
        {emptyAction ? <div className="samjho-state__actions">{emptyAction}</div> : null}
      </div>
    );
  }

  return <>{children(data)}</>;
}
