import type { ReactNode } from "react";

/**
 * The surfaces a page is built from.
 *
 * ## Why a component rather than a class string people copy
 *
 * `rounded-panel border-line bg-card border p-5 sm:p-6` appeared eighteen times
 * before this file existed, and — because it was copied rather than imported —
 * six near-misses appeared with it: `p-6`, `p-5`, `p-6 sm:p-8`, `p-7 sm:p-9`,
 * `p-5 shadow-lift sm:p-8`, `p-4`. Six paddings for one object. The eye does
 * not read that as six carefully chosen sizes; it reads it as a page that was
 * not finished.
 *
 * ## The tones
 *
 * `card` is the default and the overwhelming majority: white paper on the sand
 * page. `brand` is the one card per screen that is asking for something — the
 * assignment waiting to be started, the set waiting to be resumed. `desk` is
 * the dark panel, which has its own semantic colour set (see `--color-desk` in
 * globals.css) so that the three dark panels in this product stop being three
 * different dark panels.
 *
 * A page with two `brand` cards has told the reader nothing, which is the same
 * rule the primary button follows.
 */

const TONES = {
  card: "border-line bg-card border",
  brand: "border-brand-200 bg-brand-50 border",
  desk: "bg-desk text-on-desk",
  raised: "border-line bg-raised border",
} as const;

/**
 * Four paddings, and the reason each exists.
 *
 * `default` is a card in a grid of cards. `roomy` is a card that is the only
 * thing in its column — an empty state, a first-run panel, a dark hero — where
 * the same padding would leave the content marooned in the middle of a large
 * rectangle. `tight` is a card nested inside another card. `flush` is for a
 * card whose children own their own padding: a divided list, a header strip
 * over a body.
 */
const PADS = {
  default: "p-5 sm:p-6",
  roomy: "p-6 sm:p-8",
  tight: "p-4",
  flush: "",
} as const;

/** The inner padding a `flush` card's own bands must use to line up with the rest. */
export const flushBandClass = "px-5 py-5 sm:px-6";

/**
 * The card, as a class string, for the elements `<Card>` cannot be.
 *
 * `Card` renders a small closed set of block tags. A card that is also a
 * `<Link>`, a `<form>`, a `<figure>` or a `<fieldset>` cannot go through it —
 * and those are exactly the places that would otherwise re-copy the class list
 * and drift. Same two lookup tables, so a change to the card's padding still
 * lands everywhere.
 */
