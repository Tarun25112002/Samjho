import { z } from "zod";

/**
 * What the teacher dashboard shows.
 *
 * Four counts, the work that is overdue, and the next few things due. Every
 * field answers "what should I do next" — the only question a teacher opens a
 * dashboard with between two lessons.
 *
 * What is deliberately absent is a feed of student activity. The attempt rows
 * exist and it would be easy to surface them; it would also change what this
 * product is. A teacher sees whether a student finished and how the class did
 * in aggregate. The answers themselves stay the student's, which is the same
 * line `classroom.schema.ts` draws and for the same reason.
 */

export const teacherDashboardSchema = z.object({
  classrooms: z.object({
    total: z.int().nonnegative(),
    students: z.int().nonnegative(),
  }),
  assignments: z.object({
    total: z.int().nonnegative(),
    /** Due in the future, or with no due date at all. */
    active: z.int().nonnegative(),
    /** Past due, with students who have not finished. The actual to-do. */
    overdueWithStragglers: z.int().nonnegative(),
  }),
  bank: z.object({
    total: z.int().nonnegative(),
    published: z.int().nonnegative(),
    draft: z.int().nonnegative(),
    bySubject: z.array(
      z.object({
        subjectId: z.string(),
        subjectName: z.string(),
        count: z.int().nonnegative(),
      }),
    ),
  }),
  uploads: z.object({
    total: z.int().nonnegative(),
    /** Being read right now. The dashboard shows these as in progress. */
    extracting: z.int().nonnegative(),
    /** Read, and waiting for the teacher to review them. */
    awaitingReview: z.int().nonnegative(),
  }),
  upcoming: z.array(
    z.object({
      assignmentId: z.string(),
      title: z.string(),
      classroomName: z.string(),
      dueAt: z.iso.datetime().nullable(),
      questionCount: z.int().positive(),
      studentCount: z.int().nonnegative(),
      completedCount: z.int().nonnegative(),
    }),
  ),
});

export type TeacherDashboard = z.infer<typeof teacherDashboardSchema>;
