"use client";

import { CURRENT_TERMS_VERSION, type SubjectSummary } from "@samjho/contracts";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import {
  ChoiceCard,
  FieldError as FieldErrorText,
  Hint,
  inputClass,
  invalidInputClass,
  Label,
} from "@/components/ui/form";

import { suggestBoardSessions } from "./board-sessions";
import {
  ONBOARDING_STEPS,
  useOnboardingWizard,
  type FieldErrors,
  type OnboardingWizard as Wizard,
} from "./use-onboarding-wizard";

/**
 * The onboarding wizard's presentation layer.
 *
 * Every decision this file makes is a rendering decision. What counts as valid,
 * what the request looks like, where the student goes afterwards — all of that
 * is in `use-onboarding-wizard.ts`. The split is what makes the rules testable
 * without a DOM, and it is why this file has no `if` statement about anything
 * other than which step to draw.
 *
 * The four screens are the first thing a new student sees and the last barrier
 * between signing up and practising, so they are deliberately plain: one
 * decision per screen, a rail that shows how many are left, and no step that
 * cannot be answered in a few seconds by someone who has just typed in an email
 * address.
 */

export interface OnboardingWizardProps {
  /** Subject options per class level, fetched server-side by the page. */
  subjectsByClass: Record<string, SubjectSummary[]>;
}

