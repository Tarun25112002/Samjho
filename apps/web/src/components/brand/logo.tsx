/**
 * The Samjho mark and wordmark.
 *
 * ## What the mark is
 *
 * An answer box with a tick whose tail carries on past the corner. Both halves
 * come from the thing this product is about: the box is where a CBSE candidate
 * writes, and the tick is what the examiner puts beside it. The break-out is the
 * part that makes it ours — it gives the mark an asymmetric silhouette that
 * survives being 16px in a browser tab, where a tick inside a square is
 * indistinguishable from every other ed-tech logo ever drawn.
 *
 * The tick is near-black on saffron rather than white on saffron, for the same
 * reason the primary button is: white on `brand-500` measures 2.9:1 and is
 * illegible at 20px. It also means the mark and the main call to action are
 * visibly the same object, which is worth more than a conventional knockout.
 *
 * No `<mask>` and no generated ids: the tail is simply a second stroke. An icon
 * rendered from a Server Component cannot call `useId`, and a hard-coded id
 * duplicated across four instances on one page is invalid HTML for no gain.
 */

export type MarkVariant = "solid" | "inverse";

export function Mark({
  className = "size-7",
  variant = "solid",
}: {
  className?: string;
  variant?: MarkVariant;
}) {
  // `inverse` is for saffron-filled surfaces, where the box has to be the light
  // shape or it disappears into its own background.
  const box = variant === "solid" ? "var(--color-brand-500)" : "#ffffff";
  const tick = variant === "solid" ? "var(--color-on-brand)" : "var(--color-brand-700)";

  return (
    <svg viewBox="0 0 28 28" className={className} aria-hidden="true" focusable="false">
      <rect x="2.5" y="4.5" width="19" height="19" rx="6" fill={box} />
      <path
        d="M8.4 14.6 L12.5 18.7 L20 9.9"
        fill="none"
        stroke={tick}
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The tail. It leaves the box, which is the whole idea. */}
      <path
        d="M20 9.9 L25.4 3.2"
        fill="none"
        stroke={box}
        strokeWidth="3.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Mark plus name.
 *
 * `tone` is the name's colour, and the choice is not decorative. Saffron at
 * 30px is large text and clears 3:1 on white; the same orange on a 17px
 * navigation wordmark would not, so the app chrome uses `ink`. One prop, two
 * legitimate uses, and no way to pick the illegible combination by accident.
 *
 * `समझो` sits under the latin name at the largest size only. It is not
 * decoration — the word *is* the product's promise, and a good share of the
 * audience reads it faster than they read "Samjho". Poppins carries Devanagari,
 * so both lines are set in the same family rather than in whatever face the
 * operating system happened to substitute.
 */
export function Wordmark({
  size = "md",
  variant = "solid",
  tone = "ink",
  className,
}: {
  size?: "sm" | "md" | "lg";
  variant?: MarkVariant;
  tone?: "ink" | "brand" | "inherit";
  className?: string;
}) {
  const mark = { sm: "size-6", md: "size-7", lg: "size-10" }[size];
  const type = { sm: "text-prose", md: "text-xl", lg: "text-3xl" }[size];
  const colour = { ink: "text-text", brand: "text-brand-600", inherit: "" }[tone];

  return (
    <span
      className={["inline-flex items-center gap-2.5", colour, className].filter(Boolean).join(" ")}
    >
      <Mark className={mark} variant={variant} />
      <span className="flex flex-col leading-none">
        <span className={`${type} font-semibold tracking-[-0.03em]`}>Samjho</span>
        {size === "lg" ? (
          <span className="mt-1.5 text-sm font-medium opacity-70" lang="hi">
            समझो
          </span>
        ) : null}
      </span>
    </span>
  );
}
