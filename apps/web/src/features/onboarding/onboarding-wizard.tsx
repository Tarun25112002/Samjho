"use client";

import { CURRENT_TERMS_VERSION, type SubjectSummary } from "@samjho/contracts";
import { useMemo } from "react";

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
 * Styling is intentionally restrained. `packages/ui` and the real design system
 * arrive in Phase 3; anything elaborate written here would be rewritten then.
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
      className="flex flex-col gap-8"
      onSubmit={(event) => {
        event.preventDefault();
        if (wizard.isLastStep) {
          void wizard.submit();
        } else {
          wizard.next();
        }
      }}
    >
      <ol className="flex flex-wrap gap-2" aria-label="Progress">
        {ONBOARDING_STEPS.map((item, index) => (
          <li
            key={item.id}
            aria-current={index === wizard.stepIndex ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              index === wizard.stepIndex
                ? "bg-brand-600 text-white"
                : index < wizard.stepIndex
                  ? "bg-ink-100 text-ink-700 dark:bg-ink-700 dark:text-ink-100"
                  : "text-ink-500 border-ink-100 dark:border-ink-700 border"
            }`}
          >
            {/* The number is spelled out for screen readers; sighted users get
                position from the visual state. */}
            <span className="sr-only">Step {index + 1}: </span>
            {item.title}
          </li>
        ))}
      </ol>

      <header className="space-y-1">
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {stepMeta?.title}
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-sm">{stepMeta?.blurb}</p>
      </header>

      <div className="min-h-64">
        {wizard.step === "class" ? <ClassStep wizard={wizard} /> : null}
        {wizard.step === "subjects" ? (
          <SubjectsStep wizard={wizard} subjectsByClass={subjectsByClass} />
        ) : null}
        {wizard.step === "target" ? <TargetStep wizard={wizard} /> : null}
        {wizard.step === "guardian" ? <GuardianStep wizard={wizard} /> : null}
      </div>

      {wizard.formError ? (
        <p role="alert" className="text-danger text-sm">
          {wizard.formError}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        {wizard.stepIndex > 0 ? (
          <button
            type="button"
            onClick={wizard.back}
            className="border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-100 rounded-lg border px-4 py-2 text-sm font-medium"
          >
            Back
          </button>
        ) : null}

        <button
          type="submit"
          disabled={wizard.submitting}
          className="bg-brand-600 hover:bg-brand-500 rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60"
        >
          {wizard.isLastStep ? (wizard.submitting ? "Setting up…" : "Finish setup") : "Continue"}
        </button>
      </div>
    </form>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────────

function ClassStep({ wizard }: { wizard: Wizard }) {
  return (
    <fieldset className="space-y-6">
      <div className="space-y-2">
        <legend className="text-ink-700 dark:text-ink-100 text-sm font-medium">Class</legend>
        <div className="flex gap-3">
          {([10, 12] as const).map((level) => (
            <label
              key={level}
              className={`flex-1 cursor-pointer rounded-xl border p-4 text-center ${
                wizard.draft.classLevel === level
                  ? "border-brand-600 bg-brand-600/5"
                  : "border-ink-100 dark:border-ink-700"
              }`}
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
              <span className="text-ink-900 dark:text-ink-50 font-medium">Class {level}</span>
            </label>
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
        <label
          htmlFor="preferredLanguage"
          className="text-ink-700 dark:text-ink-100 block text-sm font-medium"
        >
          Preferred language
        </label>
        <select
          id="preferredLanguage"
          value={wizard.draft.preferredLanguage}
          onChange={(event) => {
            wizard.update({
              preferredLanguage: event.target.value === "HINDI" ? "HINDI" : "ENGLISH",
            });
          }}
          className="border-ink-300 dark:border-ink-700 w-full rounded-lg border bg-transparent px-3 py-2 text-sm"
        >
          <option value="ENGLISH">English</option>
          <option value="HINDI">Hindi</option>
        </select>
        {/* Honest about scope: the column exists, the content does not yet. */}
        <p className="text-ink-500 dark:text-ink-300 text-xs">
          Question content is English-only for now. Choosing Hindi records your preference for when
          bilingual content lands.
        </p>
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
      <p className="text-ink-500 dark:text-ink-300 text-sm text-pretty">
        No subjects are available for Class {wizard.draft.classLevel} yet. Samjho currently covers
        Class 10 Mathematics and Science — go back and choose Class 10, or check again once more
        subjects are added.
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
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  selected
                    ? "border-brand-600 bg-brand-600/5"
                    : "border-ink-100 dark:border-ink-700"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    wizard.toggleSubject(subject.id);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="text-ink-900 dark:text-ink-50 block font-medium">
                    {subject.name}
                    {subject.variant ? ` (${subject.variant})` : ""}
                  </span>
                  <span className="text-ink-500 dark:text-ink-300 block text-sm">
                    Theory paper · {subject.theoryMarks} marks
                  </span>
                </span>
              </label>
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
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                  selected
                    ? "border-brand-600 bg-brand-600/5"
                    : "border-ink-100 dark:border-ink-700"
                }`}
              >
                <input
                  type="radio"
                  name="targetExam"
                  checked={selected}
                  onChange={() => {
                    wizard.update({
                      targetExam: { session: option.session, phase: option.phase },
                    });
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="text-ink-900 dark:text-ink-50 block font-medium">
                    {option.label}
                  </span>
                  <span className="text-ink-500 dark:text-ink-300 block text-sm">
                    {option.hint}
                  </span>
                </span>
              </label>
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

      <div className="border-ink-100 dark:border-ink-700 space-y-4 rounded-xl border p-4">
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
            className="mt-1"
          />
          <span className="text-ink-700 dark:text-ink-100 text-pretty">
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
            className="mt-1"
          />
          <span className="text-ink-700 dark:text-ink-100 text-pretty">
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
      <p className="text-ink-500 dark:text-ink-300 text-xs text-pretty">
        Samjho is in a closed pilot. We record that you have declared a guardian permits this
        account; we do not yet ask your guardian to confirm it directly. Samjho contains no
        advertising and no behavioural-tracking scripts.
      </p>
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
      <label htmlFor={name} className="text-ink-700 dark:text-ink-100 block text-sm font-medium">
        {label}
      </label>
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
        className={`w-full rounded-lg border bg-transparent px-3 py-2 text-sm ${
          hasError ? "border-danger" : "border-ink-300 dark:border-ink-700"
        }`}
      />
      {hint ? (
        <p id={hintId} className="text-ink-500 dark:text-ink-300 text-xs text-pretty">
          {hint}
        </p>
      ) : null}
      <FieldError errors={errors} name={name} id={errorId} />
    </div>
  );
}

function FieldError({ errors, name, id }: { errors: FieldErrors; name: string; id?: string }) {
  const message = errors[name];
  if (message === undefined) return null;

  return (
    <p id={id ?? `${name}-error`} role="alert" className="text-danger text-sm">
      {message}
    </p>
  );
}
