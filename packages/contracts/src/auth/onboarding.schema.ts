import { z } from "zod";

import { boardSchema, classLevelSchema } from "../question/question-enums.js";
import { examPhaseSchema, languageSchema } from "./auth-enums.js";

/**
 * Onboarding and profile editing input.
 *
 * These schemas are the reason `packages/contracts` exists. The same object
 * validates the wizard's form state in the browser *and* the request body in
 * Express. Not "the same rules, written twice" — literally the same schema, so
 * a rule can never be tightened on one side only. A client-side-only rule is a
 * suggestion; a server-side-only rule is a form that fails after five steps.
 */

/**
 * The terms/privacy version a user is agreeing to, recorded alongside their
 * acceptance. Bump this whenever the documents change materially — "they
 * agreed" is worthless without "to what", and re-consent is only possible if
 * you can tell who agreed to the old text.
 */
export const CURRENT_TERMS_VERSION = "2026-08-08";

/** Board session year, e.g. "2027". Not a number: it is an identifier. */
export const boardSessionSchema = z
  .string()
  .regex(/^\d{4}$/, 'must be a four-digit board session year, e.g. "2027"');

export const targetExamInputSchema = z.object({
  session: boardSessionSchema,
  phase: examPhaseSchema,
});

export type TargetExamInput = z.infer<typeof targetExamInputSchema>;

const subjectIdsSchema = z
  .array(z.string().min(1))
  .min(1, "choose at least one subject")
  // No CBSE student sits more than about nine board papers; the cap exists to
  // bound the transaction, not to express a rule about education.
  .max(12, "that is more subjects than any board candidate takes")
  .refine((ids) => new Set(ids).size === ids.length, "the same subject was selected twice");

const schoolSchema = z.string().trim().min(2).max(120);

/**
 * DPDP Act 2023 consent block.
 *
 * `z.literal(true)` rather than `z.boolean()` is the whole point: an unticked
 * box is a validation failure with a field path, not a silently stored `false`
 * that nobody notices until a regulator asks. Consent that can be omitted by
 * sending `{}` is not consent.
 *
 * Posture for the MVP is a **closed pilot**: the parent's address is captured
 * and the acknowledgement recorded at signup, but access is not blocked on the
 * parent acting. That is a deliberate, time-boxed position pending Indian legal
 * advice (docs/07 Q7) — the columns and the flow are already shaped for the
 * heavier parent-owns-the-account model that follows it.
 */
export const consentInputSchema = z.object({
  parentalConsentAcknowledged: z.literal(true, {
    error: "a parent or guardian must confirm they permit this account",
  }),
  termsAccepted: z.literal(true, {
    error: "the terms and privacy policy must be accepted",
  }),
});

export const onboardingInputSchema = z.object({
  classLevel: classLevelSchema,
  board: boardSchema.default("CBSE"),
  school: schoolSchema.optional(),
  preferredLanguage: languageSchema.default("ENGLISH"),

  /**
   * IDs, not codes. The service checks every one of them belongs to the chosen
   * board and class level before writing a single row — an unchecked id here
   * would let a Class 10 account enrol in Class 12 Physics and quietly poison
   * every progress aggregate that follows.
   */
  subjectIds: subjectIdsSchema,

  targetExam: targetExamInputSchema,

  parentEmail: z.email("enter a valid parent or guardian email").max(254),

  consent: consentInputSchema,
});

export type OnboardingInput = z.infer<typeof onboardingInputSchema>;
/** Pre-defaults shape — what a form holds before `.parse()` fills the gaps. */
export type OnboardingFormValues = z.input<typeof onboardingInputSchema>;

/**
 * Profile editing. Every field optional, at least one required.
 *
 * `classLevel` and `board` are absent on purpose. Changing either invalidates
 * every enrolment, every mastery rollup and every practice history row attached
 * to the account, and "quietly recompute a student's entire progress because
 * they tapped the wrong dropdown" is not a feature. If it turns out students do
 * pick the wrong class, that wants an explicit, warned, support-assisted flow —
 * not a PATCH.
 */
export const profileUpdateInputSchema = z
  .object({
    school: schoolSchema.nullable().optional(),
    preferredLanguage: languageSchema.optional(),
    subjectIds: subjectIdsSchema.optional(),
    targetExam: targetExamInputSchema.optional(),
    /** Changing this clears the recorded consent — see the auth service. */
    parentEmail: z.email().max(254).optional(),
  })
  .check((ctx) => {
    if (Object.values(ctx.value).every((value) => value === undefined)) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value,
        path: [],
        message: "provide at least one field to update",
      });
    }
  });

export type ProfileUpdateInput = z.infer<typeof profileUpdateInputSchema>;
