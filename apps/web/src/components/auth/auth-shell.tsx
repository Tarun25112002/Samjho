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
  context,
  children,
}: {
  mobileHeadline: string;
  context: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-page relative flex min-h-dvh flex-col overflow-hidden xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain">
      {/* A single vertical register rule makes the form column read as the
          other half of the answer sheet, not an unrelated white panel. */}
      <div
        aria-hidden="true"
        className="auth-form-margin pointer-events-none absolute inset-y-0 left-10 hidden xl:block"
      />

      <div className="border-line bg-page ruled-paper flex items-center gap-4 border-b px-5 py-4 xl:hidden">
        <Wordmark size="sm" tone="brand" />
        <p className="text-text-soft ml-auto max-w-[10.5rem] text-right text-xs leading-snug">
          {mobileHeadline}
        </p>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-5 py-8 sm:px-8 lg:px-12 lg:py-7 xl:px-16">
        <p className="hidden justify-end xl:flex">
          <Link
            href="/"
            className="text-text-soft hover:text-text inline-flex min-h-11 items-center gap-1 text-sm font-medium transition-colors"
          >
            <ChevronLeft className="size-4" />
            Home
          </Link>
        </p>

        {/*
          On a phone the form begins near the identity band rather than floating
          in a large blank field. From `xl` up, `my-auto` centres it on a tall
          viewport while still letting a longer Clerk step (such as password
          reset) use the whole column and scroll normally.
        */}
        <div className="mx-auto w-full max-w-[29rem] pt-9 pb-6 sm:pt-12 xl:my-auto xl:py-4">
          {/* Clerk mounts its controls client-side. Keeping this introduction
              outside the form surface prevents an empty bordered card from
              flashing while that mount is happening on a slow connection. */}
          <div className="border-line mb-4 flex items-center gap-3 border-b pb-3">
            <span className="bg-brand-500 grid size-8 place-items-center rounded-full text-xs font-bold text-on-brand">
              S
            </span>
            <p className="text-text-soft text-sm leading-snug">{context}</p>
          </div>
          {children}
        </div>

        <p className="text-text-faint mx-auto w-full max-w-[29rem] text-xs xl:hidden">
          <Link href="/" className="hover:text-text-soft underline underline-offset-2">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
