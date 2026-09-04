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
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-5 py-16 text-center">
      <Wordmark size="sm" tone="brand" />

      <div>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.025em]">
          That didn&rsquo;t load
        </h1>
        <p className="text-text-soft mt-3 leading-relaxed">
          Usually this is the connection rather than your account — nothing you have practised is
          affected. Try again, and if it keeps happening the reference below tells us exactly what
          went wrong.
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
  );
}
