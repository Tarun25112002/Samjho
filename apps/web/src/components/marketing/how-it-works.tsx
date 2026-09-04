"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

/**
 * How the loop works, drawn as a marked script.
 *
 * ## The one scroll effect on the page
 *
 * A saffron rule draws itself down the left margin as you scroll, and each step
 * lights up as the rule reaches it. It is the margin of a script being marked,
 * which is what the section is describing — the effect and the content are the
 * same idea, rather than a reveal animation applied to whatever happened to be
 * there.
 *
 * That is also why there is exactly one of them. Scattering the same
 * fade-and-rise across every section is the tell of a page assembled rather than
 * designed; spending the whole motion budget on the one place it means something
 * is the alternative.
 *
 * ## Numbered, because it genuinely is a sequence
 *
 * Numbered markers are the most over-used device in this kind of layout and are
 * usually pasted onto three unordered features. These three are ordered: you
 * cannot find out why you were wrong before you have answered, and the third
 * step only exists because of the second.
 */

const STEPS = [
  {
    title: "Pick what to practise",
    body: "A chapter, a topic, or ten questions you have not seen before. Two taps from opening the app to answering something — everything else on the practice screen exists to be ignored.",
  },
  {
    title: "Answer, then find out",
    body: "Objective questions are marked the moment you commit. Written answers come back with the CBSE marking scheme beside them, step by step, and you award yourself the marks — which is the skill the exam is actually testing.",
  },
  {
    title: "Meet it again",
    body: "Every question you got wrong is kept, along with what went wrong. One tap builds a set out of exactly those, and a question leaves the pile only once you have got it right.",
  },
];

export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // The finished state is a drawn rule and three live steps. Without
        // motion that is simply how the section renders.
        gsap.set("[data-rule]", { scaleY: 1 });
        for (const step of gsap.utils.toArray<HTMLElement>("[data-step]")) {
          step.dataset["reached"] = "true";
        }
        return;
      }

      gsap.registerPlugin(ScrollTrigger);

      gsap.fromTo(
        "[data-rule]",
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: "[data-steps]",
            // The rule tracks the reader rather than playing on entry, which is
            // what makes it feel like a pen moving down the page.
            start: "top 70%",
            end: "bottom 75%",
            scrub: 0.4,
          },
        },
      );

      for (const step of gsap.utils.toArray<HTMLElement>("[data-step]")) {
        ScrollTrigger.create({
          trigger: step,
          start: "top 72%",
          once: true,
          onEnter: () => {
            step.dataset["reached"] = "true";
          },
        });
      }
    }, root);

    return () => {
      context.revert();
    };
  }, []);

  return (
    <section ref={root} id="how" className="scroll-mt-24 py-20 lg:py-28">
      <div className="mx-auto max-w-4xl px-5 sm:px-8">
        <h2 className="max-w-2xl text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-5xl">
          Three steps, and the third one is the point
        </h2>
        <p className="text-text-soft mt-5 max-w-[52ch] text-base leading-relaxed sm:text-lg">
          Most apps stop after marking your answer. A mark tells you that something went wrong. It
          does not tell you what.
        </p>

        <ol data-steps className="relative mt-14 flex flex-col gap-14 pl-14 sm:pl-20">
          {/* The margin rule. Two elements: a permanent faint track so the layout
              never depends on JavaScript, and the saffron line that draws over
              it. */}
          <span
            aria-hidden="true"
            className="bg-line absolute top-2 bottom-2 left-[1.375rem] w-px sm:left-[2.125rem]"
          />
          <span
            data-rule
            aria-hidden="true"
            className="bg-brand-500 absolute top-2 bottom-2 left-[1.375rem] w-[2px] origin-top sm:left-[2.125rem]"
          />

          {STEPS.map((step, index) => (
            <li key={step.title} data-step className="group relative">
              <span
                aria-hidden="true"
                className="border-line bg-page text-text-faint absolute top-0 -left-14 grid size-11 place-items-center rounded-full border text-base font-semibold transition-colors duration-300 group-data-[reached]:border-transparent group-data-[reached]:bg-brand-500 group-data-[reached]:text-on-brand sm:-left-20 sm:size-[3.25rem]"
              >
                {index + 1}
              </span>

              <h3 className="text-text text-xl font-semibold tracking-[-0.02em] sm:text-2xl">
                {step.title}
              </h3>
              <p className="text-text-soft mt-3 max-w-[56ch] leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
