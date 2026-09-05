import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

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
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-5 py-12 sm:px-8 sm:py-16">
      <section className="rounded-panel border-line bg-card relative w-full overflow-hidden border px-6 py-10 text-center shadow-lift sm:px-10 sm:py-12">
        <p
          aria-hidden="true"
          className="text-brand-100 pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 text-[10rem] leading-none font-semibold tracking-[-0.08em] sm:text-[13rem]"
        >
          404
        </p>
        <div className="relative flex flex-col items-center gap-6">
          <Link href="/">
            <Wordmark size="sm" tone="brand" />
            <span className="sr-only">Samjho home</span>
          </Link>

          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Page not found
            </p>
            <h1 className="text-text mt-2 text-3xl font-semibold tracking-[-0.03em]">
              This page isn&rsquo;t here
            </h1>
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
      </section>
    </div>
  );
}
