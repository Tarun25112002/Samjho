"use client";

import { useEffect } from "react";

import { Wordmark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";

/**
 * The last line of defence.
 *
 * Every page in this app fetches from the API, and `lib/api-client.ts` throws
 * rather than returning a failure — deliberately, so that a page cannot render
 * half a dashboard from a failed request. What was missing was the thing that
 * catches the throw: without this file, an API outage gave a student Next's
 * unstyled error screen, or in production a blank page.
 *
 * ## What it says, and what it does not
 *
 * "Your hostel wifi dropped" is the likeliest cause by a wide margin, and it is
 * the one the student can do something about, so the copy leads there. It does
 * not print `error.message`: those strings come from upstream and can carry a
 * URL, a query or a stack frame, none of which belongs on a fourteen-year-old's
 * screen. The `digest` does go on the page — it is the id that pins this exact
 * failure in the server logs, and quoting it is the fastest support conversation
 * available.
 *
 * `reset()` re-renders the segment rather than reloading the document, so a
 * transient failure costs a tap and nothing else.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The browser console is where a developer will look first; the server has
    // the real record under the same digest.
    console.error("Unhandled error boundary", error);
  }, [error]);

  return (
    // A div, not a main. Both of these render inside whichever layout matched
    // the route, and every layout in this app already supplies the landmark —
    // two of them on one page means a screen reader offers a choice of "main
    // content", which is not a choice anyone can make.
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 py-12 sm:px-8 sm:py-16">
      <section className="rounded-panel border-line bg-card relative w-full overflow-hidden border px-6 py-10 text-center shadow-lift sm:px-10 sm:py-12">
        <div
          aria-hidden="true"
          className="bg-brand-50 absolute -top-20 -right-20 size-48 rounded-full"
        />
        <div className="relative flex flex-col items-center gap-6">
          <span className="border-brand-200 bg-brand-50 grid size-14 place-items-center rounded-2xl border text-brand-700">
            <span className="text-xl font-semibold">!</span>
          </span>
          <Wordmark size="sm" tone="brand" />

          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Temporary problem
            </p>
            <h1 className="text-text mt-2 text-3xl font-semibold tracking-[-0.03em]">
              That didn&rsquo;t load
            </h1>
            <p className="text-text-soft mt-3 leading-relaxed">
              This is usually a connection problem, not your account. Your practice is safe—try
              again, and use the reference below if it keeps happening.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Try again</Button>
            <ButtonLink href="/home" variant="secondary">
              Your dashboard
            </ButtonLink>
          </div>

          {error.digest === undefined ? null : (
            <p className="text-text-faint text-xs">
              Reference: <code className="font-mono">{error.digest}</code>
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
