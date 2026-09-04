import Link from "next/link";

import { Wordmark } from "@/components/brand/logo";
import { ChevronLeft } from "@/components/icons";

/**
 * The column the form lives in.
 *
 * Calm on purpose. The indigo panel next to it is doing the talking, so this
 * side is a page background, a lot of space and the fields — no card, no border,
 * no shadow. Wrapping a form in a bordered box beside a full-bleed brand panel
 * is how a two-column sign-in ends up looking like two unrelated screenshots.
 *
 * On a phone the panel is gone, so a short brand band takes its place: it keeps
 * the product's identity above the fold at about 110px, where the desktop panel
 * would have cost the entire first screen.
 */
export function AuthFormColumn({
  mobileHeadline,
  children,
}: {
  mobileHeadline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card flex min-h-screen flex-col lg:min-h-0">
      <div className="border-line bg-page ruled-paper flex items-center gap-4 border-b px-5 py-4 lg:hidden">
        <Wordmark size="sm" tone="brand" />
        <p className="text-text-soft ml-auto max-w-[10.5rem] text-right text-xs leading-snug">
          {mobileHeadline}
        </p>
      </div>

      <div className="flex flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-10 xl:px-20">
        <p className="hidden justify-end lg:flex">
          <Link
            href="/"
            className="text-text-soft hover:text-text inline-flex min-h-11 items-center gap-1 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="size-4" />
            Home
          </Link>
        </p>

        {/*
          `my-auto` rather than `justify-center` on the parent: it centres the
          form on a tall desktop viewport but lets it start at the top and scroll
          normally once Clerk's card grows — a password reset with an error
          banner is a good deal taller than a sign-in.
        */}
        <div className="mx-auto my-auto w-full max-w-[26rem] py-6">{children}</div>

        <p className="text-text-faint mx-auto w-full max-w-[26rem] text-xs lg:hidden">
          <Link href="/" className="hover:text-text-soft underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
