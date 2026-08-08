"use client";

import {
  meResponseSchema,
  onboardingInputSchema,
  type ExamPhase,
  type Language,
} from "@samjho/contracts";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { sendJson } from "@/lib/client-api";

/**
 * The wizard's brain.
 *
 * All of it — draft state, per-step validation, the request — lives here rather
 * than in the component, so the component's job is reduced to rendering fields
 * and calling these functions. That is the "no business logic in UI components"
 * rule from the brief, applied where it actually pays: this is the file you
 * would read to answer "what does onboarding require?", and it contains no JSX
 * to read past.
 *
 * The validation is not a re-implementation of the server's. It is *literally*
 * the server's schema, sliced per step with `.pick()`. A rule tightened in
 * `packages/contracts` tightens here in the same commit, and there is no way for
 * the two to disagree — which is the failure mode where a form accepts input the
 * API then rejects, five steps later, with no field to point at.
 */

export const ONBOARDING_STEPS = [
  { id: "class", title: "Your class", blurb: "Which board exam are you preparing for?" },
  { id: "subjects", title: "Your subjects", blurb: "Pick the papers you will sit." },
  { id: "target", title: "Your target sitting", blurb: "When do you sit the boards?" },
  { id: "guardian", title: "Parent or guardian", blurb: "Required before you can start." },
] as const;

export type StepId = (typeof ONBOARDING_STEPS)[number]["id"];

/** Which fields each step owns, and therefore which the step validates. */
const STEP_FIELDS = {
  class: { classLevel: true, school: true, preferredLanguage: true },
  subjects: { subjectIds: true },
  target: { targetExam: true },
  guardian: { parentEmail: true, consent: true },
} as const satisfies Record<StepId, Partial<Record<keyof OnboardingDraftShape, true>>>;

interface OnboardingDraftShape {
  classLevel: 10 | 12;
  school: string;
  preferredLanguage: Language;
  subjectIds: string[];
  targetExam: { session: string; phase: ExamPhase };
  parentEmail: string;
  consent: { parentalConsentAcknowledged: boolean; termsAccepted: boolean };
}

export interface OnboardingDraft extends Omit<OnboardingDraftShape, "classLevel"> {
  /** Null until chosen — an unmade choice is not the same as choosing 10. */
  classLevel: 10 | 12 | null;
}

export const INITIAL_DRAFT: OnboardingDraft = {
  classLevel: null,
  school: "",
  preferredLanguage: "ENGLISH",
  subjectIds: [],
  targetExam: { session: "", phase: "PHASE_1" },
  parentEmail: "",
  consent: { parentalConsentAcknowledged: false, termsAccepted: false },
};

/**
 * Draft → request body.
 *
 * `school` is dropped when blank rather than sent as `""`, because the contract
 * marks it optional with a two-character minimum: an empty string is a
 * validation error, while an absent key is "they did not say".
 */
function toRequestBody(draft: OnboardingDraft): Record<string, unknown> {
  const school = draft.school.trim();

  return {
    classLevel: draft.classLevel,
    board: "CBSE",
    preferredLanguage: draft.preferredLanguage,
    subjectIds: draft.subjectIds,
    targetExam: draft.targetExam,
    parentEmail: draft.parentEmail.trim(),
    consent: draft.consent,
    ...(school.length > 0 ? { school } : {}),
  };
}

export type FieldErrors = Record<string, string>;

function collectErrors(step: StepId, draft: OnboardingDraft): FieldErrors {
  const schema = onboardingInputSchema.pick(STEP_FIELDS[step]);
  const result = schema.safeParse(toRequestBody(draft));

  if (result.success) return {};

  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.map(String).join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

export interface OnboardingWizard {
  step: StepId;
  stepIndex: number;
  draft: OnboardingDraft;
  errors: FieldErrors;
  formError: string | null;
  submitting: boolean;
  isLastStep: boolean;
  update: (patch: Partial<OnboardingDraft>) => void;
  toggleSubject: (subjectId: string) => void;
  next: () => void;
  back: () => void;
  submit: () => Promise<void>;
}

export function useOnboardingWizard(): OnboardingWizard {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [draft, setDraft] = useState<OnboardingDraft>(INITIAL_DRAFT);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const step = ONBOARDING_STEPS[stepIndex]?.id ?? "class";
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    // Errors clear on edit rather than on the next submit. Leaving a red field
    // marked wrong while the student is fixing it is needlessly discouraging.
    setErrors({});
    setFormError(null);
  }, []);

  const toggleSubject = useCallback((subjectId: string) => {
    setDraft((current) => ({
      ...current,
      subjectIds: current.subjectIds.includes(subjectId)
        ? current.subjectIds.filter((id) => id !== subjectId)
        : [...current.subjectIds, subjectId],
    }));
    setErrors({});
  }, []);

  const next = useCallback(() => {
    const stepErrors = collectErrors(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStepIndex((index) => Math.min(index + 1, ONBOARDING_STEPS.length - 1));
  }, [draft, step]);

  const back = useCallback(() => {
    setErrors({});
    setFormError(null);
    setStepIndex((index) => Math.max(index - 1, 0));
  }, []);

  const submit = useCallback(async () => {
    const stepErrors = collectErrors(step, draft);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }

    setSubmitting(true);
    setFormError(null);

    const result = await sendJson(
      "POST",
      "/api/v1/me/onboarding",
      toRequestBody(draft),
      meResponseSchema,
    );

    if (!result.ok) {
      setErrors(result.failure.fieldErrors);
      setFormError(result.failure.message);
      setSubmitting(false);
      return;
    }

    // `refresh()` before `push()`: the app layout decides whether to bounce back
    // to /welcome from a server-rendered `/me`, and without invalidating that
    // cache the student can land on /home only to be sent straight back.
    router.refresh();
    router.push("/home");
  }, [draft, router, step]);

  return useMemo(
    () => ({
      step,
      stepIndex,
      draft,
      errors,
      formError,
      submitting,
      isLastStep,
      update,
      toggleSubject,
      next,
      back,
      submit,
    }),
    [
      step,
      stepIndex,
      draft,
      errors,
      formError,
      submitting,
      isLastStep,
      update,
      toggleSubject,
      next,
      back,
      submit,
    ],
  );
}
