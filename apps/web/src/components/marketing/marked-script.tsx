"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef, useState } from "react";

import { Check, Cross } from "@/components/icons";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * The showpiece: an answer being marked.
 *
 * ## Why this section exists at all
 *
 * Every practice product on the internet says it explains your mistakes. The
 * sentence is free, so it is worthless. This section does not make the claim —
 * it marks a real three-mark proof in front of the reader, one step at a time,
 * and lets them watch two marks land and one fail to. By the time they reach
 * the bottom they have seen the product's entire argument rather than read it.
 *
 * It is also the page's one piece of ambition, and everything around it was
 * deliberately quietened so that this is the thing someone remembers.
 *
 * ## The answer is real
 *
 * The proof, the working and the missing step are all genuine. A student who
 * writes exactly this script in a board exam loses exactly this mark: the
 * contradiction is never stated, so the proof never closes. Inventing a
 * plausible-looking wrong answer would have been easier and would have been the
 * one thing this section cannot afford to get wrong.
 *
 * ## Mechanically
 *
 * A sticky rail beside a tall column of steps, rather than a pinned and scrubbed
 * timeline. Pinning rewrites the document's layout while you scroll, which on a
 * phone fights the address bar and on a short laptop cuts the last step off.
 * Sticky costs nothing, degrades to plain stacked blocks the moment the grid
 * collapses, and a reader who scrolls back up sees the marks come off again —
 * which the scrubbed version could only fake.
 */

interface Step {
  id: string;
  /** What the student wrote, as they wrote it. */
  hand: string;
  marks: 0 | 1;
  /** The examiner's margin note. Short enough to be read at a glance. */
  note: string;
}

const STEPS: Step[] = [
  {
    id: "assume",
    hand: "Let √5 = p/q, where p and q are coprime, q ≠ 0",
    marks: 1,
    note: "Correct assumption, and the coprime condition is stated. This is where the mark is.",
  },
  {
    id: "divides",
    hand: "5q² = p²  ⟹  5 | p²  ⟹  5 | p,  so p = 5m",
    marks: 1,
    note: "The step from 5 | p² to 5 | p is the one examiners look for. You have it.",
  },
  {
    id: "close",
    hand: "⟹ 5q² = 25m²  ⟹  q² = 5m².  Hence √5 is irrational.",
    marks: 0,
    note: "You stopped one line early. q² = 5m² gives 5 | q — and p and q were taken coprime. The contradiction is the mark.",
  },
];

const TOTAL = STEPS.length;

export function MarkedScript() {
  const root = useRef<HTMLElement>(null);
  const [reached, setReached] = useState(0);

  useIsomorphicLayoutEffect(() => {
    const context = gsap.context(() => {
      const steps = gsap.utils.toArray<HTMLElement>("[data-script-step]");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        for (const step of steps) step.dataset["marked"] = "true";
        setReached(TOTAL);
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          start: "top 68%",
          end: "bottom 30%",
          onEnter: () => {
            step.dataset["marked"] = "true";
            setReached((current) => Math.max(current, index + 1));
          },
          // Scrolling back up takes the marks off again. A reader who reverses
          // and watches the same tick get drawn twice has been told the mark is
          // a piece of animation; a reader who watches it come off has been told
          // it is a piece of state.
          onLeaveBack: () => {
            delete step.dataset["marked"];
            setReached(index);
          },
        });
      });
    }, root);

    return () => {
      context.revert();
    };
  }, []);

  const awarded = STEPS.slice(0, reached).reduce((sum, step) => sum + step.marks, 0);

  return (
    <section
      ref={root}
      id="marking"
      className="bg-desk text-on-desk scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-4 lg:sticky lg:top-28 lg:self-start">
          <h2 className="text-display max-w-[11ch]">Watch a mark land.</h2>
          <p className="text-on-desk-soft mt-6 max-w-[38ch] leading-relaxed">
            One student, one three-mark proof, marked the way a board examiner marks it. Scroll, and
            the pen moves.
          </p>

          <Tally awarded={awarded} reached={reached} />
        </div>

        <div className="lg:col-span-8">
          <div className="script-sheet rounded-panel overflow-hidden shadow-pop">
            <header className="border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-white/80 px-5 py-4 backdrop-blur-sm sm:px-6">
              <span className="text-text text-sm font-semibold">Section D · Question 20</span>
              <span className="text-text-faint text-sm">Written answer</span>
              <span className="marks-margin text-text-soft ml-auto text-sm font-medium">
                3 marks
              </span>
            </header>

            <p className="text-text border-line border-b px-5 py-6 pl-16 font-serif text-xl leading-[1.5] sm:px-7 sm:pl-20 sm:text-2xl">
              Prove that <span className="whitespace-nowrap">√5</span> is irrational.
            </p>

            <ol className="flex flex-col">
              {STEPS.map((step) => (
                <ScriptStep key={step.id} step={step} />
              ))}
            </ol>
          </div>

          <Verdict awarded={awarded} complete={reached === TOTAL} />
        </div>
      </div>
    </section>
  );
}

