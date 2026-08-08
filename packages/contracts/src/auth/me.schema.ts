import { z } from "zod";

import { subjectSummarySchema } from "../catalog/subject.schema.js";
import { boardSchema, classLevelSchema } from "../question/question-enums.js";
import { examPhaseSchema, languageSchema, roleSchema, userStatusSchema } from "./auth-enums.js";

/**
 * `GET /api/v1/me` — the one call the web app makes to learn who it is talking
 * to and where to send them.
 *
 * Deliberately a single endpoint rather than several. Every guarded page needs
 * identity, role and onboarding state at once; splitting them across three
 * endpoints would put three sequential round trips in front of the first paint
 * of every page in the app.
 *
 * Note what is *not* here: no Clerk id, no session id, no token. The web app has
 * those already from Clerk, and echoing an identity-provider id back through our
 * own API invites someone to start treating it as an authorization input.
 */

export const sessionUserSchema = z.object({
  /** Our own `User.id`. Every foreign key in the domain points at this. */
  id: z.string().min(1),
  email: z.email(),
  name: z.string().nullable(),
  imageUrl: z.url().nullable(),
  role: roleSchema,
  status: userStatusSchema,
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

export const targetExamSchema = z.object({
  /** Board session year, e.g. "2027". */
  session: z.string().regex(/^\d{4}$/),
  phase: examPhaseSchema,
  examDate: z.iso.datetime().nullable(),
});

export type TargetExam = z.infer<typeof targetExamSchema>;

export const studentProfileSchema = z.object({
  classLevel: classLevelSchema,
  board: boardSchema,
  school: z.string().nullable(),
  preferredLanguage: languageSchema,

  /**
   * Null until onboarding completes. A timestamp rather than a boolean because
   * "when did they finish" answers more questions later than "did they".
   */
  onboardedAt: z.iso.datetime().nullable(),

  /**
   * DPDP Act 2023 fields. Every Class 10 user is a minor, so these are the norm
   * rather than an edge case. The consent token is never exposed — only whether
   * consent has been recorded, and against which address.
   *
   * `guardianDeclaredAt` and `parentConsentAt` are separate on purpose:
   * the first is the student asserting a guardian permits the account, the
   * second is the guardian themselves verifiably acting. During the closed
   * pilot the second is always null, and the profile page says so plainly
   * rather than showing a green tick nobody earned.
   */
  parentEmail: z.email().nullable(),
  guardianDeclaredAt: z.iso.datetime().nullable(),
  parentConsentAt: z.iso.datetime().nullable(),
  termsAcceptedAt: z.iso.datetime().nullable(),
  termsAcceptedVersion: z.string().nullable(),

  targetExam: targetExamSchema.nullable(),
  subjects: z.array(subjectSummarySchema),
});

export type StudentProfile = z.infer<typeof studentProfileSchema>;

export const meResponseSchema = z.object({
  user: sessionUserSchema,

  /** Null for an admin, or for a student who has not started onboarding. */
  profile: studentProfileSchema.nullable(),

  /**
   * Derived server-side from `profile.onboardedAt`, not left to each caller.
   *
   * Route guards, the onboarding wizard and the app shell all need this answer,
   * and three independent re-derivations of "are they onboarded" is three chances
   * to disagree — which shows up as a redirect loop between `/welcome` and
   * `/home`.
   */
  onboarded: z.boolean(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
