import { z } from "zod";

import { practiceSessionSchema } from "../practice/session.schema.js";

/**
 * Teacher classrooms and assigned practice.
 *
 * An assignment points to a bounded practice set, but it intentionally does
 * not carry answers or individual response text. Teachers need to know who is
 * ready for a follow-up; students still own the details of their work.
 */

const classroomNameSchema = z.string().trim().min(2).max(80);
const assignmentTitleSchema = z.string().trim().min(2).max(100);

export const classroomSubjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  code: z.string().min(1),
});

export const classroomChapterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

export const createClassroomSchema = z.object({
  name: classroomNameSchema,
  subjectId: z.string().min(1).max(60),
});

export type CreateClassroomInput = z.infer<typeof createClassroomSchema>;

export const joinClassroomSchema = z.object({
  joinCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6,10}$/, "Enter the six-character class code your teacher shared."),
});

export type JoinClassroomInput = z.infer<typeof joinClassroomSchema>;

/**
 * Which bank an assignment draws from.
 *
 * `SHARED` is the editorially reviewed platform bank — the default, and what
 * every assignment written before teacher uploads existed used. `TEACHER_BANK`
 * is the questions this teacher imported from their own papers: theirs to set
 * for their own class, and invisible to open practice and to every other
 * classroom. `CURATED` is neither bank but a specific list of questions the
 * teacher picked by hand.
 *
 * ## Why `CURATED` is a pool value and not a flag
 *
 * The first three values answer "where do the questions come from?" and the
 * answer for a hand-built test is "from this list, and nowhere else". Modelling
 * it as `SHARED` plus an optional override would leave `questionCount` and
 * `questionIds` both meaningful and free to contradict each other; as a pool
 * value, exactly one of the two is authoritative and the service can say which.
 *
 * The behavioural difference matters more than the modelling one. Under the
 * drawing pools each student gets a *different* random set, which is right for
 * homework and wrong for a test: two students' marks are only comparable if they
 * sat the same questions, and item analysis over a class that all saw different
 * questions is arithmetic performed on nothing.
 */
export const assignmentSourcePoolSchema = z.enum(["SHARED", "TEACHER_BANK", "CURATED"]);
export type AssignmentSourcePool = z.infer<typeof assignmentSourcePoolSchema>;

/** Bounds on a hand-built test. Three is a warm-up; fifty is the exam engine's job. */
export const CURATED_ASSIGNMENT_MIN = 3;
export const CURATED_ASSIGNMENT_MAX = 50;

export const createClassroomAssignmentSchema = z
  .object({
    title: assignmentTitleSchema,
    instructions: z.string().trim().max(600).optional(),
    chapterId: z.string().min(1).max(60).nullable().optional(),
    /**
     * How many to draw, for the two drawing pools.
     *
     * Ignored for `CURATED`, where the count is however many questions were
     * picked. The service overwrites it with `questionIds.length` rather than
     * trusting a client to keep two numbers in step.
     */
    questionCount: z.int().min(3).max(30).default(10),
    sourcePool: assignmentSourcePoolSchema.default("SHARED"),
    /** The hand-picked list, in the order the teacher arranged it. */
    questionIds: z.array(z.string().min(1).max(60)).max(CURATED_ASSIGNMENT_MAX).default([]),
    /**
     * Sit it against a clock. Null or omitted means untimed.
     *
     * A teacher's reason for this is not a student's. A student times a set to
     * rehearse pace; a teacher times one so that the class sits comparable
     * conditions — which is also why the limit is copied onto each student's
     * session when they start rather than read live from the assignment.
     */
    timeLimitMinutes: z.int().min(5).max(180).nullable().optional(),
    dueAt: z.iso.datetime().nullable().optional(),
  })
  .refine(
    (input) => input.sourcePool !== "CURATED" || input.questionIds.length >= CURATED_ASSIGNMENT_MIN,
    {
      // Checked here so the teacher is told on the form, rather than after a
      // round trip that half-created something.
      path: ["questionIds"],
      message: `Pick at least ${String(CURATED_ASSIGNMENT_MIN)} questions for a hand-built test.`,
    },
  )
  .refine(
    (input) =>
      input.sourcePool !== "CURATED" ||
      new Set(input.questionIds).size === input.questionIds.length,
    {
      // Duplicate ids look harmless in a picker, but a practice session has one
      // attempt per question id. Letting the same id occupy two slots would make
      // the second slot impossible to answer independently and leave a test
      // permanently short of completion.
      path: ["questionIds"],
      message: "Pick each question only once for a hand-built test.",
    },
  )
  .refine((input) => input.sourcePool === "CURATED" || input.questionIds.length === 0, {
    path: ["questionIds"],
    message: "Question ids only apply when you are picking questions yourself.",
  });

