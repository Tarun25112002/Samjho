import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { Check } from "@/components/icons";
import { Eyebrow } from "@/components/ui/page";

/** A short, confident closing page—not a generic mega-footer. */
export function SiteFooter() {
  return (
    <footer className="bg-desk text-on-desk">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 lg:grid-cols-12 lg:gap-8 lg:py-16">
        <div className="lg:col-span-6">
          <Wordmark size="lg" variant="inverse" tone="inherit" />
          <p className="text-on-desk-soft mt-6 max-w-[38ch] text-sm leading-relaxed">
            CBSE board-exam practice for Class 10. Built one question at a time, with the marking
            scheme attached to every one.
          </p>
          <p className="text-on-desk mt-5 inline-flex items-center gap-2 text-sm font-medium">
            <Check className="text-brand-300 size-4" /> No ads. No tracking. No card.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8 lg:col-span-5 lg:col-start-8">
          <div>
            <Eyebrow tone="desk">Start here</Eyebrow>
            <nav aria-label="Footer account links" className="mt-4 flex flex-col gap-3 text-sm">
              <FooterLink href="/sign-up">Create an account</FooterLink>
              <FooterLink href="/sign-in">Sign in</FooterLink>
            </nav>
          </div>
          <div>
            <Eyebrow tone="desk">Pilot status</Eyebrow>
            <nav aria-label="Footer service links" className="mt-4 flex flex-col gap-3 text-sm">
              <FooterLink href="/status">System status</FooterLink>
              <FooterLink href="/#parents">For parents</FooterLink>
            </nav>
          </div>
        </div>
      </div>

      <div className="border-desk-line border-t">
        <p className="text-on-desk-faint mx-auto max-w-6xl px-5 py-5 text-xs sm:px-8">
          Samjho is a closed pilot. Not affiliated with or endorsed by CBSE.
        </p>
      </div>
    </footer>
  );
}

/**
 * One footer destination.
 *
 * 44px tall like every other link a thumb has to find. These were bare `<Link>`s
 * at whatever height the text happened to be — about 20px, stacked 12px apart,
 * which on a phone is four targets a finger cannot reliably separate.
 */
function FooterLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="text-on-desk-soft hover:text-on-desk inline-flex min-h-11 w-fit items-center transition-colors"
    >
      {children}
    </Link>
  );
}
