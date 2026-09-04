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
 * ## Why the panel is white
 *
 * The brief is white and orange, and a full-bleed saffron block spends the whole
 * budget in one place — it leaves the orange nowhere to go on the rest of the
 * page, and it makes the form beside it look like a different website. So the
 * ground stays paper and the orange does the talking: the headline, the mark,
 * the ruled margin. The two columns are told apart by the ruling and one
 * hairline, which is the same distinction a notebook page has from the desk it
 * sits on.
 *
 * ## Why it is desktop-only
 *
 * Not a compromise. On a phone the only correct thing on a sign-in screen is the
 * sign-in form; anything above it pushes the field a student came to fill in
 * below the fold. The mobile header carries the wordmark and one line, and that
 * is the whole story a phone needs to tell.
 */
export function AuthAside({ headline, note }: { headline: string; note: string }) {
  return (
    <aside className="bg-page ruled-paper border-line relative hidden flex-col justify-between gap-10 overflow-hidden border-r p-10 lg:flex xl:p-14">
      <Wordmark size="lg" tone="brand" />

      <div className="flex max-w-md flex-col gap-8">
        {/*
          Set entirely in saffron rather than in near-black with one word picked
          out. At 40px it is large text, so `brand-600` clears the 3:1 the
          guidelines ask of it — `brand-500` would not, which is why the headline
          is a step deeper than the button beside it.
        */}
        <h2 className="text-brand-600 text-[2.125rem] leading-[1.12] font-semibold tracking-[-0.03em] xl:text-[2.5rem]">
          {headline}
        </h2>

        <MarkedQuestion />
      </div>

      <p className="text-text-soft max-w-md text-sm leading-relaxed">{note}</p>
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
    <figure className="rounded-panel border-line bg-card shadow-lift m-0 overflow-hidden border">
      <div className="border-line flex items-baseline justify-between border-b px-5 py-3">
        <span className="text-text-soft text-sm font-semibold">Question 12</span>
        <span className="marks-margin text-text-soft text-sm font-medium">3 marks</span>
      </div>

      <div className="flex flex-col gap-4 px-5 py-4">
        <p className="text-text font-serif text-[0.9375rem] leading-[1.65]">
          A concave mirror produces a three times magnified real image of an object placed 10 cm in
          front of it. Where is the image located?
        </p>

        <ul className="flex flex-col gap-2">
          <Option state="wrong" label="A" text="30 cm behind the mirror" verdict="You chose this" />
          <Option state="right" label="B" text="30 cm in front of the mirror" verdict="Correct" />
        </ul>

        <p className="border-line text-text-soft border-t pt-3 font-serif text-sm leading-[1.6]">
          A real image forms on the same side as the object, so it cannot be behind the mirror.
        </p>
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
        right ? "border-tick-500 bg-tick-50" : "border-marker-500 bg-marker-50",
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