export type CreateClassroomAssignmentInput = z.infer<typeof createClassroomAssignmentSchema>;

export const assignmentProgressSchema = z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "LATE"]);
export type AssignmentProgress = z.infer<typeof assignmentProgressSchema>;

/** The completed-work summary a teacher can use without receiving answers. */
export const assignmentTotalsSchema = z.object({
  totalQuestions: z.int().nonnegative(),
  answered: z.int().nonnegative(),
  correct: z.int().nonnegative(),
  marksEarned: z.number(),
  marksPossible: z.number(),
  timeSpentMs: z.int().nonnegative(),
});

export const studentAssignmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  instructions: z.string().nullable(),
  questionCount: z.int().positive(),
  dueAt: z.iso.datetime().nullable(),
  /**
   * Shown before the student starts, never after.
   *
   * Finding out there is a clock on the first question is the kind of surprise
   * that makes a nervous student do worse at something they knew.
   */
  timeLimitMinutes: z.int().positive().nullable(),
  chapterName: z.string().nullable(),
  progress: assignmentProgressSchema,
  sessionId: z.string().nullable(),
  totals: assignmentTotalsSchema.nullable(),
});

export type StudentAssignment = z.infer<typeof studentAssignmentSchema>;

export const studentClassroomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  subject: classroomSubjectSchema,
  teacherName: z.string().nullable(),
  joinedAt: z.iso.datetime(),
  assignments: z.array(studentAssignmentSchema),
});

export type StudentClassroom = z.infer<typeof studentClassroomSchema>;

export const studentClassroomListSchema = z.object({
  classrooms: z.array(studentClassroomSchema),
});

export const teacherAssignmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  chapterName: z.string().nullable(),
  questionCount: z.int().positive(),
  sourcePool: assignmentSourcePoolSchema,
  timeLimitMinutes: z.int().positive().nullable(),
  dueAt: z.iso.datetime().nullable(),
  startedCount: z.int().nonnegative(),
  completedCount: z.int().nonnegative(),
});

export const teacherClassroomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  joinCode: z.string().min(1),
  subject: classroomSubjectSchema.extend({ chapters: z.array(classroomChapterSchema) }),
  studentCount: z.int().nonnegative(),
  assignments: z.array(teacherAssignmentSchema),
});

export type TeacherClassroom = z.infer<typeof teacherClassroomSchema>;

export const teacherClassroomListSchema = z.object({
  classrooms: z.array(teacherClassroomSchema),
});

export const assignmentReportRowSchema = z.object({
  studentId: z.string().min(1),
  studentName: z.string().nullable(),
  studentEmail: z.email(),
  progress: assignmentProgressSchema,
  startedAt: z.iso.datetime().nullable(),
  completedAt: z.iso.datetime().nullable(),
  totals: assignmentTotalsSchema.nullable(),
});

export const assignmentReportSchema = z.object({
  assignment: z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    instructions: z.string().nullable(),
    classroomName: z.string().min(1),
    subjectName: z.string().min(1),
    chapterName: z.string().nullable(),
    questionCount: z.int().positive(),
    dueAt: z.iso.datetime().nullable(),
  }),
  students: z.array(assignmentReportRowSchema),
});

export type AssignmentReport = z.infer<typeof assignmentReportSchema>;

/** The only response to "start assigned work" is the student's own session. */
export const startAssignmentResponseSchema = practiceSessionSchema;

export const createClassroomResponseSchema = z.object({ classroomId: z.string().min(1) });
export const joinClassroomResponseSchema = z.object({ classroomId: z.string().min(1) });
export const createClassroomAssignmentResponseSchema = z.object({
  assignmentId: z.string().min(1),
});
