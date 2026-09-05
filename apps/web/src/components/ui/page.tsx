import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronLeft } from "@/components/icons";

/**
 * The page frame: one container, one header, one section heading.
 *
 * ## Why this file exists
 *
 * Every signed-in page used to declare its own container. There were five
 * widths (`max-w-5xl`, `6xl`, `90rem`, `96rem`, and one page that used two of
 * them in the same file) and three padding rhythms across sixteen screens. The
 * effect was not subtle: navigating Home → Practice → a chapter moved the left
 * edge of the content twice and the top of the page three times. Nothing was
 * *wrong* on any single page, which is exactly why it survived — the drift is
 * only visible in the transition.
 *
 * The same went for the header. A page title was written nine different ways,
 * the eyebrow above it eight, and the rule under it was sometimes `pb-6`,
 * sometimes `pb-9`, sometimes absent.
 *
 * So the frame is a component and the sizes are tokens. A page cannot pick its
 * own padding any more, which is the point.
 *
 * ## The three widths
 *
 * Not five, and each one has a reason a page can be checked against:
 *
 *   `wide`   — a workspace with columns that need the room: the dashboard,
 *              practice, progress, the teacher and admin surfaces.
 *   `default`— a page that is mostly one column of content to read: a chapter,
 *              a subject, a result, a profile.
 *   `narrow` — a single form or a single reading column, where a wider measure
 *              would hurt: the set builder, an error page.
 *
 * The padding rhythm is the same for all three, because the padding is about
 * the *edge of the screen* — how close text may come to a phone's bezel — and
 * that does not change with the page's content.
 */

const WIDTHS = {
  wide: "max-w-[90rem]",
  default: "max-w-6xl",
  narrow: "max-w-3xl",
} as const;

/**
 * One rhythm, three steps.
 *
 * 16px at the phone bezel, 32px once there is room, 40px on a desktop. The
 * vertical follows the horizontal so the corner of the content block stays
 * square-ish at every size rather than the page growing wide margins and a thin
 * top edge.
 */
const SHELL_PADDING = "px-4 py-6 sm:px-8 sm:py-8 xl:px-10 xl:py-10";

/**
 * The gap between a page's top-level sections.
 *
 * One value, tightened by a step on phones where 28px between every band eats
 * a third of the viewport.
 */
const SHELL_GAP = "gap-6 sm:gap-7";

export function PageShell({
  as = "div",
  width = "default",
  className,
  children,
}: {
  /**
   * `main` where the shell is the page's landmark, `div` where a layout above
   * already supplies one. `(app)` gives every page a `<main id="content">`, so
   * its pages are divs; the admin and teacher-detail layouts do not, so theirs
   * are mains. Two `<main>`s on one page means a screen reader offers a choice
   * of "main content", which is not a choice anyone can make.
   */
  as?: "div" | "main";
  width?: keyof typeof WIDTHS;
  className?: string;
  children: ReactNode;
}) {
  const Tag = as;

  return (
    <Tag
      className={[
        "mx-auto flex w-full flex-col",
        WIDTHS[width],
        SHELL_PADDING,
        SHELL_GAP,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}

/**
 * The uppercase label that sits above a heading.
 *
 * Its size, weight and tracking all live in `--text-eyebrow`, so this component
 * is really about the *colour*, which is the one thing that legitimately
 * varies: saffron on a light page, `brand-300` on the dark desk panel, and a
 * muted grey where the label is a field name rather than a section marker.
 */
export function Eyebrow({
  tone = "brand",
  className,
  children,
}: {
  tone?: "brand" | "muted" | "desk";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    brand: "text-brand-700",
    muted: "text-text-faint",
    desk: "text-brand-300",
  } as const;

  return (
    <p className={["text-eyebrow uppercase", tones[tone], className].filter(Boolean).join(" ")}>
      {children}
    </p>
  );
}

/**
 * The way back out of a detail page.
 *
 * 44px tall like every other control in this product, and a real link rather
 * than `history.back()` — a student who landed on a chapter from a shared URL
 * has no history to go back to, and the chevron should still take them to the
 * subject it belongs to.
 */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="text-text-soft hover:text-text inline-flex min-h-11 items-center gap-1 text-sm font-medium transition-colors"
    >
      <ChevronLeft className="size-4" />
      {children}
    </Link>
  );
}

/**
 * The top of a page.
 *
 * Eyebrow, title, lede, and an action that sits to the right on a wide screen
 * and wraps under the title on a phone. `items-end` rather than `items-start`
 * so a button aligns with the baseline of the lede instead of floating beside
 * the eyebrow.
 *
 * ## The rule underneath
 *
 * On by default. It is what separates "what this page is" from "what is on it",
 * and a page without it reads as one undifferentiated column. The two places it
 * is off are both cases where something else immediately below already draws a
 * horizontal line: the teacher workspace's tab strip, and the dashboard, whose
 * first element is a full-bleed dark panel that provides its own edge.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  back,
  action,
  rule = true,
  titleId,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
  rule?: boolean;
  titleId?: string;
  children?: ReactNode;
}) {
  return (
    <header className={rule ? "border-line border-b pb-6" : undefined}>
      {back ? (
        <div className="mb-3">
          <BackLink href={back.href}>{back.label}</BackLink>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 id={titleId} className="text-text text-title mt-2">
            {title}
          </h1>
          {lede === undefined ? null : (
            <p className="text-text-soft mt-2 max-w-2xl text-sm leading-relaxed">{lede}</p>
          )}
        </div>
        {action === undefined ? null : <div className="shrink-0">{action}</div>}
      </div>

      {children}
    </header>
  );
}

/**
 * The top of a section inside a page.
 *
 * The same shape one level down: eyebrow, heading, optional lede, optional
 * action on the right. `id` is threaded through to the heading rather than to
 * the wrapper, because the thing an `aria-labelledby` on a `<section>` should
 * point at is the heading itself.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  action,
  id,
  tone = "brand",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  action?: ReactNode;
  id?: string;
  tone?: "brand" | "muted" | "desk";
  className?: string;
}) {
  const onDesk = tone === "desk";

  return (
    <div
      className={["flex flex-wrap items-end justify-between gap-x-4 gap-y-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="min-w-0">
        {eyebrow === undefined ? null : <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
        <h2 id={id} className={["text-heading mt-1", onDesk ? "" : "text-text"].join(" ")}>
          {title}
        </h2>
        {lede === undefined ? null : (
          <p
            className={[
              "mt-2 max-w-2xl text-sm leading-relaxed",
              onDesk ? "text-on-desk-soft" : "text-text-soft",
            ].join(" ")}
          >
            {lede}
          </p>
        )}
      </div>
      {action === undefined ? null : <div className="shrink-0">{action}</div>}
    </div>
  );
}