export function OnboardingWizard({ subjectsByClass }: OnboardingWizardProps) {
  const wizard = useOnboardingWizard();
  const stepMeta = ONBOARDING_STEPS[wizard.stepIndex];

  return (
    <form
      className="rounded-panel border-line bg-card flex flex-col gap-7 border p-5 shadow-lift sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (wizard.isLastStep) {
          void wizard.submit();
        } else {
          wizard.next();
        }
      }}
    >
      {/*
        A rail rather than a row of pills. Four steps on a 360px screen wrap to
        two lines as pills and stop reading as a sequence at all; as segments
        they stay one line, and the filled part of the rail is the progress.
      */}
      <ol className="flex gap-1.5" aria-label="Progress">
        {ONBOARDING_STEPS.map((item, index) => (
          <li
            key={item.id}
            aria-current={index === wizard.stepIndex ? "step" : undefined}
            className="flex-1"
          >
            <span className="sr-only">
              Step {index + 1}, {item.title}
              {index === wizard.stepIndex
                ? " (current)"
                : index < wizard.stepIndex
                  ? " (done)"
                  : ""}
            </span>
            <span
              aria-hidden="true"
              className={[
                "block h-1.5 rounded-full transition-colors",
                index <= wizard.stepIndex ? "bg-brand-500" : "bg-line",
              ].join(" ")}
            />
          </li>
        ))}
      </ol>

      <header>
        <p className="text-text-faint text-sm font-medium">
          Step {wizard.stepIndex + 1} of {ONBOARDING_STEPS.length}
        </p>
        <h1 className="text-text mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-3xl">
          {stepMeta?.title}
        </h1>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">{stepMeta?.blurb}</p>
      </header>

      <div>
        {wizard.step === "class" ? <ClassStep wizard={wizard} /> : null}
        {wizard.step === "subjects" ? (
          <SubjectsStep wizard={wizard} subjectsByClass={subjectsByClass} />
        ) : null}
        {wizard.step === "target" ? <TargetStep wizard={wizard} /> : null}
        {wizard.step === "guardian" ? <GuardianStep wizard={wizard} /> : null}
      </div>

      {wizard.formError ? (
        <p
          role="alert"
          className="rounded-control border-marker-200 bg-marker-50 text-marker-700 border px-4 py-3 text-sm"
        >
          {wizard.formError}
        </p>
      ) : null}

      <div className="border-line flex items-center gap-3 border-t pt-5">
        {wizard.stepIndex > 0 ? (
          <Button type="button" variant="secondary" onClick={wizard.back}>
            Back
          </Button>
        ) : null}

        <Button type="submit" disabled={wizard.submitting} className="ml-auto">
          {wizard.isLastStep ? (wizard.submitting ? "Setting up…" : "Finish setup") : "Continue"}
        </Button>
      </div>
    </form>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function ClassStep({ wizard }: { wizard: Wizard }) {
  return (
    <fieldset className="space-y-6">
      <div className="space-y-2">
        <legend className="text-text text-sm font-semibold">Class</legend>
        <div className="flex gap-3">
          {([10, 12] as const).map((level) => (
            <ChoiceCard
              key={level}
              selected={wizard.draft.classLevel === level}
              className="flex-1 justify-center"
            >
              <input
                type="radio"
                name="classLevel"
                className="sr-only"
                checked={wizard.draft.classLevel === level}
                onChange={() => {
                  // Subjects belong to a class, so changing class must not carry
                  // the old selection forward — the API would reject it, and the
                  // student would see an error about a chip they cannot see.
                  wizard.update({ classLevel: level, subjectIds: [] });
                }}
              />
              <span className="text-text text-lg font-semibold">Class {level}</span>
            </ChoiceCard>
          ))}
        </div>
        <FieldError errors={wizard.errors} name="classLevel" />
      </div>

      <TextField
        label="School (optional)"
        name="school"
        value={wizard.draft.school}
        errors={wizard.errors}
        onChange={(school) => {
          wizard.update({ school });
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="preferredLanguage">Preferred language</Label>
        <select
          id="preferredLanguage"
          value={wizard.draft.preferredLanguage}
          onChange={(event) => {
            wizard.update({
              preferredLanguage: event.target.value === "HINDI" ? "HINDI" : "ENGLISH",
            });
          }}
          className={inputClass}
        >
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi</option>
        </select>
        {/* Honest about scope: the column exists, the content does not yet. */}
        <Hint>
          Question content is English-only for now. Choosing Hindi records your preference for when
          bilingual content lands.
        </Hint>
      </div>
    </fieldset>
  );
}

function SubjectsStep({
  wizard,
  subjectsByClass,
}: {
  wizard: Wizard;
  subjectsByClass: Record<string, SubjectSummary[]>;
}) {
  const options = subjectsByClass[String(wizard.draft.classLevel)] ?? [];

  if (options.length === 0) {
    return (
      <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm leading-relaxed">
        No subjects are available for Class {wizard.draft.classLevel} yet. Samjho currently covers
        Class 10 Mathematics and Science. Go back to choose Class 10.
      </p>
    );
  }

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Subjects</legend>
      <ul className="grid gap-3 sm:grid-cols-2">
        {options.map((subject) => {
          const selected = wizard.draft.subjectIds.includes(subject.id);
          return (
            <li key={subject.id}>
              <ChoiceCard selected={selected}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    wizard.toggleSubject(subject.id);
                  }}
                  className="accent-brand-500 mt-1 size-4"
                />
                <span>
                  <span className="text-text block font-semibold">{subject.name}</span>
                  <span className="text-text-soft block text-sm">
                    Theory paper · {subject.theoryMarks} marks
                  </span>
                </span>
              </ChoiceCard>
            </li>
          );
        })}
      </ul>
      <FieldError errors={wizard.errors} name="subjectIds" />
    </fieldset>
  );
}

