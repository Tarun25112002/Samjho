"use client";

import gsap from "gsap";
import { useRef } from "react";

import { TryQuestion } from "@/components/marketing/try-question";
import { ButtonLink } from "@/components/ui/button";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * The opening.
 *
 * It leads with the work rather than with a promise about the work: a real
 * Class 10 question a visitor can answer before they have given us anything.
 * Everything around it is either the argument in one sentence or a way in.
 *
 * ## The one flourish
 *
 * A saffron sweep is drawn under the last line of the headline, once, as the
 * page settles. It is the only non-user-triggered motion on the screen after
 * the lines rise, and it earns its place because it is literally the thing this
 * product does — somebody marking something. The third line used to be coloured
 * saffron instead; a word in a different colour is a decoration, and a pen
 * stroke is a statement.
 */
export function Hero() {
  const root = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      gsap
        .timeline({ defaults: { ease: "power3.out" } })
        .from("[data-hero='tag']", { opacity: 0, y: 10, duration: 0.4 })
        .from("[data-hero='line']", { yPercent: 118, duration: 0.8, stagger: 0.08 }, "-=0.18")
        .from("[data-hero='copy']", { opacity: 0, y: 14, duration: 0.5 }, "-=0.4")
        .from("[data-hero='action']", { opacity: 0, y: 12, duration: 0.46 }, "-=0.3")
        .from("[data-hero='paper']", { opacity: 0, y: 28, duration: 0.75 }, "-=0.5");
    }, root);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <section ref={root} className="hero-sheet paper-grain relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-6xl px-5 pt-14 pb-12 sm:px-8 lg:pt-24 lg:pb-16">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-14">
          <div className="lg:col-span-7">
            <p
              data-hero="tag"
              className="border-line bg-card/80 text-text-soft rounded-pill inline-flex items-center gap-2.5 border px-3.5 py-1.5 text-sm font-medium backdrop-blur-sm"
            >
              <span className="bg-brand-500 size-2 rounded-full" aria-hidden="true" />
              CBSE Class 10
              <span className="bg-line-strong h-3.5 w-px" aria-hidden="true" />
              Maths and Science
            </p>

            {/* Three lines, and each one is a line. `inline-block` rather than
                `block` so a span is exactly as wide as its own words, which is
                what lets the sweep below measure itself against "Understand
                why." instead of against the column. */}
            <h1 className="text-hero mt-7 max-w-[13ch]">
              <span className="line-mask">
                <span data-hero="line" className="inline-block">
                  Practise.
                </span>
              </span>
              <span className="line-mask">
                <span data-hero="line" className="inline-block">
                  Get it wrong.
                </span>
              </span>
              <span className="line-mask">
                <span data-hero="line" className="inline-block">
                  Understand{" "}
                  <span className="relative inline-block">
                    why.
                    <PenSweep />
                  </span>
                </span>
              </span>
            </h1>

            <p
              data-hero="copy"
              className="text-text-soft mt-8 max-w-[46ch] text-base leading-relaxed sm:text-lg"
            >
              Work through board-style questions with the marking scheme beside you. Know where a
              mark went, what the mistake was, and what to revisit next.
            </p>

            <div data-hero="action" className="mt-9 flex flex-wrap items-center gap-3">
              <ButtonLink href="/sign-up" size="lg">
                Start practising free
              </ButtonLink>
              <ButtonLink href="/sign-in" size="lg" variant="secondary">
                I already have an account
              </ButtonLink>
            </div>

            <p data-hero="action" className="text-text-faint mt-6 text-sm">
              Free while the pilot runs. No card, no ads, no tracking.
            </p>
          </div>

          <div data-hero="paper" className="lg:col-span-5">
            <LivePaper />
          </div>
        </div>
      </div>

      <SubjectTicker />
    </section>
  );
}

/**
 * The sweep under the headline.
 *
 * `pathLength="1"` normalises the arc, so the dash values in `.stroke-draw` draw
 * this path and every other pen mark on the page without anyone measuring one.
 * The curve overshoots its own end and lifts: a ruled line reads as an
 * underline, and this has to read as a hand.
 *
 * It is anchored to "why." rather than to the whole line, and that is a
 * robustness decision before it is an editorial one. The line holds on one row
 * on a laptop and breaks after "Understand" on a phone; a sweep measured against
 * the line would then be drawn under "why." at the width of "Understand", which
 * is the one way this gesture can look like a bug. Anchored to the word, it is
 * the same mark at every width — and "why" is the word the sentence turns on.
 */
