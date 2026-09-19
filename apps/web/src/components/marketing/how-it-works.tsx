import { Eyebrow } from "@/components/ui/page";

/**
 * The loop, stated once and briefly.
 *
 * This used to be a tall scroll-scrubbed section with a rule that filled as you
 * passed it. The marked script above now owns the page's scroll drama and says
 * the middle step of this loop far better than three sentences could, so what
 * is left here is the part it does not cover: what happens before a question
 * and what happens after it.
 *
 * Numbered, because unlike most numbered lists on landing pages this genuinely
 * is a sequence — and a cycle at that, which is why the third step points back
 * at the first.
 *
 * A Server Component now. There is nothing to animate and nothing to hold in
 * state, and shipping GSAP and a ScrollTrigger to a browser so that a hairline
 * can grow was never a good trade.
 */
const STEPS = [
  {
    title: "Choose the work in front of you",
    body: "A chapter, a topic, or the questions you have not met yet. Two taps from opening the app to a question.",
  },
  {
    title: "Make the mistake visible",
    body: "Objective questions mark as you commit. Written answers sit beside the CBSE marking scheme, so a lost mark has a reason.",
  },
  {
    title: "Meet it again, on purpose",
    body: "The question and the kind of mistake stay together. Your next revision set is built from exactly that, until it stops being a weak spot.",
  },
] as const;

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:py-28">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
          <h2 className="text-display max-w-[14ch]">A wrong answer is raw material.</h2>
          <p className="text-text-soft max-w-[34ch] text-sm leading-relaxed">
            Wrong once is data. Wrong twice is a pattern. The loop is the product.
          </p>
        </div>

        <ol className="divide-line border-line mt-12 grid divide-y border-t md:grid-cols-3 md:divide-x md:divide-y-0">
          {STEPS.map((step, index) => (
            <li key={step.title} className="py-7 md:px-7 md:first:pl-0 md:last:pr-0">
              <Eyebrow tone="muted">
                Step {index + 1}
                {index === STEPS.length - 1 ? ", and back to one" : ""}
              </Eyebrow>
              <h3 className="text-text text-subheading mt-3 max-w-[20ch]">{step.title}</h3>
              <p className="text-text-soft mt-3 max-w-[38ch] text-sm leading-relaxed">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
