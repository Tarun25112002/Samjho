import { z } from "zod";

import { CURRENT_TERMS_VERSION } from "./onboarding.schema.js";

/**
 * Becoming a teacher, and the profile that results.
 *
 * ## Why this is a separate act rather than a field on signup
 *
 * `User.role` is the platform's authorization input, and the comment on that
 * column is emphatic about why it lives in our database rather than in Clerk
 * metadata: an authorization decision must be made from data whose write path we
 * own. Letting a sign-up form post `role: "TEACHER"` into the same body as a
 * school name would hand that write path to whoever is holding the form.
 *
 * So the elevation is its own endpoint with its own rules (see the service):
 * it applies only to an account that has not started life as a student, it is
 * one-directional, and the request body cannot name a role at all. What the
 * teacher submits is a description of themselves; the role is the server's
 * conclusion from the fact that they submitted it.
 *
 * ## What a teacher account can and cannot see
 *
 * Worth stating plainly, because "anyone may declare themselves a teacher" is
 * the obvious objection and it deserves an answer rather than a shrug.
 *
 * A teacher sees solutions and marking schemes — for the questions in their own
 * classrooms' subjects and for papers they uploaded themselves. That is the
 * whole job; a teacher who cannot see an answer key cannot set homework.
 *
 * A teacher does **not** see another student's answers, another teacher's
 * classrooms, or the shared question bank's editing tools. And the account is
 * exclusive: a teacher account has no practice history, no progress and no exam
 * attempts, so a student who declares themselves a teacher to read answer keys
 * has given up the product they signed up for and gained a view of a bank they
 * could have practised against anyway. `verifiedAt` on the profile is where
 * school verification lands when the B2B path opens (docs/00 §7); nothing is
 * gated on it yet, and this comment is the honest statement of that.
 */

const schoolSchema = z.string().trim().min(2).max(120);

export const teacherOnboardingInputSchema = z.object({
  school: schoolSchema.optional(),
  /**
   * "Class 10 Science and Maths". A sentence, not a subject picker: the subjects
   * a teacher actually works with are the ones their classrooms are for, and
   * asking twice would let the two disagree on the very first screen.
   */
  subjectsTaught: z.string().trim().max(120).optional(),
  /**
   * `z.literal(true)`, exactly as in student onboarding. An unticked box has to
   * be a validation failure with a field path — a silently stored `false` is
   * what "we have their acceptance" turns into when nobody checks.
   */
  termsAccepted: z.literal(true, {
    error: "the terms and privacy policy must be accepted",
  }),
});

export type TeacherOnboardingInput = z.infer<typeof teacherOnboardingInputSchema>;
export type TeacherOnboardingFormValues = z.input<typeof teacherOnboardingInputSchema>;

export const teacherProfileSchema = z.object({
  school: z.string().nullable(),
  subjectsTaught: z.string().nullable(),
  /** Null until setup completes. Route guards key off this, as for students. */
  onboardedAt: z.iso.datetime().nullable(),
  /**
   * Null for every teacher today. Exposed rather than hidden so the profile page
   * can say "not verified" plainly instead of showing a tick nobody earned.
   */
  verifiedAt: z.iso.datetime().nullable(),
  termsAcceptedAt: z.iso.datetime().nullable(),
  termsAcceptedVersion: z.string().nullable(),
});

export type TeacherProfile = z.infer<typeof teacherProfileSchema>;

/** Re-exported so a teacher form records the same version a student's does. */
export { CURRENT_TERMS_VERSION };

export const teacherProfileUpdateInputSchema = z
  .object({
    school: schoolSchema.nullable().optional(),
    subjectsTaught: z.string().trim().max(120).nullable().optional(),
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

export type TeacherProfileUpdateInput = z.infer<typeof teacherProfileUpdateInputSchema>;
