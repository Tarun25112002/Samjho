import Link from "next/link";

import { Check } from "@/components/icons";
import { Wordmark } from "@/components/brand/logo";

/** A short, confident closing page—not a generic mega-footer. */
export function SiteFooter() {
  return (
    <footer className="bg-sand-950 text-white">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="lg:col-span-6">
          <Wordmark size="lg" variant="inverse" tone="inherit" />
          <p className="mt-6 max-w-[38ch] text-sm leading-relaxed text-white/65">
            CBSE board-exam practice for Class 10. Built one question at a time, with the marking
            scheme attached to every one.
          </p>
          <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-white">
            <Check className="text-brand-300 size-4" /> No ads. No tracking. No card.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 lg:col-span-5 lg:col-start-8">
          <div>
            <p className="text-brand-300 text-xs font-semibold tracking-[0.12em] uppercase">
              Start here
            </p>
            <nav aria-label="Footer account links" className="mt-4 flex flex-col gap-3 text-sm">
              <Link
                href="/sign-up"
                className="w-fit text-white/75 transition-colors hover:text-white"
              >
                Create an account
              </Link>
              <Link
                href="/sign-in"
                className="w-fit text-white/75 transition-colors hover:text-white"
              >
                Sign in
              </Link>
            </nav>
          </div>
          <div>
            <p className="text-brand-300 text-xs font-semibold tracking-[0.12em] uppercase">
              Pilot status
            </p>
            <nav aria-label="Footer service links" className="mt-4 flex flex-col gap-3 text-sm">
              <Link
                href="/status"
                className="w-fit text-white/75 transition-colors hover:text-white"
              >
                System status
              </Link>
              <a href="/#parents" className="w-fit text-white/75 transition-colors hover:text-white">
                For parents
              </a>
            </nav>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-5 py-5 text-xs text-white/45 sm:px-8">
          Samjho is a closed pilot. Not affiliated with or endorsed by CBSE.
        </p>
      </div>
    </footer>
  );
}
