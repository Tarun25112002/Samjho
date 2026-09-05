"use client";

import {
  meResponseSchema,
  teacherOnboardingInputSchema,
  type TeacherOnboardingFormValues,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceCard as CheckCard, inputClass, Label } from "@/components/ui/form";
import { Card } from "@/components/ui/surface";
import { sendJson } from "@/lib/client-api";

/**
 * The first question onboarding asks: are you studying, or teaching?
 *
 * ## Why this is a screen and not a checkbox on the student wizard
 *
 * The two accounts diverge immediately and completely. A student is asked their
 * class, their board sitting, their subjects and their guardian's email; a
 * teacher is asked none of those and has no use for any of them. Folding both
 * into one form would mean four fields that appear and vanish, and a submission
 * whose meaning depends on a radio button three steps above.
 *
 * It also keeps the security story simple. Choosing "I teach" here does not put
 * a role in a request body — it routes the browser to a different form, which
 * posts to a different endpoint, which decides the role server-side from rules
 * the client cannot influence. See `teacher.schema.ts` for those rules.
 *
 * ## Why the choice is presented as consequences, not labels
 *
 * "Student / Teacher" is two words and tells someone nothing about what they
 * are about to lose. A teacher account has no practice history and no progress;
 * a student account cannot set homework. Saying so on the card is what stops
 * the choice being made carelessly and then needing support to undo — because
 * it cannot be undone from the product.
 */
export function AccountTypeChooser({ onChooseStudent }: { onChooseStudent: () => void }) {
  const [choice, setChoice] = useState<"none" | "teacher">("none");

  if (choice === "teacher") {
    return <TeacherSetup onBack={() => setChoice("none")} />;
  }

  return (
    <div>
      <p className="text-brand-700 text-sm font-semibold">Welcome to Samjho</p>
      <h1 className="text-text text-title mt-1">How will you use Samjho?</h1>
      <p className="text-text-soft mt-2 text-sm leading-relaxed">
        This sets up your account. It cannot be changed later, so pick the one that matches what you
        are here to do.
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        <ChoiceCard
          title="I am preparing for my boards"
          blurb="Practise by chapter, see why you got something wrong, and rehearse the full paper before you sit it."
          note="You will be asked for your class, subjects and a parent's email."
          cta="Set up as a student"
          onClick={onChooseStudent}
        />
        <ChoiceCard
          title="I teach"
          blurb="Make a classroom, set practice, upload your own papers and let Samjho pull the questions out of them."
          note="A teaching account has no practice history or progress of its own."
          cta="Set up as a teacher"
          onClick={() => setChoice("teacher")}
        />
      </div>
    </div>
  );
}

function ChoiceCard({
  title,
  blurb,
  note,
  cta,
  onClick,
}: {
  title: string;
  blurb: string;
  note: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card className="flex flex-col">
      <h2 className="text-text text-subheading">{title}</h2>
      <p className="text-text-soft mt-2 flex-1 text-sm leading-relaxed">{blurb}</p>
      <p className="text-text-faint mt-3 text-xs leading-relaxed">{note}</p>
      <Button className="mt-5" variant="secondary" fullWidth onClick={onClick}>
        {cta}
      </Button>
    </Card>
  );
}

/**
 * The teacher's whole setup, on one screen.
 *
 * Four fields where the student wizard has four steps, because there are four
 * fields' worth of things to ask and a progress bar over one screen is theatre.
 * Both optional fields are genuinely optional: a teacher who wants to get to
 * their first classroom can tick the box and go.
 */
function TeacherSetup({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<TeacherOnboardingFormValues>({
    school: "",
    subjectsTaught: "",
    termsAccepted: false as true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(): Promise<void> {
    // The same schema the API validates with, so a rule can never be tightened
    // on one side only.
    const parsed = teacherOnboardingInputSchema.safeParse({
      school: draft.school?.trim() ? draft.school : undefined,
      subjectsTaught: draft.subjectsTaught?.trim() ? draft.subjectsTaught : undefined,
      termsAccepted: draft.termsAccepted,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the details above.");
      return;
    }

    setBusy(true);
    setError(null);

    const result = await sendJson(
      "POST",
      "/api/v1/me/teacher-onboarding",
      parsed.data,
      meResponseSchema,
    );

    if (!result.ok) {
      setBusy(false);
      setError(result.failure.message);
      return;
    }

    // `refresh()` before `push()`: the app shell reads `/me` to decide whether
    // this account is onboarded, and pushing first would race the shell against
    // a cached answer that still says no — which lands the teacher back here.
    router.refresh();
    router.push("/teacher");
  }

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className="text-text-soft hover:text-text inline-flex min-h-11 items-center text-sm font-medium transition-colors"
      >
        ← Not a teacher?
      </button>

      <h1 className="text-text text-title mt-2">Set up your teaching account</h1>
      <p className="text-text-soft mt-2 text-sm leading-relaxed">
        Two optional details and one box to tick. You can change the details later from your
        profile.
      </p>

      <form
        className="mt-7 grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teacher-school">
            School <span className="text-text-faint font-normal">(optional)</span>
          </Label>
          <input
            id="teacher-school"
            value={draft.school ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, school: event.target.value }))
            }
            placeholder="e.g. Delhi Public School, Bengaluru"
            className={inputClass}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="teacher-subjects">
            What do you teach? <span className="text-text-faint font-normal">(optional)</span>
          </Label>
          <input
            id="teacher-subjects"
            value={draft.subjectsTaught ?? ""}
            onChange={(event) =>
              setDraft((current) => ({ ...current, subjectsTaught: event.target.value }))
            }
            placeholder="e.g. Class 10 Science and Maths"
            className={inputClass}
          />
          <p className="text-text-faint text-xs leading-relaxed">
            Shown to students on your classroom card. The subjects you actually set work for come
            from your classrooms.
          </p>
        </div>

        <CheckCard selected={draft.termsAccepted === true}>
          <input
            type="checkbox"
            checked={draft.termsAccepted === true}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                termsAccepted: event.target.checked as true,
              }))
            }
            className="accent-brand-500 mt-0.5 size-5 shrink-0"
          />
          <span className="text-text-soft text-sm leading-relaxed">
            I accept the terms of use and privacy policy, and I confirm I am a teacher setting up an
            account for my own classes.
          </span>
        </CheckCard>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Setting up…" : "Start teaching"}
          </Button>
          <p className="text-text-faint text-xs">
            A teaching account has no practice history of its own.
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-marker-700 text-sm">
            {error}
          </p>
        ) : null}
      </form>
    </div>
  );
}
