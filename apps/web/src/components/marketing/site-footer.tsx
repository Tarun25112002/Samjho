import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";

/**
 * The footer.
 *
 * Four links and a sentence. A closed pilot with two subjects does not have a
 * company, a careers page or six columns of navigation, and inventing them is
 * the fastest way to look like a template.
 */
export function SiteFooter() {
  return (
    <footer className="border-line border-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-12 sm:px-8 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-sm">
          <Wordmark size="sm" />
          <p className="text-text-soft mt-4 text-sm leading-relaxed">
            CBSE board-exam practice for Class 10. Built question by question, with the marking
            scheme attached to every one of them.
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-10 gap-y-3 text-sm">
          <Link href="/sign-up" className="text-text hover:text-brand-700 font-medium">
            Create an account
          </Link>
          <Link href="/sign-in" className="text-text hover:text-brand-700 font-medium">
            Sign in
          </Link>
          <Link href="/status" className="text-text-soft hover:text-text">
            System status
          </Link>
        </nav>
      </div>

      <div className="border-line border-t">
        <p className="text-text-faint mx-auto max-w-6xl px-5 py-6 text-xs sm:px-8">
          Samjho is in a closed pilot. Not affiliated with or endorsed by CBSE.
        </p>
      </div>
    </footer>
  );
}
