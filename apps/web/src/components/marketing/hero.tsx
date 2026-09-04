"use client";

import gsap from "gsap";
import Image from "next/image";
import { useRef } from "react";

import { TryQuestion } from "@/components/marketing/try-question";
import { ButtonLink } from "@/components/ui/button";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * The first screen deliberately leads with the work, not a promise about the
 * work. A student can answer a real question before deciding to create an
 * account; the surrounding facts are about the paper they are preparing for,
 * not invented product metrics.
 */
const PAPER_FACTS = [
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
        .from("[data-hero='eyebrow']", { opacity: 0, y: 10, duration: 0.42 })
        .from("[data-hero='line']", { yPercent: 115, duration: 0.76, stagger: 0.075 }, "-=0.2")
        .from("[data-hero='copy']", { opacity: 0, y: 14, duration: 0.5 }, "-=0.42")
        .from("[data-hero='action']", { opacity: 0, y: 12, duration: 0.46 }, "-=0.28")
        .from("[data-hero='preview']", { opacity: 0, y: 24, duration: 0.7 }, "-=0.42")
        .from("[data-hero='fact']", { opacity: 0, y: 10, duration: 0.4, stagger: 0.055 }, "-=0.38");

      for (const node of gsap.utils.toArray<HTMLElement>("[data-count]")) {
        const target = Number(node.dataset["count"]);
        const counter = { value: 0 };

        timeline.to(
          counter,
          {
            value: target,
            duration: 0.85,
            ease: "power2.out",
            onUpdate: () => {
              node.textContent = String(Math.round(counter.value));
            },
          },
          "-=0.65",
        );
      }
    }, root);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <section ref={root} className="hero-paper relative overflow-hidden">
      <div className="relative mx-auto max-w-6xl px-5 pt-12 pb-10 sm:px-8 lg:pt-20 lg:pb-12">
        <div className="grid items-center gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-7">
            <p
              data-hero="eyebrow"
              className="border-line bg-card text-text-soft rounded-pill inline-flex items-center gap-2 border px-3.5 py-1.5 text-sm font-medium shadow-[0_8px_20px_-18px_oklch(0.3_0.03_60_/_0.55)]"
            >
              <span className="bg-brand-500 size-2 rounded-full" aria-hidden="true" />
              CBSE Class 10 · Maths and Science
            </p>

            <h1 className="mt-7 max-w-[10ch] text-[2.9rem] leading-[1.01] font-semibold tracking-[-0.052em] sm:text-6xl lg:text-7xl">
              <span className="line-mask">
                <span data-hero="line" className="block">
                  Practise.
                </span>
              </span>
              <span className="line-mask">
                <span data-hero="line" className="block">
                  Get it wrong.
                </span>
              </span>
              <span className="line-mask">
                <span data-hero="line" className="text-brand-600 block">
                  Understand why.
                </span>
              </span>
            </h1>

            <p
              data-hero="copy"
              className="text-text-soft mt-6 max-w-[46ch] text-base leading-relaxed sm:text-lg"
            >
              Work through board-style questions with the marking scheme beside you. Know where a
              mark went, what the mistake was, and what to revisit next.
            </p>

            <div data-hero="action" className="mt-8 flex flex-wrap items-center gap-3">
              <ButtonLink href="/sign-up" size="lg">
                Start practising free
              </ButtonLink>
              <ButtonLink href="/sign-in" size="lg" variant="secondary">
                I already have an account
              </ButtonLink>
            </div>

            <p data-hero="action" className="text-text-faint mt-5 text-sm">
              Free pilot · No card · Built around the CBSE paper
            </p>
          </div>

          <div data-hero="preview" className="relative lg:col-span-5">
            <Image
              src="/illustrations/study-at-desk.svg"
              alt=""
              width={849}
              height={842}
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-16 z-0 hidden w-56 opacity-30 lg:block"
            />
            <div
              aria-hidden="true"
              className="border-brand-200 bg-brand-50 absolute z-0 -top-3 -right-3 -bottom-3 -left-3 rounded-[1.75rem] border sm:-top-4 sm:-right-4 sm:-bottom-4 sm:-left-4"
            />
            <div className="relative z-10">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-text text-sm font-semibold">A question you can answer now</p>
                <span className="text-brand-700 text-xs font-semibold tracking-[0.08em] uppercase">
                  Live preview
                </span>
              </div>
              <TryQuestion />
            </div>
          </div>
        </div>

        <dl className="border-line mt-14 grid grid-cols-2 border-y sm:grid-cols-4 lg:mt-20">
          {PAPER_FACTS.map((fact, index) => (
            <div
              key={fact.label}
              data-hero="fact"
              className={[
                "py-5 lg:py-6",
                index % 2 === 0 ? "pr-5 sm:px-5" : "border-line border-l pl-5 sm:px-5",
                index > 1 ? "border-line border-t sm:border-t-0" : "",
                index > 0 ? "sm:border-line sm:border-l" : "",
              ].join(" ")}
            >
              <dd className="text-text text-3xl leading-none font-semibold tracking-[-0.04em] tabular-nums sm:text-[2.5rem]">
                <span data-count={fact.value}>{fact.value}</span>
                {fact.suffix}
              </dd>
              <dt className="text-text-soft mt-2 max-w-[15ch] text-sm leading-snug">
                {fact.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
