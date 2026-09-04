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

/** The dashboard. A roof over a door, not a house with windows — at 20px the
    windows turn into noise. */
export function HomeIcon({ className }: IconProps) {
  return svg(
    <>
      <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M9.5 20v-5.5h5V20" />
    </>,
    className,
  );
}

/** Practice. A pen nib: the thing a student is holding when they use this. */
export function PenIcon({ className }: IconProps) {
  return svg(
    <>
      <path d="M15.2 4.6a2.3 2.3 0 0 1 3.25 3.25L8.6 17.7l-4.1.85.85-4.1z" />
      <path d="M13.4 6.4 16.7 9.7" />
    </>,
    className,
  );
}

/** You. */
export function UserIcon({ className }: IconProps) {
  return svg(
    <>
      <circle cx="12" cy="8.5" r="3.75" />
      <path d="M4.8 20a7.2 7.2 0 0 1 14.4 0" />
    </>,
    className,
  );
}

/** A streak. Deliberately a small flame — the number does the talking. */
export function FlameIcon({ className }: IconProps) {
  return svg(
    <path d="M12 3s.9 3 2.9 4.7C16.6 9.2 18 11 18 13.5a6 6 0 0 1-12 0c0-2 1-3.6 2.2-4.7C9.6 7.5 10 6 10 6s1.4.8 2 2c.6-1.6 0-5 0-5z" />,
    className,
  );
}

/** Saved. Filled when the question is in the list, outlined when it is not. */
export function BookmarkIcon({ className, filled = false }: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? "size-4"}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6.5 4h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4V5a1 1 0 0 1 1-1z" />
    </svg>
  );
}

/** Quick practice — a stack of cards, which is what a set is. */
export function StackIcon({ className }: IconProps) {
  return svg(
    <>
      <rect x="4" y="7.5" width="16" height="12" rx="2.5" />
      <path d="M7 4.5h10" />
    </>,
    className,
  );
}

/** Mistake review. A cross being turned back into a tick is the whole product. */
export function RedoIcon({ className }: IconProps) {
  return svg(
    <>
      <path d="M20 5.5v5h-5" />
      <path d="M19.4 10.5a7.5 7.5 0 1 0-.8 6" />
    </>,
    className,
  );
}

/** Previous-year questions — a dated paper. */
export function PaperIcon({ className }: IconProps) {
  return svg(
    <>
      <path d="M6 3.5h8.5L19 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z" />
      <path d="M14 3.5V8h5" />
      <path d="M8.5 13h7M8.5 16.5h4.5" />
    </>,
    className,
  );
}

/** A filter, for the custom set builder. */
export function SlidersIcon({ className }: IconProps) {
  return svg(
    <>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </>,
    className,
  );
}
