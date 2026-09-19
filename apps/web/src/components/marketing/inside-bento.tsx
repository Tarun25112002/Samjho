"use client";

import { useRef } from "react";

import { BookmarkIcon, Check, Cross, HalfMark } from "@/components/icons";

/**
 * What is actually in the product.
 *
 * ## Why these are not feature cards
 *
 * Four identical rounded boxes each holding an icon, a title and two lines of
 * body copy is the shape every SaaS page uses, and it tells a reader nothing
 * they could not have guessed. Each tile here shows the *artefact* instead: the
 * provenance line a previous-year question carries, the actual rows of a
 * revision queue, the chips a question is tagged with. The title is then a
 * caption on something real rather than a claim about something unseen.
 *
 * The grid is deliberately uneven. Coverage is the biggest argument, so it gets
 * the biggest tile; the gold notice about full papers is the smallest, because
 * it is the one thing on this page that is not built yet and it is not going to
 * be dressed up as though it were.
 *
 * ## The light
 *
 * One saffron glow follows the pointer across the whole grid and lights each
 * tile's border as it passes. It is a single shared light source rather than a
 * hover state on each card, which is what keeps five tiles reading as one
 * object. Pointer-driven, so nothing moves on its own, and it is invisible on
 * touch where there is no pointer to follow.
 */
export function InsideBento() {
  const grid = useRef<HTMLDivElement>(null);

  function light(event: React.PointerEvent<HTMLDivElement>) {
    const node = grid.current;
    if (node === null || event.pointerType !== "mouse") return;

    // Each tile needs the pointer in its *own* coordinates, or the gradient
    // lands in the same spot on every tile. Writing one pair of properties per
    // tile on the grid's own element is not possible, so each tile is measured
    // — five rects on a pointermove is cheap, and there is no layout thrash
    // because nothing is written back until they have all been read.
    const tiles = node.querySelectorAll<HTMLElement>("[data-tile]");
    const boxes = [...tiles].map((tile) => tile.getBoundingClientRect());

    tiles.forEach((tile, index) => {
      const box = boxes[index];
      if (box === undefined) return;
      tile.style.setProperty("--mx", `${String(Math.round(event.clientX - box.left))}px`);
      tile.style.setProperty("--my", `${String(Math.round(event.clientY - box.top))}px`);
    });
  }

  return (
    <section id="inside" className="border-line scroll-mt-24 border-y bg-raised py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2 className="text-display max-w-[19ch] lg:col-span-7">
            A question bank does not know what you need next.
          </h2>
          <p className="text-text-soft max-w-[42ch] leading-relaxed lg:col-span-5 lg:pb-1">
            Medhavi treats every answer like a marked script. The question, the working, the marks
            and the revision all live in the same place.
          </p>
        </div>

        <div
          ref={grid}
          onPointerMove={light}
          className="lit-grid mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Tile
            className="sm:col-span-2"
            title="All ten question types"
            body="MCQs, assertion and reason, case studies, numericals, match the following and the rest — shaped like the paper, with proper maths throughout."
          >
            <QuestionTypes />
          </Tile>

          <Tile
            title="Previous-year context"
            body="A question carries the paper it came from, so a familiar one arrives with the context that makes it useful."
          >
            <Provenance />
          </Tile>

          <Tile
            title="Mistake-aware revision"
            body="A slip, a misread and a gap do not deserve the same next question."
          >
            <RevisionQueue />
          </Tile>

          <Tile
            className="sm:col-span-2"
            title="Questions worth keeping"
            body="Save the proofs, numericals and traps you want to meet again. Your own difficult-question notebook, already organised."
          >
            <SavedList />
          </Tile>

          <Tile
            tone="half"
            layout="row"
            className="lg:col-span-3"
            title="Full papers"
            body="Being built, with the real internal choices and section rules. Not ready to promise a date."
          >
            <p className="text-half-700 flex items-center gap-2 text-sm font-semibold whitespace-nowrap">
              <HalfMark className="size-5 shrink-0" />
              In progress
            </p>
          </Tile>
        </div>
      </div>
    </section>
  );
}

/**
 * The tile.
 *
 * The artefact goes above the caption rather than below it, which is the whole
 * point of the section: the reader sees the thing, then reads what it is.
 */
