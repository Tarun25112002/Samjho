import Image from "next/image";

import { Wordmark } from "@/components/brand/logo";
import { Check, Cross } from "@/components/icons";

/**
 * The panel beside the sign-in form.
 *
 * ## Why it shows a marked question rather than an illustration
 *
 * Every ed-tech sign-in page in this market puts a smiling stock student, a
 * gradient blob or a wall of logos here. None of them tells you what the product
 * does. This one shows the exact thirty seconds Samjho exists for: you answered,
 * you were wrong, and here is why — which is what the name means.
 *
 * The question is a real NCERT Class 10 one (Light, concave mirrors) with a real
 * answer, not lorem ipsum: m = −3 and u = −10 cm give v = −30 cm, so the image is
 * 30 cm in front. A prospective student can check the arithmetic, and the two
 * options are the genuine mistake and the genuine answer rather than a
 * decorative pair.
 *
 * ## Why the panel feels like a desk
 *
 * The form should remain a quiet paper surface. The supporting panel takes the
 * warmer, more immersive role: a small, focused revision moment against a dark
 * saffron desk. It gives the card enough contrast and purpose without making
 * the authentication surface feel crowded.
 *
 * ## Why it is desktop-only
 *
 * Not a compromise. On a phone the only correct thing on a sign-in screen is the
 * sign-in form; anything above it pushes the field a student came to fill in
 * below the fold. The mobile header carries the wordmark and one line, and that
 * is the whole story a phone needs to tell.
 */
export function AuthAside({
  eyebrow,
  headline,
  note,
}: {
  eyebrow: string;
  headline: string;
  note: string;
}) {
  return (
    <aside className="auth-aside relative hidden h-full min-h-0 overflow-hidden px-10 py-9 text-sand-50 xl:flex xl:flex-col xl:px-14">
      <div aria-hidden="true" className="auth-aside-orbit absolute" />

      <div className="relative z-10 flex items-center justify-between">
        <Wordmark size="md" variant="inverse" tone="inherit" />
        <span className="auth-aside-session rounded-pill text-micro border px-3 py-1.5 uppercase">
          Revision mode
        </span>
      </div>

      <div aria-hidden="true" className="auth-aside-character">
        <span className="auth-aside-character-note">Your work, remembered.</span>
        <Image
          src="/illustrations/study-at-desk.svg"
          alt=""
          width={849}
          height={842}
          className="relative z-10 w-full"
        />
      </div>

      <div className="auth-aside-copy relative z-10 my-auto max-w-[31rem]">
        <p className="text-brand-200 text-eyebrow mb-4 uppercase">{eyebrow}</p>
        {/* Size, weight and tracking come from `.auth-aside-copy h2` in globals.css —
            see the note there for why they cannot live in a class here. */}
        <h2>{headline}</h2>
        <p className="auth-aside-note text-on-desk-soft mt-5 max-w-md text-sm leading-relaxed">
          {note}
        </p>

        <MarkedQuestion />
      </div>

      <p className="text-on-desk-soft relative z-10 text-xs leading-relaxed">
        A small review now makes the next answer easier.
      </p>
    </aside>
  );
}

/**
 * A question card exactly as the app draws one, marked.
 *
 * Hand-built rather than fed through `QuestionRenderer`, and that is a
 * deliberate exception to the rule that every question on every surface goes
 * through the renderer. This is not a question — nobody can answer it, it is
 * never graded, and there is no `StudentQuestion` behind it. Building a fake one
 * to satisfy the renderer would put a fixture in the production bundle and make
 * marketing copy answerable to a schema. The structure is copied; the pretence
 * is not.
 */
function MarkedQuestion() {
  return (
    <figure className="auth-aside-question relative mt-8 mb-0 overflow-hidden rounded-[1.25rem] border bg-card text-text shadow-pop">
      <div className="auth-question-topline flex items-center justify-between px-5 pt-4 pb-3">
        <span className="auth-question-subject rounded-pill text-micro px-2.5 py-1 uppercase">
          Physics · Light
        </span>
        <span className="text-text-faint text-xs font-medium">3 marks</span>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-1 pb-5">
        <div className="flex items-center gap-2">
          <span className="bg-brand-500 grid size-6 place-items-center rounded-full text-[0.6875rem] font-bold text-on-brand">
            12
          </span>
          <span className="text-text-soft text-xs font-semibold">Mirror formula</span>
        </div>

        <p className="text-prose font-serif">
          A concave mirror produces a three times magnified real image of an object placed 10 cm in
          front of it. Where is the image located?
        </p>

        <ul className="flex flex-col gap-2">
          <Option state="wrong" label="A" text="30 cm behind the mirror" verdict="Your answer" />
          <Option
            state="right"
            label="B"
            text="30 cm in front of the mirror"
            verdict="Correct answer"
          />
        </ul>

        <div className="auth-aside-question-explanation rounded-control bg-brand-50 px-3.5 py-3">
          <p className="text-brand-800 text-eyebrow uppercase">Why it works</p>
          <p className="text-text-soft mt-1 font-serif text-sm leading-[1.5]">
            A real image forms on the same side as the object, so it is in front of the mirror.
          </p>
        </div>
      </div>
    </figure>
  );
}

function Option({
  state,
  label,
  text,
  verdict,
}: {
  state: "right" | "wrong";
  label: string;
  text: string;
  verdict: string;
}) {
  const right = state === "right";

  return (
    <li
      className={[
        "rounded-control flex items-center gap-3 border px-3 py-2.5 text-sm",
        right ? "border-tick-500 bg-tick-50" : "border-line bg-raised",
      ].join(" ")}
    >
      {/* Shape first, colour second. The tick and the cross are told apart with
          the saturation turned off, which is the requirement in docs/01 §9. */}
      <span
        className={[
          "grid size-5 shrink-0 place-items-center rounded-full text-white",
          right ? "bg-tick-600" : "bg-marker-600",
        ].join(" ")}
      >
        {right ? <Check className="size-3" /> : <Cross className="size-3" />}
      </span>

      {/* The state tints are literal ramps and stay light, so the type on them
          is the literal dark step rather than the semantic one. */}
      <span className="text-sand-900 font-serif">
        <span className="text-sand-600 font-sans font-semibold">{label}</span> {text}
      </span>

      <span
        className={[
          "ml-auto shrink-0 text-xs font-semibold",
          right ? "text-tick-700" : "text-marker-700",
        ].join(" ")}
      >
        {verdict}
      </span>
    </li>
  );
}
