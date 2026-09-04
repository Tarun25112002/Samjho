import { Show } from "@clerk/nextjs";
import type { Metadata } from "next";

import { Hero } from "@/components/marketing/hero";
import { HowItWorks } from "@/components/marketing/how-it-works";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = {
  // `absolute`, because the root layout's template appends "· Samjho" — and the
  // home page is the one title that already ends in the product's name.
  title: { absolute: "Samjho — CBSE Class 10 board exam practice" },
  description:
    "Practise CBSE Class 10 Maths and Science question by question. Every question comes with its marking scheme, so you find out where the marks went — not just whether you were right.",
};

/**
 * The public landing page.
 *
 * ## What it claims
 *
 * Only what exists. Samjho is a closed pilot with two subjects and no user
 * count, so there are no student numbers, no testimonials and no logo wall —
 * the figures in the hero describe the *exam* instead, taken from the same
 * blueprint the exam engine builds papers from. The one feature that is not
 * finished says so in its own row rather than being quietly listed alongside the
 * ones that are.
 *
 * That is a product decision as much as an honesty one: the audience is
 * fourteen-year-olds and their parents, and a page that oversells is a page a
 * parent reads twice.
 */
export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Inside />
      <ForParents />
      <FinalCall />
    </>
  );
}

/**
 * What is in the product.
 *
 * One large panel and a list, rather than six identical cards. The marking
 * scheme is the thing worth showing rather than describing, so it gets the
 * space and everything else gets a line — which also happens to be the honest
 * ranking of how much each one matters.
 */