function Tile({
  title,
  body,
  tone = "card",
  layout = "stack",
  className,
  children,
}: {
  title: string;
  body: string;
  tone?: "card" | "half";
  /**
   * `stack` puts the artefact above its caption, which is the point of the
   * section: you see the thing, then read what it is. `row` is for the one
   * tile whose "artefact" is a two-word status, where stacking would leave a
   * tall empty box with a label at the bottom of it.
   */
  layout?: "stack" | "row";
  className?: string;
  children: React.ReactNode;
}) {
  const row = layout === "row";

  return (
    <article
      data-tile
      className={[
        "lit-tile rounded-panel relative border p-5 sm:p-6",
        row ? "flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8" : "flex flex-col gap-5",
        tone === "half" ? "border-half-200 bg-half-50" : "border-line bg-card",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={row ? "relative z-10 sm:order-2" : "relative z-10 flex-1"}>{children}</div>
      <div className={row ? "relative z-10 sm:order-1 sm:flex-1" : "relative z-10"}>
        <h3 className="text-text text-subheading">{title}</h3>
        <p
          className={`text-text-soft mt-2 text-sm leading-relaxed ${row ? "max-w-[68ch]" : "max-w-[44ch]"}`}
        >
          {body}
        </p>
      </div>
    </article>
  );
}

/** The ten types, as the chips a question actually wears. */
const TYPES = [
  "MCQ",
  "Assertion and reason",
  "Case study",
  "Numerical",
  "Match the following",
  "Very short answer",
  "Short answer",
  "Long answer",
  "Fill in the blank",
  "True or false",
] as const;

function QuestionTypes() {
  return (
    <div className="flex flex-col gap-5">
      <ul className="flex flex-wrap gap-2">
        {TYPES.map((type) => (
          <li
            key={type}
            className="border-line bg-raised text-text-soft rounded-pill border px-3 py-1.5 text-sm font-medium"
          >
            {type}
          </li>
        ))}
      </ul>

      {/* One of them, drawn properly, so "assertion and reason" is a question
          shape on the page rather than a phrase in a list. */}
      <figure className="border-line rounded-control m-0 border bg-raised px-4 py-4">
        <figcaption className="text-text-faint mb-3 flex items-center justify-between text-xs font-semibold">
          <span>Assertion and reason</span>
          <span className="marks-margin text-text-soft font-medium">1 mark</span>
        </figcaption>
        <p className="text-text font-serif text-sm leading-relaxed">
          <span className="text-text-soft font-sans font-semibold">A.</span> A concave mirror can
          form a virtual image.
        </p>
        <p className="text-text mt-2 font-serif text-sm leading-relaxed">
          <span className="text-text-soft font-sans font-semibold">R.</span> The image is virtual
          when the object is between the pole and the focus.
        </p>
      </figure>
    </div>
  );
}

/** The stamp a previous-year question carries. */
function Provenance() {
  return (
    <div className="border-line rounded-control border bg-raised px-4 py-4">
      <p className="text-text font-serif text-sm leading-relaxed">
        Find the nature of the roots of 2x² − 6x + 3 = 0.
      </p>
      <dl className="divide-line mt-4 divide-y border-line border-t text-sm">
        <div className="flex items-baseline justify-between py-2">
          <dt className="text-text-faint text-xs">Paper</dt>
          <dd className="text-text font-medium">CBSE 2023, Delhi</dd>
        </div>
        <div className="flex items-baseline justify-between py-2">
          <dt className="text-text-faint text-xs">Question</dt>
          <dd className="text-text font-medium tabular-nums">Set 1, Q14</dd>
        </div>
      </dl>
    </div>
  );
}

/** What a wrong answer turns into. */
const QUEUE = [
  {
    mistake: "Sign slip in the discriminant",
    next: "Three more quadratics, no theory",
    kind: "slip",
  },
  {
    mistake: "Misread 'virtual', answered 'real'",
    next: "The definition, then a mirror numerical",
    kind: "misread",
  },
  { mistake: "Never reached the contradiction", next: "The same proof, next week", kind: "gap" },
] as const;

function RevisionQueue() {
  return (
    <ul className="divide-line divide-y">
      {QUEUE.map((row) => (
        <li key={row.kind} className="py-3 first:pt-0 last:pb-0">
          <p className="text-text-soft flex items-start gap-2 text-sm">
            <Cross className="text-marker-600 mt-0.5 size-3.5 shrink-0" />
            {row.mistake}
          </p>
          <p className="text-text mt-1.5 flex items-start gap-2 text-sm font-medium">
            <Check className="text-tick-600 mt-0.5 size-3.5 shrink-0" />
            {row.next}
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The notebook. */
const SAVED = [
  { title: "Prove that √5 is irrational", where: "Real Numbers · 3 marks" },
  { title: "Mirror formula with a negative focal length", where: "Light · 3 marks" },
  { title: "Balancing a redox equation", where: "Chemical Reactions · 2 marks" },
] as const;

function SavedList() {
  return (
    <ul className="divide-line divide-y">
      {SAVED.map((item) => (
        <li key={item.title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <BookmarkIcon className="text-brand-600 size-4 shrink-0" filled />
          <span className="min-w-0 flex-1">
            <span className="text-text block truncate text-sm font-medium">{item.title}</span>
            <span className="text-text-faint block text-xs">{item.where}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
