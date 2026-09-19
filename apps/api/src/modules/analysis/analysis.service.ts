import {
  ANALYSIS_MIN_TOPIC_ATTEMPTS,
  bandFor,
  DIAGNOSTIC_OBJECTIVES,
  type AnalysisSubject,
  type AnalysisTopic,
  type MasteryPoint,
  type PreparationAnalysis,
  type ProgressTrend,
  type TopicMovement,
} from "@medhavi/contracts";

import { prisma } from "../../lib/prisma.js";
import { toDayKey } from "../../lib/study-day.js";
import { analysisInsight } from "./analysis.insight.js";
import { computeMetrics, toLearningMetrics } from "./analysis.metrics.js";
import { analysisRepository } from "./analysis.repository.js";

const TOPIC_LIST_LIMIT = 8;

export const analysisService = {
  async preparation(userId: string): Promise<PreparationAnalysis> {
    const [samples, topicRows, enrolments, diagnosticsCompleted, profile] = await Promise.all([
      analysisRepository.findAttemptSamples(userId),
      analysisRepository.findTopicMastery(userId),
      analysisRepository.findSubjectProgress(userId),
      analysisRepository.countCompletedDiagnostics(userId),
      prisma.studentProfile.findUnique({ where: { userId }, select: { classLevel: true } }),
    ]);

    const metrics = computeMetrics(samples);

    const topics: AnalysisTopic[] = topicRows
      .filter((row) => row.topic.chapter.isActive && row.topic.chapter.subject.isActive)
      .filter((row) => row.attempted >= ANALYSIS_MIN_TOPIC_ATTEMPTS)
      .map((row) => ({
        id: row.topic.id,
        name: row.topic.name,
        chapterName: row.topic.chapter.name,
        subjectName: row.topic.chapter.subject.name,
        masteryScore: row.masteryScore,
        band: bandFor(row.masteryScore),
        attempted: row.attempted,
        unrepairedMistakes: row.unrepairedMistakes,
      }));

    const subjects: AnalysisSubject[] = enrolments.map(({ subject }) => {
      const { progress, ...summary } = subject;
      const row = progress[0];

      return {
        subject: summary,
        masteryScore: row?.masteryScore ?? 0,
        accuracy: row && row.attempted > 0 ? row.correct / row.attempted : null,
        attempted: row?.attempted ?? 0,
      };
    });

    const strong = band(topics, "STRONG");
    const needsPractice = band(topics, "NEEDS_PRACTICE");
    const weak = band(topics, "WEAK");

    const insight = await analysisInsight.build({
      metrics,
      subjects,
      strong,
      needsPractice,
      weak,
      classLevel: profile?.classLevel ?? 10,
    });

    return {
      overallMastery: metrics.overallMastery,
      questionsAttempted: metrics.scored,
      metrics: toLearningMetrics(metrics),
      averageResponseSeconds: metrics.averageResponseSeconds,
      paceRatio: metrics.paceRatio,
      subjects,
      strong: strong.slice(0, TOPIC_LIST_LIMIT),
      needsPractice: needsPractice.slice(0, TOPIC_LIST_LIMIT),
      weak: weak.slice(0, TOPIC_LIST_LIMIT),
      insight,
      diagnosticsCompleted,
      diagnosticsComplete: diagnosticsCompleted >= DIAGNOSTIC_OBJECTIVES.length,
      generatedAt: new Date().toISOString(),
    };
  },

  async trend(userId: string): Promise<ProgressTrend> {
    const [days, topicRows] = await Promise.all([
      analysisRepository.findStudyDays(userId),
      analysisRepository.findTopicMastery(userId),
    ]);

    const points: MasteryPoint[] = days.map((day) => ({
      day: toDayKey(day.day),
      masteryScore: day.marksPossible > 0 ? day.marksEarned / day.marksPossible : 0,
      attempted: day.attempts,
    }));

    const movements = await topicMovements(userId, topicRows);

    return {
      points,
      topics: movements,
      currentStreakDays: streakOf(days.map((day) => toDayKey(day.day))),
    };
  },
};

function band(topics: AnalysisTopic[], wanted: AnalysisTopic["band"]): AnalysisTopic[] {
  const subset = topics.filter((topic) => topic.band === wanted);
  return wanted === "STRONG"
    ? [...subset].sort((a, b) => b.masteryScore - a.masteryScore)
    : [...subset].sort((a, b) => a.masteryScore - b.masteryScore);
}

type TopicRow = Awaited<ReturnType<typeof analysisRepository.findTopicMastery>>[number];

async function topicMovements(userId: string, topicRows: TopicRow[]): Promise<TopicMovement[]> {
  const active = topicRows.filter(
    (row) => row.topic.chapter.isActive && row.topic.chapter.subject.isActive && row.attempted > 0,
  );

  if (active.length === 0) return [];

  // The previous figure is rebuilt from the attempts themselves rather than
  // stored, because storing a history of a rollup is a second rollup to keep
  // true. Marks over the older half of a topic's attempts is what the mastery
  // score was converging on before this fortnight's work.
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const earlier = await prisma.questionAttempt.groupBy({
    by: ["questionId"],
    where: {
      userId,
      evaluationMode: { not: "PENDING" },
      attemptedAt: { lt: cutoff },
    },
    _sum: { marksAwarded: true, marksPossible: true },
  });

  if (earlier.length === 0) {
    return active.slice(0, 12).map((row) => ({
      id: row.topic.id,
      name: row.topic.name,
      chapterName: row.topic.chapter.name,
      subjectName: row.topic.chapter.subject.name,
      current: row.masteryScore,
      previous: null,
    }));
  }

  const links = await prisma.questionTopic.findMany({
    where: { isPrimary: true, questionId: { in: earlier.map((row) => row.questionId) } },
    select: { questionId: true, topicId: true },
  });

  const topicByQuestion = new Map(links.map((link) => [link.questionId, link.topicId]));
  const totals = new Map<string, { earned: number; possible: number }>();

  for (const row of earlier) {
    const topicId = topicByQuestion.get(row.questionId);
    if (topicId === undefined) continue;

    const entry = totals.get(topicId) ?? { earned: 0, possible: 0 };
    entry.earned += row._sum.marksAwarded ?? 0;
    entry.possible += row._sum.marksPossible ?? 0;
    totals.set(topicId, entry);
  }

  return active.slice(0, 12).map((row) => {
    const previous = totals.get(row.topic.id);

    return {
      id: row.topic.id,
      name: row.topic.name,
      chapterName: row.topic.chapter.name,
      subjectName: row.topic.chapter.subject.name,
      current: row.masteryScore,
      previous:
        previous && previous.possible > 0 ? Math.min(1, previous.earned / previous.possible) : null,
    };
  });
}

function streakOf(dayKeys: string[]): number {
  if (dayKeys.length === 0) return 0;

  const days = new Set(dayKeys);
  const today = new Date();
  let streak = 0;

  for (let back = 0; back < 400; back += 1) {
    const probe = new Date(today.getTime() - back * 24 * 60 * 60 * 1000);
    const key = probe.toISOString().slice(0, 10);

    if (days.has(key)) {
      streak += 1;
      continue;
    }

    // Today not being in the set is not a broken streak until tomorrow — the
    // student may simply not have practised yet.
    if (back === 0) continue;
    break;
  }

  return streak;
}