function Inside() {
  return (
    <section id="inside" className="bg-raised scroll-mt-24 py-20 lg:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="max-w-2xl text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-5xl">
          What you actually get
        </h2>

        <div className="mt-12 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <MarkingScheme />
          </div>

          <ul className="lg:col-span-5 lg:self-start">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className="border-line border-b py-5 first:pt-0 last:border-0"
              >
                <div className="flex items-baseline gap-3">
                  <h3 className="text-text font-semibold">{feature.title}</h3>
                  {feature.status ? (
                    <span className="bg-half-100 text-half-700 rounded-pill px-2.5 py-0.5 text-xs font-semibold">
                      {feature.status}
                    </span>
                  ) : null}
                </div>
                <p className="text-text-soft mt-1.5 text-sm leading-relaxed">{feature.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "All ten question types",
    body: "Multiple choice, assertion and reason, case studies, numericals, match the following and the rest — laid out the way the paper lays them out, with the maths properly set.",
  },
  {
    title: "Previous-year questions",
    body: "Tagged with the paper and the year they came from, so you know what you are looking at.",
  },
  {
    title: "Why you got it wrong",
    body: "One tap after a wrong answer: silly mistake, calculation slip, misread the question, hadn't learnt it yet. Twelve wrong answers turn into one sentence about what to fix.",
  },
  {
    title: "Saved questions",
    body: "Anything you want to come back to, in one list.",
  },
  {
    title: "The full three-hour paper",
    body: "Eighty marks, five sections, the real internal choices — sat end to end before you sit the real one.",
    status: "In build",
  },
];

/**
 * The marking scheme, shown rather than described.
 *
 * A real CBSE three-marker with its real allocation. The marks sit in the right
 * margin behind a hairline, which is where they sit on the printed paper and
 * where they sit everywhere in this product.
 */
function MarkingScheme() {
  return (
    <figure className="rounded-panel border-line bg-card shadow-lift m-0 overflow-hidden border lg:sticky lg:top-28">
      <div className="border-line flex items-baseline justify-between border-b px-6 py-4">
        <span className="text-text text-sm font-semibold">Question 20</span>
        <span className="marks-margin text-text-soft text-sm font-medium">3 marks</span>
      </div>

      <div className="flex flex-col gap-5 px-6 py-6">
        <p className="text-text font-serif text-lg leading-[1.6]">
          Prove that <span className="whitespace-nowrap">√5</span> is irrational.
        </p>

        <div>
          <h3 className="text-text text-sm font-semibold">Marking scheme</h3>
          <ol className="mt-3 flex flex-col">
            {SCHEME.map((step) => (
              <li
                key={step.text}
                className="border-line flex items-start gap-4 border-b py-3 last:border-0"
              >
                <span className="text-text-soft font-serif text-[0.9375rem] leading-[1.6]">
                  {step.text}
                </span>
                <span className="marks-margin text-text ml-auto shrink-0 text-sm font-semibold">
                  {step.marks}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <figcaption className="text-text-soft border-line border-t pt-4 text-sm leading-relaxed">
          This is what comes back with a written answer — the same scheme an examiner works from.
          You compare it against what you wrote and award yourself the marks, which is the skill the
          exam is testing and the one nothing else lets you rehearse.
        </figcaption>
      </div>
    </figure>
  );
}

const SCHEME = [
  { text: "Assume √5 = p/q, where p and q are coprime and q ≠ 0", marks: "1" },
  { text: "Show that 5 divides p, and write p = 5m", marks: "1" },
  { text: "Show that 5 divides q, contradicting coprimality", marks: "1" },
];

/**
 * The section a parent reads.
 *
 * Stated plainly and up front rather than buried in a policy page. Under the
 * DPDP Act essentially every user here is a minor, and a parent is entitled to
 * know the position before their child signs up rather than after. It is also
 * the sharpest difference between this product and the rest of the category,
 * which is why it gets a section rather than a footer link.
 */
function ForParents() {
  return (
    <section id="parents" className="scroll-mt-24 py-20 lg:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
        <div>
          <h2 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] sm:text-5xl">
            A note for parents
          </h2>
          <p className="text-text-soft mt-5 max-w-[48ch] text-base leading-relaxed sm:text-lg">
            Samjho is in a closed pilot and free to use. It is built for students who are, almost
            without exception, under eighteen — so the position on their data is the first thing on
            this page rather than the last.
          </p>
        </div>

        <ul className="flex flex-col">
          {COMMITMENTS.map((item) => (
            <li key={item.title} className="border-line border-b py-5 first:pt-0 last:border-0">
              <h3 className="text-text font-semibold">{item.title}</h3>
              <p className="text-text-soft mt-1.5 text-sm leading-relaxed">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const COMMITMENTS = [
  {
    title: "No advertising and no behavioural tracking",
    body: "There are no ad networks, no analytics pixels and no third-party scripts anywhere in this product, signed in or out. Even the fonts are served from our own servers rather than fetched from Google.",
  },
  {
    title: "A guardian's email is asked for at sign-up",
    body: "We record that your child has declared a guardian permits the account. During the pilot we do not yet contact you to confirm it directly, and the product says so on their profile rather than showing a tick it has not earned.",
  },
  {
    title: "Nothing is sold, because nothing is for sale",
    body: "The pilot is free. There is no upsell inside the app and no card on file.",
  },
];

/**
 * The last thing on the page, and the only full-bleed saffron surface in the
 * product.
 *
 * Saffron carries near-black type everywhere else, so the button on top of it
 * has to invert to stay the loudest object in the frame — near-black fill, white
 * label, 14:1. It is the one moment the palette turns itself over, and it works
 * because it happens once.
 */
function FinalCall() {
  return (
    <section className="px-5 pb-20 sm:px-8 lg:pb-28">
      <div className="rounded-panel bg-brand-500 text-on-brand mx-auto max-w-6xl px-8 py-14 text-center sm:px-12 lg:py-20">
        <h2 className="mx-auto max-w-[18ch] text-[2rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl">
          Your first set is ten questions
        </h2>
        {/* A solid step down rather than `opacity-80`. Fading near-black type on
            a saturated orange loses more contrast than it looks like it does;
            `sand-800` is the softer voice and still measures 4.7:1. */}
        <p className="text-sand-800 mx-auto mt-5 max-w-[46ch] text-base leading-relaxed sm:text-lg">
          No card, no trial countdown. Sign up, choose your subjects, and start answering.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
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
              className="border-transparent! bg-white/25! text-on-brand! hover:bg-white/40!"
            >
              Sign in
            </ButtonLink>
          </Show>
        </div>
      </div>
    </section>
  );
}
