import {
  ASSESSMENT_OBJECTIVE_BLURBS,
  ASSESSMENT_OBJECTIVE_LABELS,
  DIAGNOSTIC_OBJECTIVES,
  type AssessmentPlan,
  type DiagnosticProgress,
  type DiagnosticStage,
  type HintResponse,
  type NextQuestionResult,
  type PracticeSession,
  type QuestionSelection,
  type StartAssessmentInput,
} from "@medhavi/contracts";

import { ConflictError, NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { analyticsService } from "../analytics/analytics.service.js";
import { adaptiveSelection } from "../practice/practice.adaptive.selection.js";
import {
  chooseTopic,
  isDiagnostic,
  planBlend,
  pickNext,
  type AnsweredOutcome,
  type TopicMasteryState,
} from "../practice/practice.adaptive.js";
import { practiceRepository, type SessionRow } from "../practice/practice.repository.js";
import {
  hydrateSession,
  loadSession,
  readSelections,
  sumGradableMarks,
} from "../practice/practice.service.js";

const MINUTES_PER_QUESTION = 1.2;

export const assessmentService = {
  async plan(userId: string, input: StartAssessmentInput): Promise<AssessmentPlan> {
    const subjectIds = await resolveSubjectIds(userId, input.subjectId);
    const states = await loadStates(userId, subjectIds);

    const blend = isDiagnostic(input.objective)
      ? [{ reason: "DIAGNOSTIC_LADDER" as const, count: input.count }]
      : planBlend(input.count);

    const focusTopics = isDiagnostic(input.objective)
      ? []
      : pickFocusTopics(states).map((state) => ({ id: state.topicId, name: state.topicName }));

    const subject =
      input.subjectId === undefined
        ? null
        : await prisma.subject.findUnique({
            where: { id: input.subjectId },
            select: { id: true, name: true },
          });

    return {
      objective: input.objective,
      count: input.count,
      estimatedMinutes: Math.max(1, Math.round(input.count * MINUTES_PER_QUESTION)),
      blend,
      subjectId: subject?.id ?? null,
      subjectName: subject?.name ?? null,
      focusTopics,
    };
  },

  async start(userId: string, input: StartAssessmentInput): Promise<PracticeSession> {
    if (isDiagnostic(input.objective)) {
      const progress = await this.diagnostics(userId);
      const stage = progress.stages.find((entry) => entry.objective === input.objective);

      if (stage?.status === "LOCKED") {
        throw new ConflictError("Finish the previous diagnostic before starting this one.");
      }

      if (stage?.status === "IN_PROGRESS" && stage.sessionId !== null) {
        return hydrateSession(await loadSession(userId, stage.sessionId));
      }
    }

    const subjectIds = await resolveSubjectIds(userId, input.subjectId);
    const states = await loadStates(userId, subjectIds);

    const pick = pickNext({
      objective: input.objective,
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: input.count,
    });

    const questionId = await adaptiveSelection.draw({
      userId,
      subjectIds,
      pick,
      excludeQuestionIds: [],
    });

    if (questionId === null) {
      throw new NotFoundError(
        "Medhavi has no questions for this assessment yet — the question bank",
      );
    }

    const startedAt = new Date();
    const timing =
      input.timeLimitMinutes === undefined
        ? {}
        : {
            timeLimitSeconds: input.timeLimitMinutes * 60,
            deadlineAt: new Date(startedAt.getTime() + input.timeLimitMinutes * 60_000),
          };

    const session = await practiceRepository.create({
      userId,
      mode: isDiagnostic(input.objective) ? "DIAGNOSTIC" : "ADAPTIVE",
      filters: {
        unseenOnly: false,
        ...(input.subjectId === undefined ? {} : { subjectId: input.subjectId }),
      },
      questionIds: [questionId],
      marksPossible: await sumGradableMarks([questionId]),
      objective: input.objective,
      plannedQuestions: input.count,
      selections: { [questionId]: toSelection(pick) },
      ...timing,
    });

    void analyticsService.record({
      userId,
      type: "ASSESSMENT_STARTED",
      sessionId: session.id,
      questionId,
      props: { total: input.count, targetLevel: pick.targetLevel },
    });

    return hydrateSession(session);
  },

  async next(userId: string, sessionId: string): Promise<NextQuestionResult> {
    const session = await loadSession(userId, sessionId);

    if (session.objective === null) {
      throw new ConflictError("This set is not an adaptive assessment.");
    }

    if (session.status !== "IN_PROGRESS") {
      throw new ConflictError("This assessment has already been finished.");
    }

    const served = session.questionIds.length;
    if (served >= session.plannedQuestions) {
      return { index: null, selection: null, exhausted: false, item: null, totals: null };
    }

    const subjectIds = await resolveSubjectIds(userId, readSubjectId(session));
    const states = await loadStates(userId, subjectIds);
    const history = await loadHistory(session);
    const servedTopicIds = await loadServedTopicIds(session);

    const pick = pickNext({
      objective: session.objective,
      index: served,
      states,
      history,
      servedTopicIds,
      count: session.plannedQuestions,
    });

    const questionId = await adaptiveSelection.draw({
      userId,
      subjectIds,
      pick,
      excludeQuestionIds: session.questionIds,
    });

    if (questionId === null) {
      return { index: null, selection: null, exhausted: true, item: null, totals: null };
    }

    const questionIds = [...session.questionIds, questionId];

    const updated = await practiceRepository.appendQuestion({
      sessionId: session.id,
      questionIds,
      marksPossible: await sumGradableMarks(questionIds),
      selections: { ...readSelections(session), [questionId]: toSelection(pick) },
    });

    const hydrated = await hydrateSession(updated);
    const index = questionIds.length - 1;

    return {
      index,
      selection: toSelection(pick),
      exhausted: false,
      item: hydrated.items.at(-1) ?? null,
      totals: hydrated.totals,
    };
  },

  async hint(userId: string, sessionId: string, questionId: string): Promise<HintResponse> {
    const session = await loadSession(userId, sessionId);

    if (!session.questionIds.includes(questionId)) {
      throw new NotFoundError("Question");
    }

    const row = await practiceRepository.findHint(questionId);
    if (!row) throw new NotFoundError("Question");

    await practiceRepository.markHintUsed(sessionId, questionId);

    void analyticsService.record({
      userId,
      type: "HINT_REQUESTED",
      sessionId,
      questionId,
      props: { hintUsed: true },
    });

    const authored = row.answer?.hint?.trim();
    if (authored) {
      return { questionId, hint: authored, authored: true };
    }

    return { questionId, hint: fallbackHint(row), authored: false };
  },

  async diagnostics(userId: string): Promise<DiagnosticProgress> {
    const rows = await practiceRepository.findDiagnosticSessions(userId);

    const stages: DiagnosticStage[] = [];
    let previousDone = true;

    for (const objective of DIAGNOSTIC_OBJECTIVES) {
      const forStage = rows.filter((row) => row.objective === objective);
      const completed = forStage.find((row) => row.status === "COMPLETED");
      const running = forStage.find((row) => row.status === "IN_PROGRESS");

      const status: DiagnosticStage["status"] = completed
        ? "COMPLETED"
        : running
          ? "IN_PROGRESS"
          : previousDone
            ? "AVAILABLE"
            : "LOCKED";

      stages.push({
        objective,
        label: ASSESSMENT_OBJECTIVE_LABELS[objective],
        blurb: ASSESSMENT_OBJECTIVE_BLURBS[objective],
        status,
        sessionId: completed?.id ?? running?.id ?? null,
        completedAt: completed?.completedAt?.toISOString() ?? null,
        scorePercent:
          completed && completed.marksPossible > 0
            ? round1((completed.marksEarned / completed.marksPossible) * 100)
            : null,
      });

      previousDone = completed !== undefined;
    }

    const completedCount = stages.filter((stage) => stage.status === "COMPLETED").length;
    const next = stages.find((stage) => stage.status !== "COMPLETED");

    return {
      stages,
      completedCount,
      analysisReady: completedCount === DIAGNOSTIC_OBJECTIVES.length,
      nextObjective: next?.objective ?? null,
    };
  },
};

async function resolveSubjectIds(userId: string, subjectId: string | undefined): Promise<string[]> {
  if (subjectId !== undefined) return [subjectId];

  const rows = await practiceRepository.findEnrolledSubjectIds(userId);
  return rows.map((row) => row.subjectId);
}

async function loadStates(userId: string, subjectIds: string[]): Promise<TopicMasteryState[]> {
  return practiceRepository.findTopicMasteryStates(userId, subjectIds);
}

async function loadHistory(session: SessionRow): Promise<AnsweredOutcome[]> {
  const attempts = await prisma.questionAttempt.findMany({
    where: { practiceSessionId: session.id, evaluationMode: { not: "PENDING" } },
    select: {
      questionId: true,
      isCorrect: true,
      hintUsed: true,
      timeSpentMs: true,
      attemptedAt: true,
      question: {
        select: {
          id: true,
          parentId: true,
          expectedTimeSeconds: true,
          topics: { where: { isPrimary: true }, select: { topicId: true }, take: 1 },
        },
      },
    },
    orderBy: { attemptedAt: "asc" },
  });

  const selections = readSelections(session);

  return attempts.map((attempt) => {
    const itemId = attempt.question.parentId ?? attempt.question.id;
    const expectedMs = Math.max(1, attempt.question.expectedTimeSeconds) * 1000;

    return {
      topicId: attempt.question.topics[0]?.topicId ?? null,
      targetLevel: selections[itemId]?.targetLevel ?? 3,
      isCorrect: attempt.isCorrect === true,
      hintUsed: attempt.hintUsed,
      paceRatio: attempt.timeSpentMs > 0 ? attempt.timeSpentMs / expectedMs : 1,
    };
  });
}

async function loadServedTopicIds(session: SessionRow): Promise<Set<string>> {
  const topics = await prisma.questionTopic.findMany({
    where: {
      isPrimary: true,
      OR: [
        { questionId: { in: session.questionIds } },
        { question: { parentId: { in: session.questionIds } } },
      ],
    },
    select: { topicId: true },
  });

  return new Set(topics.map((topic) => topic.topicId));
}

function readSubjectId(session: SessionRow): string | undefined {
  const filters = session.filtersJson;
  if (filters && typeof filters === "object" && !Array.isArray(filters)) {
    const value = (filters as Record<string, unknown>)["subjectId"];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function toSelection(pick: {
  reason: QuestionSelection["reason"];
  targetLevel: number;
  topicId: string | null;
  topicName: string | null;
  masteryAtPick: number | null;
}): QuestionSelection {
  return {
    reason: pick.reason,
    targetLevel: pick.targetLevel,
    masteryAtPick: pick.masteryAtPick,
    topicId: pick.topicId,
    topicName: pick.topicName,
  };
}

function pickFocusTopics(states: TopicMasteryState[]): TopicMasteryState[] {
  const picked: TopicMasteryState[] = [];
  const used = new Set<string>();

  for (const reason of ["WEAK_AREA", "WEAK_AREA", "REINFORCEMENT"] as const) {
    const topic = chooseTopic(states, reason, used);
    if (!topic) break;
    used.add(topic.topicId);
    picked.push(topic);
  }

  return picked;
}

function fallbackHint(row: { type: string; topics: { topic: { name: string } }[] }): string {
  const topic = row.topics[0]?.topic.name;
  const subject = topic ? `what you know about ${topic}` : "the idea being tested";

  if (row.type === "NUMERICAL") {
    return `Write down what you are given and what is asked, then pick the relation from ${subject} that connects them. Check your units before you compute.`;
  }

  if (row.type === "MCQ" || row.type === "ASSERTION_REASON") {
    return `Work out the answer before reading the options, then find the one that matches. If nothing matches, re-read the question for a condition you skipped — it usually comes from ${subject}.`;
  }

  return `Start from ${subject} and write the first step you are sure of. The next step is usually forced by the one before it.`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
