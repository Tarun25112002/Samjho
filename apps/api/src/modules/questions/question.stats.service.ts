import type {
  AdminContentStats,
  AdminSubjectStats,
  LicenceStatus,
  QuestionStatus,
} from "@samjho/contracts";

import { prisma } from "../../lib/prisma.js";
import { questionAdminRepository } from "./question.admin.repository.js";

/**
 * The content dashboard.
 *
 * Deliberately four numbers per subject rather than a chart. The question this
 * page has to answer is "what should I do next", and for a bank being written
 * from zero (docs/07 R1) there are only ever three answers: write more, review
 * the licensing on what exists, or fill in the chapters that have nothing at
 * all. Anything else on this page is decoration competing with those.
 *
 * `chaptersWithNoQuestions` is the one worth explaining. A bank of 400 questions
 * spread evenly is a usable product; the same 400 concentrated in six chapters
 * is not, because a student practising the chapter they have a test on next week
 * finds it empty. Total count hides that completely, which is exactly why the
 * count everyone reaches for first is the wrong one to steer by.
 */

const EMPTY_BY_STATUS: Record<QuestionStatus, number> = {
  DRAFT: 0,
  IN_REVIEW: 0,
  PUBLISHED: 0,
  ARCHIVED: 0,
};

const EMPTY_BY_LICENCE: Record<LicenceStatus, number> = {
  CLEARED: 0,
  FAIR_USE_CLAIMED: 0,
  NEEDS_REVIEW: 0,
  RESTRICTED: 0,
};

const A_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const questionStatsService = {
  async contentStats(): Promise<AdminContentStats> {
    const subjects = await prisma.subject.findMany({
      where: { isActive: true },
      orderBy: [{ classLevel: "asc" }, { orderIndex: "asc" }],
      select: { id: true, name: true, classLevel: true },
    });

    const perSubject = await Promise.all(
      subjects.map(async (subject): Promise<AdminSubjectStats> => {
        const [byStatusRows, chaptersWithNoQuestions, needsLicenceReview] = await Promise.all([
          questionAdminRepository.countByStatus(subject.id),
          questionAdminRepository.countChaptersWithNoQuestions(subject.id),
          prisma.questionSource.count({
            where: {
              licenceStatus: "NEEDS_REVIEW",
              question: { subjectId: subject.id, parentId: null },
            },
          }),
        ]);

        const byStatus = { ...EMPTY_BY_STATUS };
        for (const row of byStatusRows) byStatus[row.status] = row._count._all;

        return {
          subjectId: subject.id,
          name: subject.name,
          classLevel: subject.classLevel,
          total: Object.values(byStatus).reduce((sum, count) => sum + count, 0),
          byStatus,
          chaptersWithNoQuestions,
          needsLicenceReview,
        };
      }),
    );

    const [licenceRows, editedThisWeek] = await Promise.all([
      questionAdminRepository.countByLicenceStatus(),
      questionAdminRepository.countEditedSince(new Date(Date.now() - A_WEEK_MS)),
    ]);

    const byLicenceStatus = { ...EMPTY_BY_LICENCE };
    for (const row of licenceRows) byLicenceStatus[row.licenceStatus] = row._count._all;

    return { subjects: perSubject, byLicenceStatus, editedThisWeek };
  },
};
