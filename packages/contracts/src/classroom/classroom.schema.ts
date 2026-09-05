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
 * classroom.
 */
export const assignmentSourcePoolSchema = z.enum(["SHARED", "TEACHER_BANK"]);
export type AssignmentSourcePool = z.infer<typeof assignmentSourcePoolSchema>;

export const createClassroomAssignmentSchema = z.object({
  title: assignmentTitleSchema,
  instructions: z.string().trim().max(600).optional(),
  chapterId: z.string().min(1).max(60).nullable().optional(),
  questionCount: z.int().min(3).max(30),
  sourcePool: assignmentSourcePoolSchema.default("SHARED"),
  dueAt: z.iso.datetime().nullable().optional(),
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
