/**
 * The icon set.
 *
 * Hand-drawn paths rather than an icon package, for two reasons that both
 * matter here. The first is weight: a dependency that ships a thousand glyphs so
 * this product can use nine is a dependency that has to be tree-shaken correctly
 * forever. The second is that the answer states are load-bearing — docs/01 §9
 * requires correct / incorrect / partial to be distinguishable by *shape* as
 * well as colour, so these three in particular are drawn to be told apart at a
 * glance and in greyscale, which is not something a generic set guarantees.
 *
 * All of them inherit `currentColor` and size from the `className`, and all are
 * `aria-hidden`: an icon that sits beside its own label is decoration, and a
 * screen reader reading "tick, Correct" is reading it twice.
 */

interface IconProps {
  className?: string;
}

function svg(children: React.ReactNode, className: string | undefined, strokeWidth = 2) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Right. A tick — the examiner's, and the only place this shape appears. */
export function Check({ className }: IconProps) {
  return svg(<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />, className, 2.4);
}

/** Wrong. A cross, which reads as different from a tick even in greyscale. */
export function Cross({ className }: IconProps) {
  return svg(
    <>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </>,
    className,
    2.4,
  );
}

/** Partial credit. A half-filled circle — neither tick nor cross, by design. */
export function HalfMark({ className }: IconProps) {
  return svg(
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor" stroke="none" />
    </>,
    className,
    2,
  );
}

export function ChevronLeft({ className }: IconProps) {
  return svg(<path d="M15 5 8 12l7 7" />, className, 2.2);
}

export function ChevronRight({ className }: IconProps) {
  return svg(<path d="m9 5 7 7-7 7" />, className, 2.2);
}
