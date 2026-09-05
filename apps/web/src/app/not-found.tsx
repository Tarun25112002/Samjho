import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/page";
import { Card } from "@/components/ui/surface";

export const metadata: Metadata = { title: "Page not found" };

/**
 * The 404.
 *
 * Written because there wasn't one: `notFound()` is called from the subject and
 * chapter pages, and until now it rendered Next's built-in black-on-white
 * default — inside the signed-in shell, so a student saw the app's own
 * navigation beside a page that looked like a crash.
 *
 * docs/01 §8 asks that an empty state always include the action that fills it.
 * The same applies here: the two most likely reasons to land on this page are a
 * chapter that was deactivated and a link that was mistyped, and both are best
 * answered by a way back to practice rather than by an apology.
 *
 * At the root of `app/`, so it covers every route group — but it still renders
 * inside whichever layout matched the URL. A `notFound()` thrown from
 * `/subjects/[slug]` keeps the signed-in rail around it, which is the right
 * outcome: the student is still signed in, and the navigation out is exactly
 * what they need.
 */
export default function NotFound() {
  return (
    // A div, not a main. Both of these render inside whichever layout matched
    // the route, and every layout in this app already supplies the landmark —
    // two of them on one page means a screen reader offers a choice of "main
    // content", which is not a choice anyone can make.
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 py-12 sm:px-8 sm:py-16">
      <Card pad="roomy" className="shadow-lift relative w-full overflow-hidden text-center">
        {/*
          No giant "404" behind the words any more, and not for want of trying
          to place it. This card is 36rem wide with every line centred in it, so
          a 176px numeral has no corner to live in — centred it sat under the
          wordmark, and bled into the top right it still crossed the "Samjho".
          Two things in the same place is not a layer, it is a collision, and
          the eyebrow directly below already says "Page not found".

          What is left is the same blurred wash the error boundary carries, so
          the two pages a student meets when something has gone wrong finally
          look like the same object.
        */}
        <div
          aria-hidden="true"
          className="bg-brand-100 absolute -top-24 -right-20 size-52 rounded-full blur-3xl"
        />
        <div className="relative flex flex-col items-center gap-6">
          <Link href="/">
            <Wordmark size="sm" tone="brand" />
            <span className="sr-only">Samjho home</span>
          </Link>

          <div>
            <Eyebrow>Page not found</Eyebrow>
            <h1 className="text-text text-notice mt-2">This page isn&rsquo;t here</h1>
            <p className="text-text-soft mt-3 leading-relaxed">
              The link may be mistyped, or the chapter may have been withdrawn while its questions
              are rewritten. Nothing is wrong with your account.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-3">
            <ButtonLink href="/practice">Go to practice</ButtonLink>
            <ButtonLink href="/home" variant="secondary">
              Your dashboard
            </ButtonLink>
          </div>
        </div>
      </Card>
    </div>
  );
}
