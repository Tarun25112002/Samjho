"use client";

import { useEffect } from "react";

import { Wordmark } from "@/components/brand/logo";
import { Button, ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/page";
import { Card } from "@/components/ui/surface";

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
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-12 sm:px-8 sm:py-16">
      <Card pad="roomy" className="shadow-lift relative w-full overflow-hidden text-center">
        {/* Blurred, like every other decorative blob in the product. Hard-edged
            it read as a beige rectangle clipped by the corner rather than as a
            wash behind the card. */}
        <div
          aria-hidden="true"
          className="bg-brand-100 absolute -top-24 -right-20 size-52 rounded-full blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-6">
          {/*
            The wordmark and nothing above it, which is what the 404 beside this
            page has always done. There used to be a saffron "!" badge stacked
            on top of it — two orange marks, one above the other, at the same
            spacing as everything else on the card, so the page opened with what
            read as two logos. The eyebrow directly below already says
            "Temporary problem", in the same saffron, in words.
          */}
          <Wordmark size="sm" tone="brand" />

          <div>
            <Eyebrow>Temporary problem</Eyebrow>
            <h1 className="text-text text-notice mt-2">That didn&rsquo;t load</h1>
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
      </Card>
    </div>
  );
}