export function cardClass({
  tone = "card",
  pad = "default",
  interactive = false,
}: {
  tone?: keyof typeof TONES;
  pad?: keyof typeof PADS;
  interactive?: boolean;
} = {}): string {
  return [
    "rounded-panel",
    TONES[tone],
    PADS[pad],
    interactive ? "hover:border-brand-300 hover:shadow-lift transition-all" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

interface CardProps {
  /** `section` by default. `article` for a self-contained item, `li` inside a list. */
  as?: "section" | "article" | "div" | "li" | "aside";
  tone?: keyof typeof TONES;
  pad?: keyof typeof PADS;
  /** Lifts and warms its border on hover. Only for a card that is itself a link. */
  interactive?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
}

export function Card({
  as = "section",
  tone = "card",
  pad = "default",
  interactive = false,
  className,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  children,
}: CardProps) {
  const Tag = as;
  const classes = [cardClass({ tone, pad, interactive }), className].filter(Boolean).join(" ");

  return (
    <Tag className={classes} id={id} aria-label={ariaLabel} aria-labelledby={ariaLabelledBy}>
      {children}
    </Tag>
  );
}

/**
 * A figure and what it counts.
 *
 * The number goes first in the DOM inside a `<dl>` — `<dd>` before `<dt>` — and
 * that is deliberate rather than sloppy: the visual order is value-then-label,
 * a definition list is the correct structure for it, and HTML permits the pair
 * in either order inside the list. Reading it aloud gives "48, questions",
 * which is how the figure is meant to be read.
 *
 * `tabular-nums` on every one of them, without exception. A column of figures
 * whose digits do not line up is the most obvious tell that a dashboard was
 * assembled rather than designed.
 */
export function Figure({
  label,
  value,
  size = "default",
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  size?: "default" | "large";
  tone?: "default" | "brand";
  className?: string;
}) {
  return (
    <div className={["min-w-0", className].filter(Boolean).join(" ")}>
      <dd
        className={[
          "truncate tabular-nums",
          size === "large" ? "text-figure-lg" : "text-figure",
          tone === "brand" ? "text-brand-700" : "text-text",
        ].join(" ")}
      >
        {value}
      </dd>
      <dt className="text-text-soft mt-1 text-xs font-medium sm:text-sm">{label}</dt>
    </div>
  );
}

/**
 * A progress bar.
 *
 * Seven of these were written by hand, in three heights and with three
 * different ways of describing themselves to a screen reader — one of them
 * `role="progressbar"` with no `aria-valuenow`, which announces nothing.
 *
 * The default here is presentational: `aria-hidden`, because a bar is almost
 * always drawn beside the sentence that already states the number, and a screen
 * reader reading both says the same fact twice. Passing a `label` opts into the
 * real `progressbar` role, for the cases where the bar *is* the statement.
 */
export function Meter({
  percent,
  label,
  tone = "brand",
  size = "default",
  className,
}: {
  percent: number;
  /** Set only when the bar is the sole statement of the value. */
  label?: string;
  tone?: "brand" | "correct" | "wrong" | "desk";
  size?: "default" | "slim";
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));

  const fill = {
    brand: "bg-brand-500",
    correct: "bg-tick-500",
    wrong: "bg-marker-500",
    desk: "bg-brand-400",
  }[tone];

  const classes = [
    "w-full overflow-hidden rounded-full",
    size === "slim" ? "h-1.5" : "h-2",
    tone === "desk" ? "bg-on-desk/15" : "bg-raised",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const bar = (
    <div
      className={["h-full rounded-full transition-[width] duration-300", fill].join(" ")}
      style={{ width: `${String(clamped)}%` }}
    />
  );

  if (label === undefined) {
    return (
      <div className={classes} aria-hidden="true">
        {bar}
      </div>
    );
  }

  return (
    <div
      className={classes}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
    >
      {bar}
    </div>
  );
}

/**
 * A small status chip.
 *
 * The tones map onto the product's marking vocabulary rather than onto a
 * generic success/warning/danger set, because that vocabulary is already
 * established and already accessible: crimson is wrong, green is right, gold is
 * the half mark, saffron is the app asking for something. A chip that borrows
 * one of those colours for an unrelated meaning is a chip that weakens it.
 */
export function Chip({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "brand" | "outline" | "correct" | "wrong" | "partial";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-raised text-text-soft",
    brand: "bg-brand-50 text-brand-700",
    outline: "border-line bg-card text-text-soft border",
    correct: "bg-tick-50 text-tick-700",
    wrong: "bg-marker-50 text-marker-700",
    partial: "bg-half-50 text-half-700",
  } as const;

  return (
    <span
      className={[
        "rounded-pill inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

/**
 * The one decorative mark a panel may carry.
 *
 * ## What it replaces, and why
 *
 * Three panels drew their own: a 30px-thick arc on the dashboard hero, and an
 * 18px one on the practice and result cards. At the sizes those panels actually
 * render, a band that thick does not read as a curve — it lands *across the
 * content* as a solid slab clipped square by the card's edge, which looks like
 * a rendering fault rather than a graphic. On the dashboard it cut straight
 * through the "Set status" card; on the practice hub it sat behind the Resume
 * button.
 *
 * The product already had the right answer for this, in `.auth-aside-orbit`:
 * concentric hairlines, very low contrast, anchored in a corner. A hairline
 * cannot slab, so it stays decoration wherever the panel's height lands and
 * whatever ends up in front of it. This is that, made reusable.
 *
 * Anchored bottom-right and mostly outside the panel, so only the outer arc
 * grazes the corner — the busiest part of every one of these panels is the top
 * left, where the eyebrow and headline start.
 */
export function PanelOrbit({ tone = "brand" }: { tone?: "brand" | "desk" }) {
  // The rings themselves are drawn in globals.css beside `.auth-aside-orbit`,
  // which is the same object: concentric `box-shadow` rings need real CSS, and
  // an arbitrary-value shadow with an opacity modifier is not something to rely
  // on Tailwind to parse.
  return <div aria-hidden="true" className={`panel-orbit panel-orbit--${tone}`} />;
}

/**
 * One filter you can switch on and off.
 *
 * There were four of these across the product and they disagreed twice over. On
 * the set builder alone, the year, type and difficulty chips were `rounded-pill`
 * while the question-count chips directly below them were `rounded-control` with
 * a heavier weight — the same control, drawn two ways, a hand's width apart.
 *
 * The pill is the right one: this design gives a pill to anything that is a
 * *tag* rather than a field, and a row of them reads as a set of choices rather
 * than as four buttons. `aria-pressed` rather than a checkbox, because these are
 * toggles that act immediately rather than form values that are submitted.
 */
export function Toggle({
  selected,
  onClick,
  disabled = false,
  className,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={[
        "rounded-pill min-h-11 border px-3.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        selected
          ? "border-brand-500 bg-brand-50 text-brand-700"
          : "border-line-strong text-text-soft enabled:hover:border-brand-300",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * The square icon tile that opens a row or a card.
 *
 * It was drawn with `rounded-xl` in five places — a Tailwind default radius
 * that is not one of this design's three, and the only place in the product
 * where a fourth corner size appeared. `rounded-control` is the size a control
 * takes, which is what this is.
 */
export function IconTile({
  tone = "neutral",
  size = "default",
  className,
  children,
}: {
  tone?: "neutral" | "brand" | "desk";
  size?: "default" | "large";
  className?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-raised text-text-soft",
    brand: "bg-brand-50 text-brand-700",
    desk: "bg-on-desk/10 text-brand-300",
  } as const;

  return (
    <span
      className={[
        "rounded-control grid shrink-0 place-items-center",
        size === "large" ? "size-11" : "size-10",
        tones[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
