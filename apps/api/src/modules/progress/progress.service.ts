import type { ProgressOverview, SubjectProgressSummary, WeakTopic } from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";

/**
 * Read model for the student progress space.
 *
 * Attempts maintain these rollups transactionally, so this stays a handful of
 * indexed reads instead of a dashboard-sized aggregation across every answer a
 * student has ever submitted. The endpoint only returns active enrolments:
 * changing subjects should not make a past course become an active revision
 * recommendation.
 */
export const progressService = {
  async overview(userId: string): Promise<ProgressOverview> {
    const [enrolments, progressRows, topicRows, openMistakes, savedQuestions] = await Promise.all([
      prisma.subjectEnrolment.findMany({
        where: { profile: { userId }, isActive: true },
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
            },
          },
        },
      }),
      prisma.subjectProgress.findMany({
        where: { userId },
        select: {
          subjectId: true,
          attempted: true,
          correct: true,
          marksEarned: true,
          marksPossible: true,
          masteryScore: true,
          unrepairedMistakes: true,
          questionsBookmarked: true,
          practiceSessions: true,
          lastAttemptedAt: true,
        },
      }),
      prisma.topicMastery.findMany({
        where: { userId, attempted: { gt: 0 } },
        orderBy: [{ masteryScore: "asc" }, { lastAttemptedAt: "desc" }],
        take: 24,
        select: {
          attempted: true,
          masteryScore: true,
          unrepairedMistakes: true,
          topic: {
            select: {
              id: true,
              name: true,
              chapter: {
                select: {
                  id: true,
                  name: true,
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
                    },
                  },
                },
              },
            },
          },
        },
      }),
      prisma.mistakeRecord.count({ where: { userId, repairedAt: null } }),
      prisma.bookmark.count({ where: { userId } }),
    ]);

    const bySubjectId = new Map(progressRows.map((row) => [row.subjectId, row]));
    const activeSubjectIds = new Set(enrolments.map(({ subject }) => subject.id));

    const subjects: SubjectProgressSummary[] = enrolments.map(({ subject }) => {
      const row = bySubjectId.get(subject.id);
      return {
        subject,
        attempted: row?.attempted ?? 0,
        correct: row?.correct ?? 0,
        marksEarned: row?.marksEarned ?? 0,
        marksPossible: row?.marksPossible ?? 0,
        masteryScore: row?.masteryScore ?? 0,
        unrepairedMistakes: row?.unrepairedMistakes ?? 0,
        questionsBookmarked: row?.questionsBookmarked ?? 0,
        practiceSessions: row?.practiceSessions ?? 0,
        lastAttemptedAt: row?.lastAttemptedAt?.toISOString() ?? null,
      };
    });

    const weakTopics: WeakTopic[] = topicRows
      .filter((row) => activeSubjectIds.has(row.topic.chapter.subject.id))
      .slice(0, 5)
      .map((row) => ({
        id: row.topic.id,
        name: row.topic.name,
        chapterId: row.topic.chapter.id,
        chapterName: row.topic.chapter.name,
        subject: row.topic.chapter.subject,
        attempted: row.attempted,
        masteryScore: row.masteryScore,
        unrepairedMistakes: row.unrepairedMistakes,
      }));

    return { subjects, weakTopics, openMistakes, savedQuestions };
  },
};
