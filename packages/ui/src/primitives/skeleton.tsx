/**
 * A block that stands in for content that has not arrived.
 *
 * `docs/01` §8 is specific about this: "Skeletons matching final layout. Never a
 * centred spinner on a full page." The reason is that a spinner tells the reader
 * only that *something* is happening, and the page then jumps into a shape they
 * did not expect. A skeleton the same size as the thing it replaces means the
 * layout does not move when the data lands, which matters most on the surface
 * students use most: a chapter of twenty questions on a mid-range phone.
 *
 * It is `aria-hidden` on purpose. The waiting is announced once, by the
 * `role="status"` region in `DataState`; a screen reader reading out eight
 * decorative grey bars is noise, not information.
 */

export interface SkeletonProps {
  /** Number of placeholder lines. */
  lines?: number;
  /** Last line is drawn short, the way a paragraph's last line usually is. */
  ragged?: boolean;
  className?: string;
}

export function Skeleton({ lines = 3, ragged = true, className }: SkeletonProps) {
  return (
    <div className={["samjho-skeleton", className].filter(Boolean).join(" ")} aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className={[
            "samjho-skeleton__line",
            ragged && index === lines - 1 ? "samjho-skeleton__line--short" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        />
      ))}
    </div>
  );
}
