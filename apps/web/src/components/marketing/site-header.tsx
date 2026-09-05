import { Show } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { ButtonLink } from "@/components/ui/button";

const LINKS = [
  // These links are rendered on `/status` too. Absolute fragments keep them
  // useful there instead of pointing at IDs that only exist on the home page.
  { href: "/#how", label: "How it works" },
  { href: "/#inside", label: "What you get" },
  { href: "/#parents", label: "For parents" },
];

/**
 * The marketing header.
 *
 * A Server Component, which is the whole reason `<Show>` is worth using: the
 * correct branch — "Start practising" for a visitor, "Go to your dashboard" for
 * someone already signed in — is in the initial HTML. The client-side version of
 * this always flashes the wrong button while the SDK boots, and on a slow
 * connection it flashes it for a second.
 *
 * The mobile menu needs state, so it is the one client component here, and it
 * is passed the session as a boolean rather than reaching for it itself.
 *
 * Sticky with a hairline and a blur, and no scroll listener. A header that
 * grows a border at 40px of scroll is a listener, a re-render and a class
 * toggle to buy an effect nobody has ever mentioned noticing.
 */
export async function SiteHeader() {
  const { userId } = await auth();

  return (
    <header className="border-line bg-page/85 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-6xl items-center gap-8 px-5 sm:px-8 lg:h-20">
        <Link href="/" className="shrink-0">
          <Wordmark size="sm" />
          <span className="sr-only">Samjho home</span>
        </Link>

        <nav aria-label="Site" className="hidden items-center gap-8 lg:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-text-soft hover:text-text text-[0.9375rem] font-medium transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <p className="border-line bg-card text-text-soft hidden items-center gap-2 rounded-pill border px-3 py-1.5 text-xs font-medium xl:flex">
          <span className="bg-tick-600 size-1.5 rounded-full" aria-hidden="true" />
          Question-first practice
        </p>

        <div className="ml-auto flex items-center gap-3">
          <Show
            when="signed-out"
            fallback={
              <div className="hidden lg:block">
                <ButtonLink href="/home" size="sm">
                  Go to your dashboard
                </ButtonLink>
              </div>
            }
          >
            <Link
              href="/sign-in"
              className="text-text-soft hover:text-text hidden min-h-11 items-center text-[0.9375rem] font-medium transition-colors lg:inline-flex"
            >
              Sign in
            </Link>
            {/* `ButtonLink` is itself `inline-flex`, which overrides a `hidden`
                utility at small widths. Hide a neutral wrapper instead so the
                compact phone header contains just the menu trigger. */}
            <div className="hidden lg:block">
              <ButtonLink href="/sign-up" size="sm">
                Start practising free
              </ButtonLink>
            </div>
          </Show>

          <MobileNav links={LINKS} signedIn={userId !== null} />
        </div>
      </div>
    </header>
  );
}
