import { MISTAKE_REASON_LABELS, type WeeklyStudyPlan } from "@samjho/contracts";

import { istDay, toDayKey } from "../../lib/study-day.js";
import { prisma } from "../../lib/prisma.js";
import { revisionService } from "../revision/revision.service.js";
import { studyCoach } from "./study-plan.coach.js";
import { planWeek, type WeakTopic } from "./study-plan.week.js";

/**
 * The week ahead, assembled from what the student has actually done.
 *
 * Reads, in one pass: the topics their answers say are weakest, what the
 * revision schedule owes them, which of their subjects have a paper they could
 * actually sit, and how far away their exam is. Those four facts decide the
 * plan. A model is then asked to explain it, and cannot change it.
 *
 * ## Nothing is stored
 *
 * The plan is computed per request, like the daily one and for the same reason:
 * a stored plan is a plan that goes stale the moment a student answers a
 * question, and a student who has just cleared their revision queue should not
 * open Tuesday to find it still telling them to clear it.
 */

/** Below this, a mastery score is noise rather than a weakness. */
const MIN_ATTEMPTS = 4;
/** Weak enough to be worth a day. Matches the analysis page's bands. */
const WEAK_BELOW = 0.65;
const TOPIC_SLOTS = 6;

/**
 * What an ordinary evening holds.
 *
 * A guess, and a deliberately modest one. A plan built around three hours a day
 * is a plan a student fails on Tuesday and stops opening on Wednesday; one
 * built around forty minutes is one they can beat, which is the only kind that
 * survives a week.
 */
const MINUTES_PER_DAY = 45;

export const studyWeekService = {
  async week(userId: string): Promise<WeeklyStudyPlan> {
    const now = new Date();
    const start = istDay(now);

    const [profile, mastery, queue, papers, reasons] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          classLevel: true,
          targetExams: {
            where: { examDate: { not: null } },
            orderBy: { examDate: "asc" },
            take: 1,
            select: { examDate: true },
          },
        },
      }),
      prisma.topicMastery.findMany({
        where: { userId, attempted: { gte: MIN_ATTEMPTS }, masteryScore: { lt: WEAK_BELOW } },
        orderBy: { masteryScore: "asc" },
        take: TOPIC_SLOTS,
        select: {
          masteryScore: true,
          attempted: true,
          topic: {
            select: {
              id: true,
              name: true,
              chapter: { select: { subject: { select: { id: true, name: true } } } },
            },
          },
        },
      }),
      revisionService.queue(userId),
      // Only subjects the student is enrolled in *and* that have a published
      // paper. A plan that schedules a mock in a subject with no paper sends
      // them to an empty page on Thursday, which is worse than not scheduling
      // one at all.
      prisma.subject.findMany({
        where: {
          enrolments: { some: { profile: { userId }, isActive: true } },
          examPapers: { some: { status: "PUBLISHED" } },
        },
        orderBy: { orderIndex: "asc" },
        select: { id: true, name: true },
      }),
      prisma.questionAttempt.findMany({
        where: { userId, mistakeReason: { not: null } },
        orderBy: { attemptedAt: "desc" },
        take: 20,
        select: { mistakeReason: true },
      }),
    ]);

    const weak: WeakTopic[] = mastery.map((row) => ({
      topicId: row.topic.id,
      topicName: row.topic.name,
      subjectId: row.topic.chapter.subject.id,
      subjectName: row.topic.chapter.subject.name,
      masteryScore: row.masteryScore,
      attempted: row.attempted,
    }));

    const examDate = profile?.targetExams[0]?.examDate ?? null;
    const daysToExam =
      examDate === null
        ? null
        : Math.round((istDay(examDate).getTime() - start.getTime()) / 86_400_000);

    const days = planWeek({
      start,
      weak,
      revisionDue: queue.dueTotal,
      mockableSubjects: papers.map((row) => ({ subjectId: row.id, subjectName: row.name })),
      daysToExam,
      minutesPerDay: MINUTES_PER_DAY,
    });

    const coached = await studyCoach.write({
      days,
      daysToExam,
      classLevel: profile?.classLevel ?? 10,
      revisionDue: queue.dueTotal,
      weakest: weak[0]?.topicName ?? null,
      mistakePattern: dominantReason(reasons.map((row) => row.mistakeReason)),
    });

    return {
      weekStart: toDayKey(start),
      days: days.map((day, index) => ({ ...day, note: coached.notes[index] ?? "" })),
      opening: coached.opening,
      daysToExam,
      generated: coached.generated,
    };
  },
};

/**
 * The reason that dominates, if one genuinely does.
 *
 * Same threshold as the tutor's learner profile, and for the same reason: a
 * student whose last six mistakes are one of each has no pattern, and a coach
 * told otherwise writes a week about a habit they do not have.
 */
function dominantReason(reasons: Array<string | null>): string | null {
  const counts = new Map<string, number>();
  for (const reason of reasons) {
    if (reason === null) continue;
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total < 3) return null;

  const top = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
  if (!top || top[1] / total < 1 / 3) return null;

  const label = MISTAKE_REASON_LABELS[top[0] as keyof typeof MISTAKE_REASON_LABELS];
  return label ? label.toLowerCase() : null;
}
