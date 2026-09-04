import { Show } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Check } from "@/components/icons";
import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  title: { absolute: "Samjho — CBSE Class 10 board exam practice" },
  description:
    "Practise CBSE Class 10 Maths and Science question by question. Every question comes with its marking scheme, so you find out where the marks went — not just whether you were right.",
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <SignalStrip />
      <HowItWorks />
      <Inside />
      <ForParents />
      <FinalCall />
    </>
  );
}

/** A compact promise sheet immediately after the first interaction. */
function SignalStrip() {
  const signals = [
    ["The right paper", "Class 10 Maths and Science, on the CBSE pattern."],
    ["The whole answer", "The marking scheme explains where each mark belongs."],
    ["The next attempt", "Your mistakes shape what returns in revision."],
  ] as const;

  return (
    <section aria-label="How Samjho is different" className="bg-sand-950 text-white">
      <div className="mx-auto grid max-w-6xl divide-y divide-white/10 px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0">
        {signals.map(([title, body], index) => (
          <div key={title} className="flex gap-4 py-6 md:px-6 md:first:pl-0 md:last:pr-0 lg:py-7">
            <span className="text-brand-300 pt-0.5 text-xs font-semibold tracking-[0.12em]">0{index + 1}</span>
            <div>
              <h2 className="text-sm font-semibold">{title}</h2>
              <p className="mt-1.5 max-w-[25ch] text-sm leading-relaxed text-white/65">{body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Inside() {
  return (
    <section id="inside" className="bg-raised scroll-mt-24 border-y border-[var(--color-line)] py-24 lg:py-36">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end lg:gap-12">
          <div className="lg:col-span-7">
            <p className="text-brand-700 text-xs font-semibold tracking-[0.13em] uppercase">
              Made for the marks that matter
            </p>
            <h2 className="mt-4 max-w-[13ch] text-[2.4rem] leading-[1.03] font-semibold tracking-[-0.045em] sm:text-5xl">
              A question bank does not know what you need next.
            </h2>
          </div>
          <p className="text-text-soft max-w-[40ch] leading-relaxed lg:col-span-5 lg:pb-1">
            Samjho treats every answer like a marked script. The question, the working, the marks
            and the revision all live in the same place.
          </p>
        </div>

        <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:items-start">
          <div className="lg:col-span-7">
            <MarkingScheme />
          </div>
          <FeatureLedger />
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "All ten question types",
    body: "MCQs, assertion and reason, case studies, numericals, match the following and the rest — shaped like the paper, with proper maths throughout.",
  },
  {
    title: "Previous-year context",
    body: "Questions carry the paper and year they came from, so a familiar question arrives with the context that makes it useful.",
  },
  {
    title: "Mistake-aware revision",
    body: "A calculation slip, a misread, or a gap in learning do not need the same next question. Your revision set knows the difference.",
  },
  {
    title: "Questions worth keeping",
    body: "Save the proofs, numericals and traps you want to see again. Your own difficult-question notebook, already organised.",
  },
] as const;

function FeatureLedger() {
  return (
    <div className="lg:col-span-5 lg:pt-1">
      <p className="text-text-faint border-line border-b pb-4 text-xs font-semibold tracking-[0.12em] uppercase">
        In your working copy
      </p>
      <ol className="divide-line divide-y">
        {FEATURES.map((feature, index) => (
          <li key={feature.title} className="group grid grid-cols-[2.75rem_1fr] gap-3 py-5 first:pt-6">
            <span className="text-brand-700 pt-0.5 text-sm font-semibold tabular-nums">0{index + 1}</span>
            <div>
              <h3 className="text-text text-lg font-semibold tracking-[-0.015em] transition-colors group-hover:text-brand-700">
                {feature.title}
              </h3>
              <p className="text-text-soft mt-2 text-sm leading-relaxed">{feature.body}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="border-half-300 bg-half-50 text-half-700 mt-5 rounded-control border px-4 py-3 text-sm leading-relaxed">
        Full three-hour papers are being built with the real internal choices and section rules.
      </p>
    </div>
  );
}

function MarkingScheme() {
  return (
    <figure className="rounded-panel border-line bg-card shadow-pop m-0 overflow-hidden border">
      <div className="border-line flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-5 py-4 sm:px-6">
        <span className="text-text text-sm font-semibold">Section D · Question 20</span>
        <span className="text-text-faint text-sm">Written answer</span>
        <span className="marks-margin text-text-soft ml-auto text-sm font-medium">3 marks</span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="flex flex-col gap-6 px-5 py-6 sm:px-7 sm:py-8">
          <div>
            <p className="text-brand-700 text-xs font-semibold tracking-[0.12em] uppercase">The question</p>
            <p className="text-text mt-3 font-serif text-xl leading-[1.55] sm:text-2xl">
              Prove that <span className="whitespace-nowrap">√5</span> is irrational.
            </p>
          </div>

          <div>
            <div className="flex items-baseline justify-between gap-4">
              <h3 className="text-text text-sm font-semibold">The marking scheme</h3>
              <span className="text-text-faint text-xs">Read it like an examiner</span>
            </div>
            <ol className="mt-3 flex flex-col">
              {SCHEME.map((step) => (
                <li key={step.text} className="border-line flex items-start gap-4 border-b py-4 last:border-0">
                  <span className="text-brand-700 mt-0.5 text-xs font-semibold tabular-nums">{step.id}</span>
                  <span className="text-text-soft flex-1 font-serif leading-[1.6]">{step.text}</span>
                  <span className="marks-margin text-text shrink-0 text-sm font-semibold">{step.marks}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <figcaption className="border-line bg-brand-50 flex flex-col justify-between gap-8 border-t px-5 py-6 sm:px-7 lg:border-t-0 lg:border-l lg:px-5">
          <div>
            <p className="text-brand-700 text-xs font-semibold tracking-[0.12em] uppercase">The point</p>
            <p className="text-text mt-3 text-sm leading-relaxed">
              You do not just see the answer. You can see what earns each mark.
            </p>
          </div>
          <p className="text-brand-700 text-sm font-semibold">Mark it. Learn it. Meet it again.</p>
        </figcaption>
      </div>
    </figure>
  );
}

const SCHEME = [
  { id: "A", text: "Assume √5 = p/q, where p and q are coprime and q ≠ 0", marks: "1" },
  { id: "B", text: "Show that 5 divides p, and write p = 5m", marks: "1" },
  { id: "C", text: "Show that 5 divides q, contradicting coprimality", marks: "1" },
];

function ForParents() {
  return (
    <section id="parents" className="scroll-mt-24 px-5 py-24 sm:px-8 lg:py-36">
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-panel bg-sand-950 px-6 py-10 text-white sm:px-10 sm:py-14 lg:px-14 lg:py-16">
        <div aria-hidden="true" className="parent-stamp absolute -top-12 -right-10 hidden lg:block">
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
          <span>FOR STUDENTS</span>
        </div>

        <div className="relative grid gap-14 lg:grid-cols-12 lg:gap-16">
          <div className="lg:col-span-5">
            <p className="text-brand-300 text-xs font-semibold tracking-[0.13em] uppercase">
              A note for parents
            </p>
            <h2 className="mt-4 max-w-[12ch] text-[2.35rem] leading-[1.04] font-semibold tracking-[-0.045em] sm:text-5xl">
              Built for studying, not for holding attention.
            </h2>
            <p className="mt-6 max-w-[38ch] text-base leading-relaxed text-white/65">
              This is a closed, free pilot for students preparing for an exam. That gives us a
              simple standard: the product should respect a student and their family before it
              asks for their time.
            </p>
          </div>

          <ul className="divide-y divide-white/10 lg:col-span-7">
            {COMMITMENTS.map((item, index) => (
              <li key={item.title} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5 first:pt-0 last:pb-0">
                <span className="text-brand-300 text-sm font-semibold tabular-nums">0{index + 1}</span>
                <div>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-white/65">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-sm text-white/70">
          <span className="inline-flex items-center gap-2 text-white">
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
    body: "We ask for a parent or guardian’s email because the students using Samjho are usually under 18. The pilot is clear about what it does and does not verify.",
  },
  {
    title: "Nothing is being sold inside the product",
    body: "Samjho is free during the pilot. There is no subscription prompt in the middle of a set and no payment method stored on an account.",
  },
];

function FinalCall() {
  return (
    <section className="px-5 pb-24 sm:px-8 lg:pb-36">
      <div className="final-sheet relative mx-auto grid max-w-6xl overflow-hidden rounded-panel bg-brand-500 px-6 py-8 sm:px-10 sm:py-12 lg:grid-cols-12 lg:items-center lg:gap-10 lg:px-14 lg:py-16">
        <div aria-hidden="true" className="final-sheet-number text-on-brand absolute -bottom-14 -left-3 select-none font-semibold leading-none tracking-[-0.09em] sm:-bottom-20 sm:left-2">
          10
        </div>

        <div className="relative border-b border-black/15 pb-7 lg:col-span-3 lg:border-r lg:border-b-0 lg:py-3 lg:pr-10 lg:pb-3">
          <p className="text-on-brand text-6xl leading-none font-semibold tracking-[-0.07em] sm:text-7xl">10</p>
          <p className="text-sand-800 mt-2 max-w-[12ch] text-sm font-semibold">questions in your first set</p>
        </div>

        <div className="relative pt-8 lg:col-span-9 lg:pt-0">
          <p className="text-sand-800 text-xs font-semibold tracking-[0.13em] uppercase">Start with the paper</p>
          <h2 className="text-on-brand mt-3 max-w-[14ch] text-[2.35rem] leading-[1.04] font-semibold tracking-[-0.045em] sm:text-5xl">
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