function TargetStep({ wizard }: { wizard: Wizard }) {
  // Computed once per mount. Recomputing on every render would be harmless but
  // pointless — the answer cannot change while the wizard is open.
  const options = useMemo(() => suggestBoardSessions(new Date()), []);

  return (
    <fieldset className="space-y-3">
      <legend className="sr-only">Target sitting</legend>

      <ul className="space-y-3">
        {options.map((option) => {
          const selected =
            wizard.draft.targetExam.session === option.session &&
            wizard.draft.targetExam.phase === option.phase;

          return (
            <li key={`${option.session}-${option.phase}`}>
              <ChoiceCard selected={selected}>
                <input
                  type="radio"
                  name="targetExam"
                  checked={selected}
                  onChange={() => {
                    wizard.update({
                      targetExam: { session: option.session, phase: option.phase },
                    });
                  }}
                  className="accent-brand-500 mt-1 size-4"
                />
                <span>
                  <span className="text-text block font-semibold">{option.label}</span>
                  <span className="text-text-soft block text-sm">{option.hint}</span>
                </span>
              </ChoiceCard>
            </li>
          );
        })}
      </ul>

      <FieldError errors={wizard.errors} name="targetExam.session" />
      <FieldError errors={wizard.errors} name="targetExam" />
    </fieldset>
  );
}

function GuardianStep({ wizard }: { wizard: Wizard }) {
  return (
    <fieldset className="space-y-5">
      <legend className="sr-only">Parent or guardian</legend>

      <TextField
        label="Parent or guardian's email"
        name="parentEmail"
        type="email"
        value={wizard.draft.parentEmail}
        errors={wizard.errors}
        onChange={(parentEmail) => {
          wizard.update({ parentEmail });
        }}
        hint="Use an adult's address, not your own. We use it to reach a guardian about this account."
      />

      <div className="border-line bg-card rounded-panel space-y-4 border p-5">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={wizard.draft.consent.parentalConsentAcknowledged}
            onChange={(event) => {
              wizard.update({
                consent: {
                  ...wizard.draft.consent,
                  parentalConsentAcknowledged: event.target.checked,
                },
              });
            }}
            className="accent-brand-500 mt-0.5 size-4"
          />
          <span className="text-text leading-relaxed">
            A parent or guardian knows about this account and permits me to use Samjho.
          </span>
        </label>
        <FieldError errors={wizard.errors} name="consent.parentalConsentAcknowledged" />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={wizard.draft.consent.termsAccepted}
            onChange={(event) => {
              wizard.update({
                consent: { ...wizard.draft.consent, termsAccepted: event.target.checked },
              });
            }}
            className="accent-brand-500 mt-0.5 size-4"
          />
          <span className="text-text leading-relaxed">
            I accept the terms of use and privacy policy (version {CURRENT_TERMS_VERSION}).
          </span>
        </label>
        <FieldError errors={wizard.errors} name="consent.termsAccepted" />
      </div>

      {/*
        Said plainly rather than hidden in a policy document. Under the DPDP Act
        a student's tick is an assertion, not verified parental consent, and the
        product should not imply otherwise to the person making it.
      */}
      <Hint>
        Samjho is in a closed pilot. We record your declaration that a guardian permits you to use
        this account; we do not yet ask your guardian to confirm it directly. Samjho contains no
        advertising or behavioural-tracking scripts.
      </Hint>
    </fieldset>
  );
}

// ── Small shared field pieces ────────────────────────────────────────────────

function TextField({
  label,
  name,
  value,
  errors,
  onChange,
  type = "text",
  hint,
}: {
  label: string;
  name: string;
  value: string;
  errors: FieldErrors;
  onChange: (value: string) => void;
  type?: string;
  hint?: string;
}) {
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const hasError = Boolean(errors[name]);

  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        aria-invalid={hasError}
        // Wiring the description and the error to the input is what makes a
        // screen reader announce them; a red border alone announces nothing.
        aria-describedby={[hint ? hintId : null, hasError ? errorId : null]
          .filter(Boolean)
          .join(" ")
          .trim()}
        className={hasError ? invalidInputClass : inputClass}
      />
      {hint ? <Hint id={hintId}>{hint}</Hint> : null}
      <FieldError errors={errors} name={name} id={errorId} />
    </div>
  );
}

function FieldError({ errors, name, id }: { errors: FieldErrors; name: string; id?: string }) {
  return <FieldErrorText id={id ?? `${name}-error`} message={errors[name]} />;
}
