import { Show } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Check } from "@/components/icons";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { InsideBento } from "@/components/marketing/inside-bento";
import { MarkedScript } from "@/components/marketing/marked-script";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/page";

export const metadata: Metadata = {
  title: { absolute: "Medhavi — CBSE Class 10 board exam practice" },
  description:
    "Practise CBSE Class 10 Maths and Science question by question. Every question comes with its marking scheme, so you find out where the marks went — not just whether you were right.",
};

/**
 * The landing page.
 *
 * ## The shape of the argument
 *
 * Answer a question → see what the paper is → watch a mark land → understand
 * the loop → see what is inside → read what we promise your parents → begin.
 *
 * The third of those is the one that matters. Every competitor's page claims to
 * explain mistakes, so the claim is worth nothing; `MarkedScript` marks a real
 * three-mark proof in front of the reader instead, and the rest of the page was
 * deliberately quietened around it. One section is allowed to be the memorable
 * one.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <ThePaper />
      <MarkedScript />
      <HowItWorks />
      <InsideBento />
      <ForParents />
      <FinalCall />
    </>
  );
}

/**
 * The exam, in four numbers.
 *
 * Facts about the *paper*, not about us. A pilot with no students yet has no
 * honest metrics of its own, and "10,000 questions solved" on a page that also
 * promises not to manipulate anyone would be the first lie on it. These four are
 * the shape of the thing a reader is actually afraid of, and every one is
 * checkable against the CBSE sample paper.
 */
const PAPER = [
  { figure: "80", label: "marks in the theory paper" },
  { figure: "5", label: "sections, A through E" },
  { figure: "3h", label: "on the day, start to finish" },
  { figure: "10", label: "question types, all of them" },
] as const;

function ThePaper() {
  return (
    <section aria-labelledby="the-paper" className="px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3">
          <h2 id="the-paper" className="text-text text-heading">
            The paper you are preparing for
          </h2>
          <p className="text-text-faint text-sm">CBSE Class 10 · Maths, Science</p>
        </div>

        <dl className="border-line mt-8 grid grid-cols-2 gap-y-8 border-t pt-8 sm:grid-cols-4">
          {PAPER.map((fact) => (
            <div
              key={fact.label}
              className="border-line px-1 sm:border-l sm:px-6 sm:first:border-l-0 sm:first:pl-1"
            >
              <dd className="text-text text-figure-lg tabular-nums">{fact.figure}</dd>
              <dt className="text-text-soft mt-2 max-w-[22ch] text-sm leading-snug">
                {fact.label}
              </dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function ForParents() {
  return (
    <section id="parents" className="scroll-mt-24 px-5 py-24 sm:px-8 lg:py-32">
      <div className="rounded-panel bg-desk text-on-desk relative mx-auto max-w-6xl overflow-hidden px-6 py-10 sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        {/* Far enough out that only the arc grazes the corner. It used to sit
            at -right-10, where the commitments list ran straight through it and
            the stamp read as a rendering fault rather than as stationery. */}
        <div aria-hidden="true" className="parent-stamp absolute -top-20 -right-32 hidden lg:block">
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
        </div>

        <div className="relative grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <Eyebrow tone="desk">A note for parents</Eyebrow>
            <h2 className="text-display mt-4 max-w-[12ch]">
              Built for studying, not for holding attention.
            </h2>
            <p className="text-on-desk-soft mt-6 max-w-[38ch] text-base leading-relaxed">
              This is a closed, free pilot for students preparing for an exam. That gives us a
              simple standard: the product should respect a student and their family before it asks
              for their time.
            </p>
          </div>

          <ul className="divide-desk-line divide-y lg:col-span-7">
            {COMMITMENTS.map((item) => (
              <li key={item.title} className="py-5 first:pt-0 last:pb-0">
                <h3 className="text-base font-semibold">{item.title}</h3>
                <p className="text-on-desk-soft mt-2 max-w-[52ch] text-sm leading-relaxed">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-desk-line text-on-desk-soft relative mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t pt-6 text-sm">
          <span className="text-on-desk inline-flex items-center gap-2">
            <Check className="text-brand-300 size-4" /> No card on file
          </span>
          <span>Class 10 · CBSE preparation</span>
          <span>Closed pilot</span>
        </div>
      </div>
    </section>
  );
}

const COMMITMENTS = [
  {
    title: "No advertising and no behavioural tracking",
    body: "No ad networks, analytics pixels or third-party tracking scripts. The product does not need to know how to keep a student scrolling.",
  },
  {
    title: "A guardian’s email is requested during onboarding",
    body: "We ask for a parent or guardian’s email because the students using Medhavi are usually under 18. The pilot is clear about what it does and does not verify.",
  },
  {
    title: "Nothing is being sold inside the product",
    body: "Medhavi is free during the pilot. There is no subscription prompt in the middle of a set and no payment method stored on an account.",
  },
];

function FinalCall() {
  return (
    <section className="px-5 pb-24 sm:px-8 lg:pb-32">
      <div className="final-sheet relative mx-auto grid max-w-6xl overflow-hidden rounded-panel bg-brand-500 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-14 lg:py-16">
        <div
          aria-hidden="true"
          className="final-sheet-number text-on-brand absolute -bottom-14 -left-3 select-none font-semibold leading-none tracking-[-0.09em] sm:-bottom-20 sm:left-2"
        >
          10
        </div>

        <div className="relative border-b border-black/15 pb-7 lg:col-span-3 lg:border-r lg:border-b-0 lg:py-3 lg:pr-10 lg:pb-3">
          <p className="text-on-brand text-hero">10</p>
          <p className="text-sand-800 mt-2 max-w-[12ch] text-sm font-semibold">
            questions in your first set
          </p>
        </div>

        <div className="relative pt-8 lg:col-span-9 lg:pt-0">
          <h2 className="text-on-brand text-display max-w-[14ch]">
            Sit down with the question you need.
          </h2>
          <p className="text-sand-800 mt-5 max-w-[48ch] leading-relaxed">
            No card, no trial countdown, no strange detour. Choose your subjects and begin with a
            set that gives the marks a reason.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Show
              when="signed-out"
              fallback={
                <ButtonLink
                  href="/home"
                  size="lg"
                  className="bg-sand-950! text-white! shadow-none! hover:bg-sand-900!"
                >
                  Go to your dashboard
                </ButtonLink>
              }
            >
              <ButtonLink
                href="/sign-up"
                size="lg"
                className="bg-sand-950! text-white! shadow-none! hover:bg-sand-900!"
              >
                Start practising free
              </ButtonLink>
              <ButtonLink
                href="/sign-in"
                size="lg"
                variant="secondary"
                className="border-black/15! bg-white/22! text-on-brand! hover:bg-white/35!"
              >
                Sign in
              </ButtonLink>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}
