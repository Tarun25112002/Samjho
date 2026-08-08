import { z } from "zod";

/**
 * Identity and profile taxonomy shared by the API and the web app.
 *
 * Same reasoning as `question/question-enums.ts`: these cross the network
 * boundary, Prisma generates its own copy from schema.prisma, and the drift
 * between the two is checked by a test rather than assumed.
 */

/**
 * Authorization roles.
 *
 * Worth restating because it is the single most security-relevant decision in
 * this file: **role is stored in our database, never read from Clerk metadata.**
 * Clerk's public metadata is visible to the browser and writable through SDK
 * surfaces we do not fully control. An authorization decision must be made from
 * data whose write path we own end to end.
 *
 * `CONTENT_EDITOR` can draft and edit questions but cannot publish them or touch
 * users — that separation matters once content entry is outsourced (docs/07 R1).
 */
export const roleSchema = z.enum(["STUDENT", "CONTENT_EDITOR", "ADMIN"]);
export type Role = z.infer<typeof roleSchema>;

/**
 * `DELETED` is a state, not a row removal. When a Clerk user is deleted we
 * anonymise the local row and keep attempt history, because deleting it would
 * silently corrupt every aggregate computed from it (docs/06 on retention).
 */
export const userStatusSchema = z.enum(["ACTIVE", "SUSPENDED", "DELETED"]);
export type UserStatus = z.infer<typeof userStatusSchema>;

export const languageSchema = z.enum(["ENGLISH", "HINDI"]);
export type Language = z.infer<typeof languageSchema>;

/**
 * Class 10 sits two board attempts a year — February (mandatory) and May
 * (optional), scored best-of-two. A student's target is a session *and* a phase,
 * which is what the countdown and revision plan key off.
 */
export const examPhaseSchema = z.enum(["PHASE_1", "PHASE_2"]);
export type ExamPhase = z.infer<typeof examPhaseSchema>;

/** Human labels for the two attempts, so the web app doesn't invent its own. */
export const EXAM_PHASE_LABELS = {
  PHASE_1: "February (main)",
  PHASE_2: "May (second attempt)",
} as const satisfies Record<ExamPhase, string>;
