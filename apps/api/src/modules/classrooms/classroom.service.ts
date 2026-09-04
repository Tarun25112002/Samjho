import { randomBytes } from "node:crypto";

import type {
  AssignmentProgress,
  AssignmentReport,
  CreateClassroomAssignmentInput,
  CreateClassroomInput,
  JoinClassroomInput,
  StudentClassroom,
  TeacherClassroom,
} from "@samjho/contracts";

import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { practiceService } from "../practice/practice.service.js";

/**
 * Classrooms are deliberately a thin bridge into the practice engine.
 *
 * The bridge controls membership, brief, due date and the aggregate a teacher
 * sees. It does not duplicate the assessment engine or expose answer payloads:
 * a student starts an ordinary materialised practice session, and the one
 * submission row gives the class assignment a stable connection to it.
 */
export const classroomService = {
  async listForTeacher(teacherId: string): Promise<{ classrooms: TeacherClassroom[] }> {
    const classrooms = await prisma.classroom.findMany({
      where: { teacherId, isArchived: false },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        joinCode: true,
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            chapters: {
              where: { isActive: true },
              select: { id: true, name: true },
              orderBy: { orderIndex: "asc" },
            },
          },
        },
        _count: { select: { members: true } },
        assignments: {
          take: 8,
          orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
          select: {
            id: true,
            title: true,
            questionCount: true,
            dueAt: true,
            chapter: { select: { name: true } },
            submissions: { select: { session: { select: { status: true } } } },
          },
        },
      },
    });

    return {
      classrooms: classrooms.map((classroom) => ({
        id: classroom.id,
        name: classroom.name,
        joinCode: classroom.joinCode,
        subject: classroom.subject,
        studentCount: classroom._count.members,
        assignments: classroom.assignments.map((assignment) => ({
          id: assignment.id,
          title: assignment.title,
          chapterName: assignment.chapter?.name ?? null,
          questionCount: assignment.questionCount,
          dueAt: iso(assignment.dueAt),
          startedCount: assignment.submissions.length,
          completedCount: assignment.submissions.filter(
            (submission) => submission.session.status === "COMPLETED",
          ).length,
        })),
      })),
    };
  },

  async listForStudent(studentId: string): Promise<{ classrooms: StudentClassroom[] }> {
    const memberships = await prisma.classroomMembership.findMany({
      where: { studentId, classroom: { isArchived: false } },
      orderBy: { joinedAt: "desc" },
      select: {
        joinedAt: true,
        classroom: {
          select: {
            id: true,
            name: true,
            subject: { select: { id: true, name: true, code: true } },
            teacher: { select: { name: true } },
            assignments: {
              orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
              select: {
                id: true,
                title: true,
                instructions: true,
                questionCount: true,
                dueAt: true,
                chapter: { select: { name: true } },
                submissions: {
                  where: { studentId },
                  select: {
                    sessionId: true,
                    session: {
                      select: {
                        status: true,
                        completedAt: true,
                        totalQuestions: true,
                        answered: true,
                        correct: true,
                        marksEarned: true,
                        marksPossible: true,
                        timeSpentMs: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      classrooms: memberships.map(({ joinedAt, classroom }) => ({
        id: classroom.id,
        name: classroom.name,
        subject: classroom.subject,
        teacherName: classroom.teacher.name,
        joinedAt: joinedAt.toISOString(),
        assignments: classroom.assignments.map((assignment) => {
          const submission = assignment.submissions[0] ?? null;
          return {
            id: assignment.id,
            title: assignment.title,
            instructions: assignment.instructions,
            questionCount: assignment.questionCount,
            dueAt: iso(assignment.dueAt),
            chapterName: assignment.chapter?.name ?? null,
            progress: progressOf(submission?.session ?? null, assignment.dueAt),
            sessionId: submission?.sessionId ?? null,
            totals: submission ? totalsOf(submission.session) : null,
          };
        }),
      })),
    };
  },

  async createClassroom(
    teacherId: string,
    input: CreateClassroomInput,
  ): Promise<{ classroomId: string }> {
    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, isActive: true, board: "CBSE", classLevel: 10 },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Class 10 CBSE subject");

    const classroom = await prisma.classroom.create({
      data: {
        teacherId,
        subjectId: subject.id,
        name: input.name.trim(),
        joinCode: await nextJoinCode(),
      },
      select: { id: true },
    });

    return { classroomId: classroom.id };
  },

  async joinClassroom(
    studentId: string,
    input: JoinClassroomInput,
  ): Promise<{ classroomId: string }> {
    const classroom = await prisma.classroom.findFirst({
      where: { joinCode: input.joinCode, isArchived: false },
      select: { id: true },
    });
    if (!classroom) throw new NotFoundError("Classroom");

    await prisma.classroomMembership.upsert({
      where: { classroomId_studentId: { classroomId: classroom.id, studentId } },
      create: { classroomId: classroom.id, studentId },
      update: {},
    });

    return { classroomId: classroom.id };
  },

  async createAssignment(
    teacherId: string,
    classroomId: string,
    input: CreateClassroomAssignmentInput,
  ): Promise<{ assignmentId: string }> {
    const classroom = await prisma.classroom.findFirst({
      where: { id: classroomId, teacherId, isArchived: false },
      select: { id: true, subjectId: true },
    });
    if (!classroom) throw new NotFoundError("Classroom");

    if (input.chapterId) {
      const chapter = await prisma.chapter.findFirst({
        where: { id: input.chapterId, subjectId: classroom.subjectId, isActive: true },
        select: { id: true },
      });
      if (!chapter) {
        throw new ValidationError("Request validation failed", [
          { path: "body.chapterId", message: "choose a chapter from this class's subject" },
        ]);
      }
    }

    const dueAt = input.dueAt ? new Date(input.dueAt) : null;
    if (dueAt && dueAt.getTime() <= Date.now()) {
      throw new ValidationError("Request validation failed", [
        { path: "body.dueAt", message: "choose a due time in the future" },
      ]);
    }

    const assignment = await prisma.classroomAssignment.create({
      data: {
        classroomId: classroom.id,
        title: input.title.trim(),
        instructions: input.instructions?.trim() || null,
        chapterId: input.chapterId ?? null,
        questionCount: input.questionCount,
        dueAt,
      },
      select: { id: true },
    });

    return { assignmentId: assignment.id };
  },

  async startAssignment(studentId: string, assignmentId: string) {
    const assignment = await prisma.classroomAssignment.findFirst({
      where: {
        id: assignmentId,
        classroom: { isArchived: false, members: { some: { studentId } } },
      },
      select: {
        id: true,
        chapterId: true,
        questionCount: true,
        classroom: { select: { subjectId: true } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment");

    const existing = await prisma.assignmentSubmission.findUnique({
      where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
      select: { sessionId: true },
    });
    if (existing) return practiceService.get(studentId, existing.sessionId);

    // The exact question ids are chosen and frozen by the same service that
    // builds personal practice. An assignment cannot leak a key by carrying a
    // hand-made question payload through a teacher endpoint.
    const session = await practiceService.create(studentId, {
      mode: assignment.chapterId ? "CHAPTER" : "CUSTOM",
      filters: {
        subjectId: assignment.classroom.subjectId,
        ...(assignment.chapterId ? { chapterId: assignment.chapterId } : {}),
        unseenOnly: false,
      },
      count: assignment.questionCount,
    });

    try {
      await prisma.assignmentSubmission.create({
        data: { assignmentId: assignment.id, studentId, sessionId: session.id },
      });
    } catch (error) {
      // Two tabs starting at the same time is normal. The first session wins;
      // the second is intentionally harmless and the student resumes the
      // canonical assignment session.
      const raced = await prisma.assignmentSubmission.findUnique({
        where: { assignmentId_studentId: { assignmentId: assignment.id, studentId } },
        select: { sessionId: true },
      });
      if (raced) return practiceService.get(studentId, raced.sessionId);
      throw error;
    }

    return session;
  },

  async report(teacherId: string, assignmentId: string): Promise<AssignmentReport> {
    const assignment = await prisma.classroomAssignment.findFirst({
      where: { id: assignmentId, classroom: { teacherId } },
      select: {
        id: true,
        title: true,
        instructions: true,
        questionCount: true,
        dueAt: true,
        chapter: { select: { name: true } },
        classroom: {
          select: {
            name: true,
            subject: { select: { name: true } },
            members: { select: { student: { select: { id: true, name: true, email: true } } } },
          },
        },
        submissions: {
          select: {
            studentId: true,
            startedAt: true,
            session: {
              select: {
                status: true,
                completedAt: true,
                totalQuestions: true,
                answered: true,
                correct: true,
                marksEarned: true,
                marksPossible: true,
                timeSpentMs: true,
              },
            },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment");

    const submissionFor = new Map(assignment.submissions.map((item) => [item.studentId, item]));

    return {
      assignment: {
        id: assignment.id,
        title: assignment.title,
        instructions: assignment.instructions,
        classroomName: assignment.classroom.name,
        subjectName: assignment.classroom.subject.name,
        chapterName: assignment.chapter?.name ?? null,
        questionCount: assignment.questionCount,
        dueAt: iso(assignment.dueAt),
      },
      students: assignment.classroom.members.map(({ student }) => {
        const submission = submissionFor.get(student.id);
        return {
          studentId: student.id,
          studentName: student.name,
          studentEmail: student.email,
          progress: progressOf(submission?.session ?? null, assignment.dueAt),
          startedAt: iso(submission?.startedAt ?? null),
          completedAt: submission ? iso(submission.session.completedAt) : null,
          totals: submission ? totalsOf(submission.session) : null,
        };
      }),
    };
  },
};

function totalsOf(session: {
  totalQuestions: number;
  answered: number;
  correct: number;
  marksEarned: number;
  marksPossible: number;
  timeSpentMs: number;
}) {
  return {
    totalQuestions: session.totalQuestions,
    answered: session.answered,
    correct: session.correct,
    marksEarned: session.marksEarned,
    marksPossible: session.marksPossible,
    timeSpentMs: session.timeSpentMs,
  };
}

function progressOf(
  session: { status: string; completedAt: Date | null } | null,
  dueAt: Date | null,
): AssignmentProgress {
  if (!session) return "NOT_STARTED";
  if (session.status !== "COMPLETED") return "IN_PROGRESS";
  if (dueAt && session.completedAt && session.completedAt.getTime() > dueAt.getTime())
    return "LATE";
  return "COMPLETED";
}

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

async function nextJoinCode(): Promise<string> {
  // Avoid I, O and 1, 0 in a code a student has to transcribe from a board.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const bytes = randomBytes(6);
    const code = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
    const exists = await prisma.classroom.findUnique({
      where: { joinCode: code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new ConflictError("Could not create a unique class code. Please try again.");
}

export function assertTeacher(role: string): void {
  if (role !== "TEACHER") throw new ForbiddenError("Only teacher accounts can manage classrooms");
}

export function assertStudent(role: string): void {
  if (role !== "STUDENT") throw new ForbiddenError("Only student accounts can join a classroom");
}
