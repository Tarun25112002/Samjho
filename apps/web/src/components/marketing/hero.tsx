"use client";

import gsap from "gsap";
import { useRef } from "react";

import { TryQuestion } from "@/components/marketing/try-question";
import { ButtonLink } from "@/components/ui/button";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * The hero.
 *
 * ## One orchestrated moment, and then nothing
 *
 * docs/01 §9 asks for minimal, fast motion. So the page has a single opening
 * sequence — the headline rises a line at a time, the question card settles, the
 * four figures count up — and after that nothing moves unless the reader moves
 * it. A fade-and-rise on every card down the page is the thing that makes a site
 * feel machine-made, and it is the effect this deliberately does not have.
 *
 * The whole timeline is skipped under `prefers-reduced-motion`, where the final
 * state is simply the state.
 *
 * ## The figures are the paper, not the company
 *
 * Every landing page in this category opens with student counts. Samjho is in a
 * closed pilot and does not have any, and inventing them is not on the table. So
 * the numbers here describe the thing the reader is afraid of instead: 80 marks,
 * five sections, three hours. They are taken from the CBSE Class 10 blueprint in
 * `packages/exam-blueprints` — the same file the exam engine builds papers from,
 * so marketing and the product cannot disagree about what the exam is.
 */

const FIGURES = [
  { value: 80, suffix: "", label: "marks in the theory paper" },
  { value: 5, suffix: "", label: "sections, A through E" },
  { value: 3, suffix: "h", label: "on the day, start to finish" },
  { value: 10, suffix: "", label: "question types, all of them" },
] as const;

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const timeline = gsap.timeline({ defaults: { ease: "power3.out" } });

      timeline
        .from("[data-anim='pill']", { opacity: 0, y: 10, duration: 0.45 })
        // The lines are revealed from behind their own baseline rather than
        // faded in. `.line-mask` is the overflow box that makes it a
        // typographic gesture instead of the usual opacity ramp.
        .from("[data-anim='line']", { yPercent: 115, duration: 0.8, stagger: 0.075 }, "-=0.2")
        .from("[data-anim='sub']", { opacity: 0, y: 14, duration: 0.55 }, "-=0.45")
        .from("[data-anim='cta']", { opacity: 0, y: 14, duration: 0.5 }, "-=0.35")
        .from("[data-anim='card']", { opacity: 0, y: 26, duration: 0.7 }, "-=0.3")
        .from("[data-anim='figure']", { opacity: 0, y: 12, duration: 0.5, stagger: 0.07 }, "-=0.4");

      // The count-up runs on the same timeline so the numbers land with the
      // card rather than starting their own little show a beat later.
      for (const node of gsap.utils.toArray<HTMLElement>("[data-count]")) {
        const target = Number(node.dataset["count"]);
        const counter = { value: 0 };

        timeline.to(
          counter,
          {
            value: target,
            duration: 0.9,
            ease: "power2.out",
            onUpdate: () => {
              node.textContent = String(Math.round(counter.value));
            },
          },
          "-=0.85",
        );
      }
    }, root);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <section ref={root} className="ruled-lines relative overflow-hidden">
      {/* The ruling fades out before the content ends, so the texture supports
          the headline and then gets out of the way. */}
      <div
        aria-hidden="true"
        className="from-page pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t to-transparent"
      />

      <div className="relative mx-auto flex max-w-6xl flex-col items-center px-5 pt-12 pb-10 text-center sm:px-8 lg:pt-16 lg:pb-14">
        <p
          data-anim="pill"
          className="border-line bg-card text-text-soft rounded-pill inline-flex items-center gap-2 border px-3.5 py-1.5 text-sm font-medium"
        >
          <span className="bg-brand-500 size-2 rounded-full" aria-hidden="true" />
          CBSE Class 10 — Maths and Science
        </p>

        <h1 className="mt-7 max-w-4xl text-[2.5rem] leading-[1.04] font-semibold tracking-[-0.035em] sm:text-6xl lg:text-7xl">
          <span className="line-mask">
            <span data-anim="line" className="block">
              Practise.
            </span>
          </span>
          <span className="line-mask">
            <span data-anim="line" className="block">
              Get it wrong.
            </span>
          </span>
          <span className="line-mask">
            {/* Saffron on the third beat, because the third beat is the product.
                "Samjho" is Hindi for "understand". */}
            <span data-anim="line" className="text-brand-600 block">
              Understand why.
            </span>
          </span>
        </h1>

        <p
          data-anim="sub"
          className="text-text-soft mt-6 max-w-[46ch] text-base leading-relaxed sm:text-lg"
        >
          Every question comes with its marking scheme, so you find out where the marks actually
          went — not just whether you were right.
        </p>

        <div data-anim="cta" className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/sign-up" size="lg">
            Start practising free
          </ButtonLink>
          <ButtonLink href="/sign-in" size="lg" variant="secondary">
            I already have an account
          </ButtonLink>
        </div>

        {/*
          Three columns on a wide screen with the question in the middle, so the
          first thing in the reader's eyeline below the fold is a thing they can
          answer. On a phone the card comes first and the figures follow — the
          order that matters, rather than the arrangement.
        */}
        <div className="mt-14 grid w-full gap-8 lg:mt-16 lg:grid-cols-[1fr_minmax(0,30rem)_1fr] lg:items-center lg:gap-10">
          <dl className="order-2 grid grid-cols-2 gap-6 text-left lg:order-1 lg:grid-cols-1 lg:gap-10">
            {FIGURES.slice(0, 2).map((figure) => (
              <Figure key={figure.label} {...figure} />
            ))}
          </dl>

          <div data-anim="card" className="order-1 lg:order-2">
            <TryQuestion />
          </div>

          <dl className="order-3 grid grid-cols-2 gap-6 text-left lg:grid-cols-1 lg:gap-10 lg:text-right">
            {FIGURES.slice(2).map((figure) => (
              <Figure key={figure.label} {...figure} align="right" />
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}

function Figure({
  value,
  suffix,
  label,
  align = "left",
}: {
  value: number;
  suffix: string;
  label: string;
  align?: "left" | "right";
}) {
  return (
    <div data-anim="figure">
      <dd
        className={[
          "text-text text-[2.75rem] leading-none font-semibold tracking-[-0.04em] tabular-nums",
          align === "right" ? "lg:text-right" : "",
        ].join(" ")}
      >
        {/*
          The server renders the final number, so the page is correct before any
          JavaScript arrives and stays correct if none does. The count-up
          overwrites `textContent` from zero only once GSAP is running.
        */}
        <span data-count={value}>{value}</span>
        {suffix}
      </dd>
      <dt
        className={["text-text-soft mt-1.5 text-sm", align === "right" ? "lg:text-right" : ""].join(
          " ",
        )}
      >
        {label}
      </dt>
    </div>
  );
}
