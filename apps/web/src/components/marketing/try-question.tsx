"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

import { Check, Cross } from "@/components/icons";
import { ButtonLink } from "@/components/ui/button";

/**
 * The hero: a question you can actually answer.
 *
 * A landing page for a practice product should let you practise. This is one
 * real NCERT Class 10 question, live — tap an option and the page marks it,
 * exactly as the app does. It replaces the paragraph that would otherwise have
 * to claim the product is good at explaining mistakes.
 *
 * The wrong options are the mistakes students actually make rather than random
 * numbers, which is the whole argument: option B is what you get by multiplying
 * 96 by 404 and forgetting to divide by the HCF, and the feedback names that
 * error rather than saying "incorrect".
 *
 * Hand-built rather than fed through `QuestionRenderer`, and that is the same
 * deliberate exception the sign-in panel makes. There is no `StudentQuestion`
 * behind it, nothing is graded, and no attempt is recorded — building a fixture
 * to satisfy the renderer would ship test data in the production bundle and make
 * marketing copy answerable to a schema.
 */

const OPTIONS = [
  { id: "a", label: "A", body: "9696", correct: true },
  { id: "b", label: "B", body: "38,784", correct: false },
  { id: "c", label: "C", body: "2424", correct: false },
  { id: "d", label: "D", body: "404", correct: false },
] as const;

type OptionId = (typeof OPTIONS)[number]["id"];

/** Named for the actual mistake, which is the only reason feedback is useful. */
const WHY: Record<OptionId, string> = {
  a: "HCF × LCM = the product of the two numbers, so LCM = 96 × 404 ÷ 4.",
  b: "That is 96 × 404. The product of two numbers equals HCF × LCM, so it still has to be divided by the HCF of 4.",
  c: "That is 96 × 404 ÷ 16. The divisor is the HCF itself, 4 — not its square.",
  d: "404 is one of the numbers, not a multiple of both. The LCM can never be smaller than the larger number.",
};

export function TryQuestion() {
  const [chosen, setChosen] = useState<OptionId | null>(null);
  const answered = chosen !== null;
  const right = chosen === "a";

  return (
    <div className="rounded-panel border-line bg-card shadow-pop overflow-hidden border text-left">
      <header className="border-line flex items-center gap-3 border-b px-5 py-3.5">
        <span className="text-text text-sm font-semibold">Question 7</span>
        <span className="bg-raised text-text-soft rounded-pill px-2.5 py-1 text-xs font-medium">
          Real Numbers
        </span>
        <span className="marks-margin text-text-soft ml-auto text-sm font-medium">1 mark</span>
      </header>

      <div className="flex flex-col gap-4 px-5 py-5">
        <p className="text-text font-serif text-[1.0625rem] leading-[1.65]">
          Given that HCF(96, 404) = 4, the LCM of 96 and 404 is:
        </p>

        <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={answered}>
          <legend className="sr-only">Choose one answer</legend>
          {OPTIONS.map((option) => (
            <Option
              key={option.id}
              label={option.label}
              body={option.body}
              // Only the chosen option and the right one are marked. Colouring
              // all four turns a question into an answer key.
              state={
                !answered
                  ? "idle"
                  : option.correct
                    ? "right"
                    : option.id === chosen
                      ? "wrong"
                      : "idle"
              }
              onSelect={() => {
                setChosen(option.id);
              }}
            />
          ))}
        </fieldset>

        <AnimatePresence initial={false}>
          {answered ? (
            <motion.div
              // Motion that answers the reader's own tap, which is the kind
              // worth having. Height and opacity only: the panel appears where
              // it will live rather than sliding in from somewhere it never was.
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="border-line flex flex-col gap-3 border-t pt-4">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={[
                      "inline-flex items-center gap-1.5 font-semibold",
                      right ? "text-tick-700" : "text-marker-700",
                    ].join(" ")}
                  >
                    {right ? <Check className="size-4" /> : <Cross className="size-4" />}
                    {right ? "Correct" : "Not right"}
                  </span>
                  <span className="text-text-soft">
                    {right ? "1 mark" : "0 marks"} — the answer is 9696
                  </span>
                </p>

                <p className="text-text-soft font-serif text-[0.9375rem] leading-[1.6]">
                  {WHY[chosen]}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <ButtonLink href="/sign-up" size="sm">
                    Practise questions like this
                  </ButtonLink>
                  <button
                    type="button"
                    onClick={() => {
                      setChosen(null);
                    }}
                    className="text-text-soft hover:text-text min-h-11 text-sm font-medium underline underline-offset-4"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.p
              key="prompt"
              initial={false}
              exit={{ opacity: 0 }}
              className="text-text-faint text-sm"
            >
              Pick an answer — this one is live.
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Option({
  label,
  body,
  state,
  onSelect,
}: {
  label: string;
  body: string;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}) {
  const marked = state !== "idle";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-control flex min-h-11 items-center gap-3 border px-3.5 py-2.5 text-left transition-colors",
        state === "right"
          ? "border-tick-500 bg-tick-50"
          : state === "wrong"
            ? "border-marker-500 bg-marker-50"
            : "border-line-strong bg-card enabled:hover:border-brand-500 enabled:hover:bg-brand-50/60",
      ].join(" ")}
    >
      {/* The letter is the control, the way it is in the app. When the question
          is marked the badge becomes the verdict, so shape carries the result
          before colour does. */}
      <span
        className={[
          "grid size-7 shrink-0 place-items-center rounded-full border text-[0.8125rem] font-bold",
          state === "right"
            ? "border-tick-600 bg-tick-600 text-white"
            : state === "wrong"
              ? "border-marker-600 bg-marker-600 text-white"
              : "border-line-strong text-text-soft",
        ].join(" ")}
      >
        {state === "right" ? (
          <Check className="size-4" />
        ) : state === "wrong" ? (
          <Cross className="size-4" />
        ) : (
          label
        )}
      </span>

      <span className={marked ? "text-sand-900 font-serif" : "text-text font-serif"}>{body}</span>
    </button>
  );
}