/**
 * The running total, in the margin where marks belong.
 *
 * The denominator is set from the start and the numerator climbs, because that
 * is the shape of the anxiety this product exists to answer: you always know
 * what the question is worth, and never what you got.
 */
function Tally({ awarded, reached }: { awarded: number; reached: number }) {
  return (
    <div className="border-desk-line mt-10 border-t pt-7">
      <p className="text-on-desk-faint text-sm font-medium">Marks awarded so far</p>
      <p className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-on-brand bg-brand-500 rounded-control inline-block min-w-[2.4ch] px-3 py-1 text-center text-figure-lg transition-colors duration-300">
          {awarded}
        </span>
        <span className="text-on-desk-faint text-figure">/</span>
        <span className="text-on-desk-soft text-figure">3</span>
      </p>
      <p className="text-on-desk-soft mt-5 h-12 max-w-[34ch] text-sm leading-relaxed">
        {reached === 0
          ? "Nothing marked yet."
          : reached < TOTAL
            ? `Step ${String(reached)} of ${String(TOTAL)} marked.`
            : "Marked. One mark short, and the reason is written in the margin."}
      </p>
    </div>
  );
}

/**
 * One step of the answer, and the pen mark it earns.
 *
 * The handwriting is a real typeface choice rather than a gimmick: this is a
 * script, and a script set in the same serif as the printed question would be
 * the examiner's page, not the student's.
 */
function ScriptStep({ step }: { step: Step }) {
  const right = step.marks === 1;

  return (
    <li
      data-script-step
      /* The left padding clears the sheet's margin rule. A tick drawn across
         that red line is the one thing on the page a student would never see on
         a real script — the margin belongs to the question number. */
      className="script-step border-line relative grid gap-4 border-b py-7 pr-5 pl-14 last:border-0 sm:pr-7 sm:pl-16 lg:grid-cols-[1fr_14rem] lg:gap-8"
    >
      <div className="flex gap-4 sm:gap-5">
        <PenMark right={right} />
        <p className="text-sand-800 max-w-[34ch] font-hand text-2xl leading-[1.45] sm:text-[1.75rem]">
          {step.hand}
        </p>
      </div>

      <div className="script-note lg:pl-6">
        <p
          className={[
            "flex items-center gap-2 text-sm font-semibold",
            right ? "text-tick-700" : "text-marker-700",
          ].join(" ")}
        >
          <span
            className={[
              "grid size-6 shrink-0 place-items-center rounded-full text-white",
              right ? "bg-tick-600" : "bg-marker-600",
            ].join(" ")}
          >
            {right ? <Check className="size-3.5" /> : <Cross className="size-3.5" />}
          </span>
          {right ? "1 mark" : "0 marks"}
        </p>
        <p className="text-text-soft mt-2.5 text-sm leading-relaxed">{step.note}</p>
      </div>
    </li>
  );
}

/**
 * The examiner's pen, in the left margin of the sheet.
 *
 * A tick for a mark earned and a cross for one that was not, both drawn as
 * strokes rather than set as glyphs — a glyph appears, and a stroke is *made*.
 * `pathLength="1"` lets both share one pair of dash values with the headline's
 * sweep.
 */
function PenMark({ right }: { right: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={[
        "mt-0.5 size-9 shrink-0 sm:size-10",
        right ? "text-tick-600" : "text-marker-600",
      ].join(" ")}
    >
      {right ? (
        <path
          data-pen
          d="M5 17.5 L12.5 25 L27.5 6"
          pathLength="1"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <>
          <path
            data-pen
            d="M7 7 L25 25"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
          <path
            data-pen
            d="M25 7 L7 25"
            pathLength="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.6"
            strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

/**
 * What the marking was for.
 *
 * The section would be a clever animation without this: the point is not that a
 * mark was lost, it is that the product now knows *which* mark and *why*, and
 * that the question is coming back. It holds its height from the start so the
 * page does not jump underneath a reader when the last step is marked.
 */
function Verdict({ awarded, complete }: { awarded: number; complete: boolean }) {
  return (
    <div
      className={[
        "border-desk-line mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-panel border px-5 py-5 transition-colors duration-500 sm:px-7",
        complete ? "bg-desk-raised" : "bg-transparent",
      ].join(" ")}
    >
      <p className="text-on-desk text-base font-semibold">
        {complete ? `${String(awarded)} of 3 — and the third has a reason.` : "Keep scrolling."}
      </p>
      <p className="text-on-desk-soft max-w-[46ch] text-sm leading-relaxed">
        {complete
          ? "A proof that stops before the contradiction comes back as a proof that stops before the contradiction — not as a random question from the same chapter."
          : "The pen is still working."}
      </p>
    </div>
  );
}