function PenSweep() {
  return (
    <svg
      viewBox="0 0 320 22"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
      className="absolute -bottom-1 left-0 h-[0.42em] w-full text-brand-500"
    >
      <path
        d="M4 14 C 62 4, 138 4, 214 9 C 252 11.5, 288 15, 316 9"
        pathLength="1"
        className="stroke-draw"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.5"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/**
 * The live question, on a sheet that tips towards the pointer.
 *
 * The tilt is the only decoration here and it is entirely reactive: no cursor,
 * no movement. Two custom properties on `pointermove`, so the browser animates
 * a transform and nothing else, and the rotation stays under two degrees at the
 * corners because the card contains something a visitor is meant to *read*.
 */
function LivePaper() {
  const frame = useRef<HTMLDivElement>(null);

  function tip(event: React.PointerEvent<HTMLDivElement>) {
    const node = frame.current;
    if (node === null || event.pointerType !== "mouse") return;

    const box = node.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;

    node.style.setProperty("--tilt-y", `${String((x * 3).toFixed(2))}deg`);
    node.style.setProperty("--tilt-x", `${String((-y * 2.4).toFixed(2))}deg`);
  }

  function settle() {
    frame.current?.style.removeProperty("--tilt-x");
    frame.current?.style.removeProperty("--tilt-y");
  }

  return (
    <div className="relative" onPointerMove={tip} onPointerLeave={settle}>
      {/* The saffron plate the sheet rests on. Rotated a degree and a half, the
          way a page that was actually put down on a desk would be. */}
      <div
        aria-hidden="true"
        className="border-brand-200 bg-brand-100/70 absolute -inset-3 rotate-[-1.4deg] rounded-[1.75rem] border sm:-inset-4"
      />

      <div ref={frame} className="tilt relative">
        <div className="mb-3 flex items-end justify-between gap-4 px-1">
          <p className="text-text text-sm font-semibold">Answer one now</p>
          <p className="text-brand-700 text-xs font-semibold">Nothing to sign up for</p>
        </div>
        <TryQuestion />
      </div>
    </div>
  );
}

/**
 * What the paper actually covers, moving past.
 *
 * Every chapter here is a real Class 10 NCERT chapter, and stating the syllabus
 * as a list you can read your own weak spot out of does more than the sentence
 * "comprehensive coverage" ever could. The track is duplicated and shifted by
 * half its width so the loop has no seam; `aria-hidden` on the second copy keeps
 * a screen reader from reading the syllabus twice.
 */
const CHAPTERS = [
  "Real Numbers",
  "Light — Reflection and Refraction",
  "Quadratic Equations",
  "Chemical Reactions and Equations",
  "Triangles",
  "Life Processes",
  "Arithmetic Progressions",
  "Electricity",
  "Coordinate Geometry",
  "Carbon and its Compounds",
  "Trigonometry",
  "Heredity",
  "Circles",
  "Magnetic Effects of Current",
  "Surface Areas and Volumes",
  "Acids, Bases and Salts",
  "Statistics",
  "Human Eye and the Colourful World",
  "Probability",
  "Metals and Non-metals",
] as const;

function SubjectTicker() {
  return (
    <div className="border-line relative z-10 border-t py-5">
      <div className="ticker-window overflow-hidden">
        <div className="ticker">
          <ChapterTrack />
          <ChapterTrack aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

function ChapterTrack(props: { "aria-hidden"?: "true" }) {
  return (
    <ul className="flex shrink-0 items-center gap-8 pr-8" {...props}>
      {CHAPTERS.map((chapter) => (
        <li key={chapter} className="flex shrink-0 items-center gap-8">
          <span className="text-text-soft text-sm font-medium whitespace-nowrap">{chapter}</span>
          <span className="bg-brand-300 size-1 shrink-0 rounded-full" aria-hidden="true" />
        </li>
      ))}
    </ul>
  );
}
