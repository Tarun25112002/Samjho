import { prisma } from "../../lib/prisma.js";
import { toDayKey, istDay } from "../../lib/study-day.js";
import type { AttemptSample } from "./analysis.metrics.js";

const SAMPLE_LIMIT = 800;
const TREND_DAYS = 60;

export const analysisRepository = {
  async findAttemptSamples(userId: string): Promise<AttemptSample[]> {
    const rows = await prisma.questionAttempt.findMany({
      where: { userId, evaluationMode: { not: "PENDING" } },
      select: {
        isCorrect: true,
        marksAwarded: true,
        marksPossible: true,
        timeSpentMs: true,
        attemptedAt: true,
        question: { select: { bloomLevel: true, expectedTimeSeconds: true } },
      },
      orderBy: { attemptedAt: "desc" },
      take: SAMPLE_LIMIT,
    });

    return rows.map((row) => ({
      isCorrect: row.isCorrect,
      marksAwarded: row.marksAwarded,
      marksPossible: row.marksPossible,
      bloomLevel: row.question.bloomLevel,
      timeSpentMs: row.timeSpentMs,
      expectedTimeSeconds: row.question.expectedTimeSeconds,
      day: toDayKey(istDay(row.attemptedAt)),
    }));
  },

  findTopicMastery(userId: string) {
    return prisma.topicMastery.findMany({
      where: { userId, attempted: { gt: 0 } },
      select: {
        attempted: true,
        correct: true,
        masteryScore: true,
        unrepairedMistakes: true,
        topic: {
          select: {
            id: true,
            name: true,
            chapter: {
              select: {
                name: true,
                isActive: true,
                subject: { select: { name: true, isActive: true } },
              },
            },
          },
        },
      },
      orderBy: [{ masteryScore: "desc" }, { attempted: "desc" }],
    });
  },

  findSubjectProgress(userId: string) {
    return prisma.subjectEnrolment.findMany({
      where: { profile: { userId }, isActive: true, subject: { isActive: true } },
      orderBy: { subject: { orderIndex: "asc" } },
      select: {
        subject: {
          select: {
            id: true,
            board: true,
            code: true,
            name: true,
            slug: true,
            variant: true,
            classLevel: true,
            theoryMarks: true,
            progress: {
              where: { userId },
              select: {
                attempted: true,
                correct: true,
                masteryScore: true,
                marksEarned: true,
                marksPossible: true,
              },
            },
          },
        },
      },
    });
  },

  findStudyDays(userId: string) {
    const since = new Date(Date.now() - TREND_DAYS * 24 * 60 * 60 * 1000);

    return prisma.studyDay.findMany({
      where: { userId, day: { gte: istDay(since) } },
      select: { day: true, attempts: true, correct: true, marksEarned: true, marksPossible: true },
      orderBy: { day: "asc" },
    });
  },

  countCompletedDiagnostics(userId: string): Promise<number> {
    return prisma.practiceSession.count({
      where: { userId, mode: "DIAGNOSTIC", status: "COMPLETED" },
    });
  },
};
