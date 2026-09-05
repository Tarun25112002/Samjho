"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

import { Check, Cross } from "@/components/icons";
import { cardClass } from "@/components/ui/surface";
import { useIsomorphicLayoutEffect } from "@/lib/use-isomorphic-layout-effect";

const STEPS = [
  {
    number: "01",
    title: "Choose the work in front of you",
    body: "Start with a chapter, a topic, or the questions you have not met yet. The product opens on the next useful thing, not a catalogue you have to think your way through.",
    detail: "Two taps from opening the app to a question.",
  },
  {
    number: "02",
    title: "Make the mistake visible",
    body: "Objective questions are marked as you commit. Written answers sit beside the CBSE marking scheme, so a lost mark has a reason, not just a red cross.",
    detail: "The mark is the start of the feedback.",
  },
  {
    number: "03",
    title: "Return with a better answer",
    body: "Samjho keeps the question and the kind of mistake together. Your next revision set is built from exactly that evidence, until the question stops being a weak spot.",
    detail: "Wrong once is data. Wrong twice is a pattern.",
  },
] as const;

/** The learning loop is a marked script, not a three-card feature grid. */
export function HowItWorks() {
  const root = useRef<HTMLElement>(null);

  useIsomorphicLayoutEffect(() => {
    const context = gsap.context(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
            start: "top 72%",
            end: "bottom 72%",
            scrub: 0.4,
          },
        },
      );

      for (const step of gsap.utils.toArray<HTMLElement>("[data-step]")) {
        ScrollTrigger.create({
          trigger: step,
          start: "top 74%",
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
    <section ref={root} id="how" className="scroll-mt-24 py-24 lg:py-36">
      <div className="mx-auto grid max-w-6xl gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-5 lg:sticky lg:top-28 lg:self-start">
          <p className="text-brand-700 text-eyebrow uppercase">The revision loop</p>
          <h2 className="text-display mt-4 max-w-[10ch]">A wrong answer is raw material.</h2>
          <p className="text-text-soft mt-6 max-w-[43ch] text-base leading-relaxed sm:text-lg">
            Most practice tools announce a score and move on. Samjho makes the answer, the mark, and
            the next attempt into one quiet loop.
          </p>

          <div className="border-line bg-raised mt-9 max-w-md overflow-hidden rounded-panel border">
            <div className="border-line flex items-center justify-between border-b px-5 py-3.5">
              <p className="text-text text-sm font-semibold">What stays with a question</p>
              <span className="text-text-faint text-xs font-medium">Your revision record</span>
            </div>
            <ul className="divide-line divide-y px-5 py-1">
              <Evidence icon="answer" label="The answer you gave" value="30 cm behind" />
              <Evidence icon="reason" label="Why it lost marks" value="Real image rule" />
              <Evidence icon="return" label="What returns next" value="Mirror numericals" />
            </ul>
          </div>
        </div>

        <ol
          data-steps
          className="relative flex flex-col gap-3 pl-12 sm:pl-16 lg:col-span-7 lg:pt-4"
        >
          <span
            aria-hidden="true"
            className="bg-line absolute top-7 bottom-7 left-[1.375rem] w-px sm:left-[1.875rem]"
          />
          <span
            data-rule
            aria-hidden="true"
            className="bg-brand-500 absolute top-7 bottom-7 left-[1.375rem] w-[2px] origin-top sm:left-[1.875rem]"
          />

          {STEPS.map((step) => (
            <li key={step.number} data-step className="group relative">
              <span
                aria-hidden="true"
                className="border-line bg-page text-text-faint absolute top-7 -left-12 grid size-11 place-items-center rounded-full border text-sm font-semibold tabular-nums transition-all duration-300 group-data-[reached]:border-brand-500 group-data-[reached]:bg-brand-500 group-data-[reached]:text-on-brand group-data-[reached]:shadow-brand sm:-left-16 sm:size-[3.75rem]"
              >
                {step.number}
              </span>

              <article
                className={`${cardClass()} group-data-[reached]:border-brand-200 group-data-[reached]:shadow-lift transition-[border-color,transform,box-shadow] duration-300`}
              >
                <p className="text-brand-700 text-eyebrow uppercase">{step.detail}</p>
                {/* A step above the app's `text-heading`: this is a landing page, where three
                    cards carry the whole argument and sit under a 45px headline. */}
                <h3 className="text-text mt-3 max-w-[23ch] text-2xl font-semibold tracking-[-0.025em]">
                  {step.title}
                </h3>
                <p className="text-text-soft mt-4 max-w-[58ch] leading-relaxed">{step.body}</p>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Evidence({
  icon,
  label,
  value,
}: {
  icon: "answer" | "reason" | "return";
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3 py-3.5">
      <span
        className={[
          "grid size-7 shrink-0 place-items-center rounded-full",
          icon === "answer" ? "bg-marker-100 text-marker-700" : "bg-tick-100 text-tick-700",
        ].join(" ")}
      >
        {icon === "answer" ? <Cross className="size-3.5" /> : <Check className="size-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-text-soft block text-xs">{label}</span>
        <span className="text-text block truncate text-sm font-semibold">{value}</span>
      </span>
    </li>
  );
}
