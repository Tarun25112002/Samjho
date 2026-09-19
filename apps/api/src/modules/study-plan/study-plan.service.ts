import {
  REVIEW_DAILY_CAP,
  type DailyStudyPlan,
  type DailyStudyPlanItem,
  type SubjectSummary,
} from "@medhavi/contracts";

import { istDay, toDayKey } from "../../lib/study-day.js";
import { prisma } from "../../lib/prisma.js";
import { progressService } from "../progress/progress.service.js";
import { revisionService } from "../revision/revision.service.js";

/**
 * The daily plan is deliberately computed, not stored.
 *
 * A plan item is a trustworthy pointer into an existing workflow — a frozen
 * practice session, a teacher assignment, the revision queue, or a mastery
 * signal. It never owns questions or marks itself, so the source system stays
 * authoritative after an answer, an enrolment change, or a teacher edit.
 */
export const studyPlanService = {
  async today(userId: string): Promise<DailyStudyPlan> {
    const now = new Date();

    // A live session is the one signal that outweighs every recommendation.
    // Returning only it prevents a plan from persuading a student to create a
    // second set while the first one is still waiting for them. This includes a
    // just-expired timed session: opening it lets the existing practice service
    // close it with the server's deadline rather than pretending it vanished.
    const activeSession = await prisma.practiceSession.findFirst({
      where: { userId, status: "IN_PROGRESS" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        mode: true,
        answered: true,
        totalQuestions: true,
      },
    });

    if (activeSession) {
      return {
        date: toDayKey(istDay(now)),
        items: [
          {
            kind: "RESUME",
            sessionId: activeSession.id,
            mode: activeSession.mode,
            answered: activeSession.answered,
            totalQuestions: activeSession.totalQuestions,
          },
        ],
      };
    }

    const [assignment, revision, overview] = await Promise.all([
      // This repeats the membership predicate used by `startAssignment`. A plan
      // must not reveal a class's title or deadline to someone who cannot start
      // it, and it only recommends subjects the student currently studies.
      prisma.classroomAssignment.findFirst({
        where: {
          classroom: {
            isArchived: false,
            members: { some: { studentId: userId } },
            subject: {
              isActive: true,
              enrolments: { some: { profile: { userId }, isActive: true } },
            },
          },
          submissions: { none: { studentId: userId } },
        },
        // Postgres places nulls last for this ascending sort. An assignment
        // with a real deadline therefore comes before an open-ended brief; an
        // overdue one naturally comes before a future one.
        orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
        select: {
          id: true,
          title: true,
          questionCount: true,
          timeLimitMinutes: true,
          dueAt: true,
          classroom: {
            select: {
              id: true,
              name: true,
              subject: { select: subjectSummarySelect },
            },
          },
        },
      }),
      revisionService.queue(userId),
      progressService.overview(userId),
    ]);

    const items: DailyStudyPlanItem[] = [];

    if (assignment) {
      items.push({
        kind: "ASSIGNMENT",
        assignmentId: assignment.id,
        classroomId: assignment.classroom.id,
        classroomName: assignment.classroom.name,
        subject: assignment.classroom.subject,
        title: assignment.title,
        questionCount: assignment.questionCount,
        timeLimitMinutes: assignment.timeLimitMinutes,
        dueAt: assignment.dueAt?.toISOString() ?? null,
        progress: "NOT_STARTED",
      });
    }

    if (revision.dueToday > 0) {
      items.push({
        kind: "REVIEW",
        dueToday: revision.dueToday,
        dueTotal: revision.dueTotal,
        // Ten is a deliberately small first action. The full revision page
        // retains the daily cap; the plan's job is to make opening it feel
        // finishable, not to turn it into a backlog counter.
        count: Math.min(10, revision.dueToday, REVIEW_DAILY_CAP),
      });
    }

    const weakest = overview.weakTopics.find((topic) => topic.attempted >= 2);
    if (weakest) {
      items.push({
        kind: "TOPIC_PRACTICE",
        subject: weakest.subject,
        chapterId: weakest.chapterId,
        topicId: weakest.id,
        title: weakest.name,
        reason: `${Math.round(weakest.masteryScore * 100)}% recent mastery · ${weakest.chapterName}`,
        questionCount: 6,
        unseenOnly: false,
      });
    } else {
      // A new student's plan cannot honestly name a weak topic yet. A small
      // unseen set from the least-started active subject is the one useful
      // suggestion that does not pretend to know more than the data does.
      const starter = [...overview.subjects]
        .sort(
          (left, right) =>
            left.attempted - right.attempted ||
            left.subject.name.localeCompare(right.subject.name, "en"),
        )
        .find((subject) => subject.attempted < 2);

      if (starter) {
        items.push({
          kind: "TOPIC_PRACTICE",
          subject: starter.subject,
          chapterId: null,
          topicId: null,
          title: starter.subject.name,
          reason:
            starter.attempted === 0
              ? "Start building your baseline with a short fresh set."
              : "A short fresh set will make the next recommendation more personal.",
          questionCount: 6,
          unseenOnly: true,
        });
      }
    }

    return { date: toDayKey(istDay(now)), items: items.slice(0, 3) };
  },
};

const subjectSummarySelect = {
  id: true,
  board: true,
  code: true,
  name: true,
  slug: true,
  variant: true,
  classLevel: true,
  theoryMarks: true,
} as const satisfies Record<keyof SubjectSummary, true>;
