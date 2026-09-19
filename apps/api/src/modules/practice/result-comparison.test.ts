import { practiceResultSchema, successResponseSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * "78% — up 6% from your previous assessment", and what has to be true for that
 * sentence to be worth printing.
 *
 * The comparison is only ever against a *comparable* sitting, and these tests
 * are mostly about that word: a diagnostic against the same diagnostic, an
 * adaptive sitting against the last adaptive one, an ordinary set against the
 * last ordinary set. A student told they are down nine points against a
 * different kind of exercise has been given a number that means nothing and
 * reads like a judgement.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "rctest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const TOPIC_A = `${PREFIX}-topic-algebra`;
const TOPIC_B = `${PREFIX}-topic-probability`;

let auth: string;
let studentId: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}@example.test`, name: "Result Student" },
    select: { id: true, clerkId: true },
  });
  studentId = user.id;
  auth = await bearer({ subject: user.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "RCMTH",
      name: "Rctest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Algebra", slug: CHAPTER, orderIndex: 0 },
  });

  await prisma.topic.createMany({
    data: [
      { id: TOPIC_A, chapterId: CHAPTER, name: "Algebra", slug: TOPIC_A, orderIndex: 0 },
      { id: TOPIC_B, chapterId: CHAPTER, name: "Probability", slug: TOPIC_B, orderIndex: 1 },
    ],
  });

  for (const topicId of [TOPIC_A, TOPIC_B]) {
    for (let n = 0; n < 8; n += 1) {
      await prisma.question.create({
        data: {
          id: `${PREFIX}-q-${topicId}-${String(n)}`,
          subjectId: SUBJECT,
          chapterId: CHAPTER,
          type: "MCQ",
          body: `${topicId} ${String(n)}`,
          marks: 1,
          difficulty: "MEDIUM",
          expectedTimeSeconds: 60,
          status: "PUBLISHED",
          answer: { create: { correctValue: "A", solution: "s" } },
          topics: { create: [{ topicId, isPrimary: true }] },
        },
      });
    }
  }
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.practiceSession.deleteMany({ where: { userId: studentId } });
  await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
  await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
});

describe("the first sitting of its kind", () => {
  it("reports no comparison rather than a change from zero", async () => {
    const session = await sitting({ mode: "CUSTOM", earned: 5, possible: 10 });
    const result = await getResult(session);

    expect(result.scorePercent).toBe(50);
    expect(result.previous).toBeNull();
    expect(result.deltaPercent).toBeNull();
  });
});

describe("comparing against the previous sitting", () => {
  it("reports the gain when the student did better", async () => {
    await sitting({ mode: "CUSTOM", earned: 5, possible: 10, daysAgo: 7 });
    const latest = await sitting({ mode: "CUSTOM", earned: 8, possible: 10 });

    const result = await getResult(latest);

    expect(result.previous?.scorePercent).toBe(50);
    expect(result.scorePercent).toBe(80);
    expect(result.deltaPercent).toBe(30);
  });

  it("reports the loss just as plainly", async () => {
    await sitting({ mode: "CUSTOM", earned: 9, possible: 10, daysAgo: 7 });
    const latest = await sitting({ mode: "CUSTOM", earned: 6, possible: 10 });

    expect((await getResult(latest)).deltaPercent).toBe(-30);
  });

  it("reports zero when nothing changed", async () => {
    await sitting({ mode: "CUSTOM", earned: 7, possible: 10, daysAgo: 7 });
    const latest = await sitting({ mode: "CUSTOM", earned: 7, possible: 10 });

    expect((await getResult(latest)).deltaPercent).toBe(0);
  });

  it("picks the most recent comparable sitting, not the oldest", async () => {
    await sitting({ mode: "CUSTOM", earned: 2, possible: 10, daysAgo: 30 });
    await sitting({ mode: "CUSTOM", earned: 6, possible: 10, daysAgo: 2 });
    const latest = await sitting({ mode: "CUSTOM", earned: 7, possible: 10 });

    expect((await getResult(latest)).previous?.scorePercent).toBe(60);
  });
});

describe("what counts as comparable", () => {
  it("compares a diagnostic with the same diagnostic, not with a different one", async () => {
    await sitting({
      mode: "DIAGNOSTIC",
      objective: "DIAGNOSTIC_FUNDAMENTALS",
      earned: 9,
      possible: 10,
      daysAgo: 10,
    });
    await sitting({
      mode: "DIAGNOSTIC",
      objective: "DIAGNOSTIC_APPLICATION",
      earned: 2,
      possible: 10,
      daysAgo: 5,
    });

    const latest = await sitting({
      mode: "DIAGNOSTIC",
      objective: "DIAGNOSTIC_FUNDAMENTALS",
      earned: 10,
      possible: 10,
    });

    const result = await getResult(latest);
    expect(result.previous?.scorePercent).toBe(90);
    expect(result.deltaPercent).toBe(10);
  });

  it("does not compare an adaptive sitting against an ordinary practice set", async () => {
    await sitting({ mode: "CUSTOM", earned: 1, possible: 10, daysAgo: 3 });
    const latest = await sitting({
      mode: "ADAPTIVE",
      objective: "ADAPTIVE_PERSONALISED",
      earned: 8,
      possible: 10,
    });

    expect((await getResult(latest)).previous).toBeNull();
  });

  it("ignores a sitting that was never finished", async () => {
    await sitting({ mode: "CUSTOM", earned: 2, possible: 10, daysAgo: 4, status: "IN_PROGRESS" });
    const latest = await sitting({ mode: "CUSTOM", earned: 7, possible: 10 });

    expect((await getResult(latest)).previous).toBeNull();
  });

  it("ignores a sitting worth no marks, which would divide by zero", async () => {
    await sitting({ mode: "CUSTOM", earned: 0, possible: 0, daysAgo: 4 });
    const latest = await sitting({ mode: "CUSTOM", earned: 7, possible: 10 });

    expect((await getResult(latest)).previous).toBeNull();
  });
});

describe("topic movement", () => {
  it("measures this set against what the student did on the topic before it", async () => {
    // Two of four right on Algebra, a week ago.
    const before = await sitting({ mode: "CUSTOM", earned: 0, possible: 0, daysAgo: 7 });
    await attempts(before, TOPIC_A, [true, true, false, false], daysAgo(7));

    // Three of four right on the same topic, today.
    const latest = await sitting({ mode: "CUSTOM", earned: 3, possible: 4 });
    await attempts(latest, TOPIC_A, [true, true, true, false], new Date(), 4);
    await recount(latest);

    const movement = (await getResult(latest)).movements.find((entry) => entry.topicId === TOPIC_A);

    expect(movement?.before).toBeCloseTo(0.5);
    expect(movement?.after).toBeCloseTo(0.75);
  });

  it("reports a topic with no history as new rather than as an improvement", async () => {
    const latest = await sitting({ mode: "CUSTOM", earned: 2, possible: 4 });
    await attempts(latest, TOPIC_B, [true, true, false, false], new Date());
    await recount(latest);

    const movement = (await getResult(latest)).movements.find((entry) => entry.topicId === TOPIC_B);

    expect(movement?.before).toBeNull();
    expect(movement?.after).toBeCloseTo(0.5);
  });

  it("puts the biggest improvement first and a brand-new topic last", async () => {
    const before = await sitting({ mode: "CUSTOM", earned: 0, possible: 0, daysAgo: 7 });
    await attempts(before, TOPIC_A, [false, false, false, false], daysAgo(7));

    const latest = await sitting({ mode: "CUSTOM", earned: 6, possible: 8 });
    await attempts(latest, TOPIC_A, [true, true, true, true], new Date(), 4);
    await attempts(latest, TOPIC_B, [true, true, false, false], new Date());
    await recount(latest);

    const movements = (await getResult(latest)).movements;

    expect(movements[0]?.topicId).toBe(TOPIC_A);
    expect(movements.at(-1)?.topicId).toBe(TOPIC_B);
  });
});

describe("authorization", () => {
  it("will not show one student another's comparison", async () => {
    const other = await prisma.user.create({
      data: { clerkId: `${PREFIX}_other`, email: `${PREFIX}-other@example.test` },
      select: { clerkId: true },
    });
    const stranger = await bearer({ subject: other.clerkId });

    const session = await sitting({ mode: "CUSTOM", earned: 5, possible: 10 });

    await request(app)
      .get(`/api/v1/practice-sessions/${session}/result`)
      .set("authorization", stranger)
      .expect(404);
  });
});

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

async function sitting(data: {
  mode: "CUSTOM" | "DIAGNOSTIC" | "ADAPTIVE";
  objective?: "DIAGNOSTIC_FUNDAMENTALS" | "DIAGNOSTIC_APPLICATION" | "ADAPTIVE_PERSONALISED";
  earned: number;
  possible: number;
  daysAgo?: number;
  status?: "COMPLETED" | "IN_PROGRESS";
}): Promise<string> {
  const startedAt = daysAgo(data.daysAgo ?? 0);

  const session = await prisma.practiceSession.create({
    data: {
      userId: studentId,
      mode: data.mode,
      ...(data.objective === undefined ? {} : { objective: data.objective }),
      filtersJson: {},
      questionIds: [],
      status: data.status ?? "COMPLETED",
      startedAt,
      completedAt: data.status === "IN_PROGRESS" ? null : startedAt,
      marksEarned: data.earned,
      marksPossible: data.possible,
      answered: data.possible,
      correct: data.earned,
    },
    select: { id: true },
  });

  return session.id;
}

async function attempts(
  sessionId: string,
  topicId: string,
  outcomes: boolean[],
  at: Date,
  offset = 0,
): Promise<void> {
  for (const [index, isCorrect] of outcomes.entries()) {
    const questionId = `${PREFIX}-q-${topicId}-${String(index + offset)}`;

    await prisma.questionAttempt.create({
      data: {
        userId: studentId,
        questionId,
        questionVersion: 1,
        questionSnapshot: {},
        practiceSessionId: sessionId,
        isCorrect,
        marksAwarded: isCorrect ? 1 : 0,
        marksPossible: 1,
        evaluationMode: "AUTO",
        attemptedAt: at,
      },
    });
  }
}

/** Point the session at the questions its attempts used, so hydration works. */
async function recount(sessionId: string): Promise<void> {
  const rows = await prisma.questionAttempt.findMany({
    where: { practiceSessionId: sessionId },
    select: { questionId: true },
  });

  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { questionIds: rows.map((row) => row.questionId) },
  });
}

async function getResult(sessionId: string) {
  const response = await request(app)
    .get(`/api/v1/practice-sessions/${sessionId}/result`)
    .set("authorization", auth)
    .expect(200);

  return successResponseSchema(practiceResultSchema).parse(response.body).data;
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
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
