import {
  preparationAnalysisSchema,
  progressTrendSchema,
  successResponseSchema,
} from "@medhavi/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "antest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch-algebra`;
const TOPIC_STRONG = `${PREFIX}-topic-linear`;
const TOPIC_MIDDLING = `${PREFIX}-topic-quadratic`;
const TOPIC_WEAK = `${PREFIX}-topic-probability`;
const TOPIC_THIN = `${PREFIX}-topic-circles`;

let student: string;
let stranger: string;
let studentId: string;
let profileId: string;

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}-student@example.test`,
      name: "Analysis Student",
    },
    select: { id: true, clerkId: true },
  });
  studentId = owner.id;
  student = await bearer({ subject: owner.clerkId });

  const profile = await prisma.studentProfile.create({
    data: { userId: studentId, classLevel: 10, board: "CBSE", onboardedAt: new Date() },
    select: { id: true },
  });
  profileId = profile.id;

  const other = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_stranger`,
      email: `${PREFIX}-stranger@example.test`,
      name: "Someone Else",
    },
    select: { clerkId: true },
  });
  stranger = await bearer({ subject: other.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "ANMTH",
      name: "Antest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.subjectEnrolment.create({ data: { profileId, subjectId: SUBJECT } });

  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Algebra", slug: CHAPTER, orderIndex: 0 },
  });

  await prisma.topic.createMany({
    data: [
      {
        id: TOPIC_STRONG,
        chapterId: CHAPTER,
        name: "Linear equations",
        slug: TOPIC_STRONG,
        orderIndex: 0,
      },
      {
        id: TOPIC_MIDDLING,
        chapterId: CHAPTER,
        name: "Quadratic equations",
        slug: TOPIC_MIDDLING,
        orderIndex: 1,
      },
      { id: TOPIC_WEAK, chapterId: CHAPTER, name: "Probability", slug: TOPIC_WEAK, orderIndex: 2 },
      { id: TOPIC_THIN, chapterId: CHAPTER, name: "Circles", slug: TOPIC_THIN, orderIndex: 3 },
    ],
  });

  for (let index = 0; index < 12; index += 1) {
    await prisma.question.create({
      data: {
        id: `${PREFIX}-q-${String(index)}`,
        subjectId: SUBJECT,
        chapterId: CHAPTER,
        type: "MCQ",
        body: `Antest question ${String(index)}`,
        marks: 1,
        difficulty: "MEDIUM",
        bloomLevel: index < 6 ? "UNDERSTAND" : "APPLY",
        expectedTimeSeconds: 60,
        status: "PUBLISHED",
        topics: { create: [{ topicId: TOPIC_STRONG, isPrimary: true }] },
      },
    });
  }
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.practiceSession.deleteMany({ where: { userId: studentId } });
  await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
  await prisma.subjectProgress.deleteMany({ where: { userId: studentId } });
  await prisma.studyDay.deleteMany({ where: { userId: studentId } });
});

describe("a student with no history", () => {
  it("says so rather than inventing figures", async () => {
    const analysis = await getAnalysis();

    expect(analysis.overallMastery).toBeNull();
    expect(analysis.questionsAttempted).toBe(0);
    expect(analysis.insight).toBeNull();
    expect(analysis.strong).toEqual([]);
    expect(analysis.weak).toEqual([]);
    expect(analysis.diagnosticsComplete).toBe(false);
  });

  it("still lists the subjects they are enrolled in, at zero", async () => {
    const analysis = await getAnalysis();

    expect(analysis.subjects).toHaveLength(1);
    expect(analysis.subjects[0]?.masteryScore).toBe(0);
    expect(analysis.subjects[0]?.accuracy).toBeNull();
  });
});

describe("banding topics", () => {
  beforeEach(async () => {
    await setMastery(TOPIC_STRONG, 0.88, 10);
    await setMastery(TOPIC_MIDDLING, 0.61, 8);
    await setMastery(TOPIC_WEAK, 0.34, 9);
    await setMastery(TOPIC_THIN, 0.2, 1);
  });

  it("splits them into strong, needing practice and weak", async () => {
    const analysis = await getAnalysis();

    expect(analysis.strong.map((topic) => topic.id)).toEqual([TOPIC_STRONG]);
    expect(analysis.needsPractice.map((topic) => topic.id)).toEqual([TOPIC_MIDDLING]);
    expect(analysis.weak.map((topic) => topic.id)).toEqual([TOPIC_WEAK]);
  });

  it("leaves out a topic with too little evidence to judge", async () => {
    const analysis = await getAnalysis();
    const everyTopic = [...analysis.strong, ...analysis.needsPractice, ...analysis.weak];

    expect(everyTopic.map((topic) => topic.id)).not.toContain(TOPIC_THIN);
  });

  it("lists the weakest first, so the top of the list is where to start", async () => {
    await setMastery(TOPIC_MIDDLING, 0.44, 8);
    const analysis = await getAnalysis();

    expect(analysis.weak[0]?.masteryScore).toBeLessThanOrEqual(analysis.weak[1]?.masteryScore ?? 1);
  });
});

describe("with real attempts behind it", () => {
  beforeEach(async () => {
    await recordAttempts();
  });

  it("computes mastery, accuracy and pace from the attempts themselves", async () => {
    const analysis = await getAnalysis();

    expect(analysis.questionsAttempted).toBe(12);
    expect(analysis.overallMastery).toBeCloseTo(8 / 12);
    expect(analysis.averageResponseSeconds).toBe(60);
    expect(analysis.paceRatio).toBe(1);
  });

  it("separates conceptual understanding from problem solving", async () => {
    const analysis = await getAnalysis();

    const conceptual = analysis.metrics.find((metric) => metric.key === "CONCEPTUAL_UNDERSTANDING");
    const problemSolving = analysis.metrics.find((metric) => metric.key === "PROBLEM_SOLVING");

    expect(conceptual?.value).toBeCloseTo(1);
    expect(problemSolving?.value).toBeCloseTo(1 / 3);
  });

  it("writes an insight that names a real topic and no invented one", async () => {
    await setMastery(TOPIC_WEAK, 0.2, 9);
    const analysis = await getAnalysis();

    expect(analysis.insight).not.toBeNull();
    expect(analysis.insight?.text).toContain("Probability");
    expect(analysis.insight?.generated).toBe(false);
  });
});

describe("the diagnostic gate", () => {
  it("opens only once all three diagnostics are finished", async () => {
    for (const objective of [
      "DIAGNOSTIC_FUNDAMENTALS",
      "DIAGNOSTIC_APPLICATION",
      "DIAGNOSTIC_CHALLENGE",
    ] as const) {
      await prisma.practiceSession.create({
        data: {
          userId: studentId,
          mode: "DIAGNOSTIC",
          objective,
          filtersJson: {},
          questionIds: [],
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
    }

    const analysis = await getAnalysis();
    expect(analysis.diagnosticsCompleted).toBe(3);
    expect(analysis.diagnosticsComplete).toBe(true);
  });

  it("does not count an unfinished diagnostic", async () => {
    await prisma.practiceSession.create({
      data: {
        userId: studentId,
        mode: "DIAGNOSTIC",
        objective: "DIAGNOSTIC_FUNDAMENTALS",
        filtersJson: {},
        questionIds: [],
        status: "IN_PROGRESS",
      },
    });

    const analysis = await getAnalysis();
    expect(analysis.diagnosticsCompleted).toBe(0);
  });
});

describe("the progress trend", () => {
  it("is empty for a student who has done nothing", async () => {
    const trend = await getTrend();

    expect(trend.points).toEqual([]);
    expect(trend.topics).toEqual([]);
    expect(trend.currentStreakDays).toBe(0);
  });

  it("plots one point per day worked", async () => {
    await recordAttempts();
    const trend = await getTrend();

    expect(trend.points.length).toBeGreaterThan(0);
    expect(trend.points[0]?.masteryScore).toBeGreaterThanOrEqual(0);
  });

  it("reports the current mastery of each topic, with no previous figure yet", async () => {
    await setMastery(TOPIC_STRONG, 0.8, 10);
    const trend = await getTrend();

    expect(trend.topics.map((topic) => topic.id)).toContain(TOPIC_STRONG);
    expect(trend.topics.find((topic) => topic.id === TOPIC_STRONG)?.previous).toBeNull();
  });
});

describe("authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    await request(app).get("/api/v1/analysis").expect(401);
  });

  it("reports on the caller, never on anyone else", async () => {
    await setMastery(TOPIC_STRONG, 0.9, 10);

    const response = await request(app)
      .get("/api/v1/analysis")
      .set("authorization", stranger)
      .expect(200);

    const analysis = successResponseSchema(preparationAnalysisSchema).parse(response.body).data;

    expect(analysis.strong).toEqual([]);
    expect(analysis.overallMastery).toBeNull();
  });
});

async function getAnalysis() {
  const response = await request(app)
    .get("/api/v1/analysis")
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(preparationAnalysisSchema).parse(response.body).data;
}

async function getTrend() {
  const response = await request(app)
    .get("/api/v1/analysis/trend")
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(progressTrendSchema).parse(response.body).data;
}

async function setMastery(topicId: string, masteryScore: number, attempted: number): Promise<void> {
  await prisma.topicMastery.upsert({
    where: { userId_topicId: { userId: studentId, topicId } },
    create: {
      userId: studentId,
      topicId,
      masteryScore,
      attempted,
      correct: Math.round(attempted * masteryScore),
    },
    update: { masteryScore, attempted, correct: Math.round(attempted * masteryScore) },
  });
}

/** Six conceptual questions all right, six applied questions two right. */
async function recordAttempts(): Promise<void> {
  const session = await prisma.practiceSession.create({
    data: { userId: studentId, mode: "CUSTOM", filtersJson: {}, questionIds: [] },
    select: { id: true },
  });

  for (let index = 0; index < 12; index += 1) {
    const isCorrect = index < 6 || index >= 10;

    await prisma.questionAttempt.create({
      data: {
        userId: studentId,
        questionId: `${PREFIX}-q-${String(index)}`,
        questionVersion: 1,
        questionSnapshot: {},
        practiceSessionId: session.id,
        isCorrect,
        marksAwarded: isCorrect ? 1 : 0,
        marksPossible: 1,
        evaluationMode: "AUTO",
        timeSpentMs: 60_000,
      },
    });
  }

  await prisma.studyDay.create({
    data: {
      userId: studentId,
      day: new Date(new Date().toISOString().slice(0, 10)),
      attempts: 12,
      correct: 8,
      marksEarned: 8,
      marksPossible: 12,
    },
  });
}

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.subjectProgress.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.studyDay.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.subjectEnrolment.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.studentProfile.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
