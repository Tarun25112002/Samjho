import type { TeacherDashboard } from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";
import { bankService } from "./bank.service.js";

/**
 * The teacher dashboard's numbers.
 *
 * ## What is on it, and what is deliberately not
 *
 * Four counts, the work that is overdue, and the classes that have gone quiet.
 * Everything here answers "what should I do next", which is the only question a
 * teacher opens a dashboard with between two lessons.
 *
 * What is not here is a feed of student activity. It would be easy — the
 * attempt rows are right there — and it would change what this product is. A
 * teacher can see *whether* a student finished and how they scored in
 * aggregate; the answers themselves stay the student's. That line is drawn in
 * `classroom.service.ts` and this file does not cross it either.
 *
 * ## Why one endpoint rather than five
 *
 * The dashboard needs all of it to render anything, and five endpoints would be
 * five sequential round trips in front of the first paint of the page a teacher
 * lands on. The queries run in parallel here instead.
 */

export const teacherDashboardService = {
  async load(teacherId: string): Promise<TeacherDashboard> {
    const [classroomStats, assignmentRows, bank, uploadCounts] = await Promise.all([
      prisma.classroom.findMany({
        where: { teacherId, isArchived: false },
        select: { id: true, _count: { select: { members: true } } },
      }),
      prisma.classroomAssignment.findMany({
        where: { classroom: { teacherId, isArchived: false } },
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          dueAt: true,
          questionCount: true,
          classroom: { select: { name: true, _count: { select: { members: true } } } },
          submissions: { select: { session: { select: { status: true } } } },
        },
      }),
      bankService.summary(teacherId),
      prisma.questionPaperUpload.groupBy({
        by: ["status"],
        where: { teacherId },
        _count: { _all: true },
      }),
    ]);

    const now = Date.now();

    const active = assignmentRows.filter(
      (assignment) => assignment.dueAt === null || assignment.dueAt.getTime() > now,
    );

    const overdueWithStragglers = assignmentRows.filter((assignment) => {
      if (assignment.dueAt === null || assignment.dueAt.getTime() > now) return false;
      const completed = assignment.submissions.filter(
        (submission) => submission.session.status === "COMPLETED",
      ).length;
      return completed < assignment.classroom._count.members;
    }).length;

    const countFor = (status: string): number =>
      uploadCounts.find((row) => row.status === status)?._count._all ?? 0;

    return {
      classrooms: {
        total: classroomStats.length,
        students: classroomStats.reduce((sum, classroom) => sum + classroom._count.members, 0),
      },
      assignments: {
        total: assignmentRows.length,
        active: active.length,
        overdueWithStragglers,
      },
      bank,
      uploads: {
        total: uploadCounts.reduce((sum, row) => sum + row._count._all, 0),
        extracting: countFor("EXTRACTING"),
        awaitingReview: countFor("READY"),
      },
      // Five, because this is a glance and not a list. The classrooms page has
      // the full set, and a dashboard that needs scrolling has stopped being one.
      upcoming: active.slice(0, 5).map((assignment) => ({
        assignmentId: assignment.id,
        title: assignment.title,
        classroomName: assignment.classroom.name,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        questionCount: assignment.questionCount,
        studentCount: assignment.classroom._count.members,
        completedCount: assignment.submissions.filter(
          (submission) => submission.session.status === "COMPLETED",
        ).length,
      })),
    };
  },
};
