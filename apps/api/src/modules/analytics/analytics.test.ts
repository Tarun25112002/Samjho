import { recordEventsResultSchema, successResponseSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Learning analytics, and the line it must not cross.
 *
 * Every user of this product is 14-16 (docs/07 R6), the DPDP Act prohibits
 * behavioural tracking directed at children, and docs/06 commits to zero
 * third-party tracking. Most of this file is therefore about what the table
 * refuses to store and what a client is refused permission to assert, rather
 * than about the happy path.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "evtest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const TOPIC = `${PREFIX}-topic`;
const QUESTION = `${PREFIX}-q-0`;

let auth: string;
let stranger: string;
let studentId: string;
let strangerId: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}@example.test`, name: "Event Student" },
    select: { id: true, clerkId: true },
  });
  studentId = user.id;
  auth = await bearer({ subject: user.clerkId });

  const other = await prisma.user.create({
    data: { clerkId: `${PREFIX}_other`, email: `${PREFIX}-other@example.test` },
    select: { id: true, clerkId: true },
  });
  strangerId = other.id;
  stranger = await bearer({ subject: other.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "EVMTH",
      name: "Evtest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Ch", slug: CHAPTER, orderIndex: 0 },
  });
  await prisma.topic.create({
    data: { id: TOPIC, chapterId: CHAPTER, name: "Topic", slug: TOPIC, orderIndex: 0 },
  });

  for (let n = 0; n < 4; n += 1) {
    await prisma.question.create({
      data: {
        id: `${PREFIX}-q-${String(n)}`,
        subjectId: SUBJECT,
        chapterId: CHAPTER,
        type: "MCQ",
        body: `Q${String(n)}`,
        marks: 1,
        difficulty: "EASY",
        expectedTimeSeconds: 60,
        status: "PUBLISHED",
        options: {
          create: [
            {
              id: `${PREFIX}-q-${String(n)}-a`,
              label: "A",
              body: "R",
              isCorrect: true,
              orderIndex: 0,
            },
            { id: `${PREFIX}-q-${String(n)}-b`, label: "B", body: "W", orderIndex: 1 },
          ],
        },
        answer: { create: { correctValue: "A", solution: "s", hint: "a nudge" } },
        topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
      },
    });
  }
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.learningEvent.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
});

describe("what a browser may report", () => {
  it("stores the events it is allowed to send", async () => {
    const session = await startSet();

    const recorded = await post(auth, [
      {
        type: "QUESTION_VIEWED",
        sessionId: session,
        questionId: QUESTION,
        props: { index: 0, total: 4, dwellMs: 9000 },
      },
    ]);

    expect(recorded).toBe(1);

    const rows = await prisma.learningEvent.findMany({ where: { userId: studentId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.type).toBe("QUESTION_VIEWED");
    expect(rows[0]?.propsJson).toEqual({ index: 0, total: 4, dwellMs: 9000 });
  });

  it("refuses an event type only the server may emit", async () => {
    await request(app)
      .post("/api/v1/events")
      .set("authorization", auth)
      .send({ events: [{ type: "ASSESSMENT_COMPLETED" }] })
      .expect(400);
  });

  it("refuses a property that is not on the allow-list", async () => {
    const session = await startSet();

    await post(auth, [
      {
        type: "QUESTION_VIEWED",
        sessionId: session,
        props: { index: 1, deviceId: "abc-123", ipAddress: "10.0.0.1" },
      },
    ]);

    const row = await prisma.learningEvent.findFirstOrThrow({ where: { userId: studentId } });

    expect(row.propsJson).toEqual({ index: 1 });
    expect(JSON.stringify(row.propsJson)).not.toContain("abc-123");
    expect(JSON.stringify(row.propsJson)).not.toContain("10.0.0.1");
  });

  it("caps a batch rather than accepting an unbounded one", async () => {
    const events = Array.from({ length: 50 }, () => ({ type: "QUESTION_VIEWED" as const }));

    await request(app)
      .post("/api/v1/events")
      .set("authorization", auth)
      .send({ events })
      .expect(400);
  });
});

describe("ownership", () => {
  it("drops an event naming someone else's session", async () => {
    const mine = await startSet();

    const recorded = await post(stranger, [
      { type: "QUESTION_VIEWED", sessionId: mine, questionId: QUESTION, props: {} },
    ]);

    expect(recorded).toBe(0);
    expect(await prisma.learningEvent.count({ where: { userId: strangerId } })).toBe(0);
  });

  it("attributes an event to the token's user, never to a body field", async () => {
    await post(auth, [{ type: "RECOMMENDATION_CLICKED", props: { surface: "DASHBOARD" } }]);

    const row = await prisma.learningEvent.findFirstOrThrow({ where: { userId: studentId } });
    expect(row.userId).toBe(studentId);
  });

  it("rejects an unauthenticated report", async () => {
    await request(app)
      .post("/api/v1/events")
      .send({ events: [{ type: "QUESTION_VIEWED" }] })
      .expect(401);
  });
});

/**
 * The server's own events are written with `void`, deliberately: recording that
 * a student asked for a hint must never be the reason they did not get one. So
 * the write lands shortly *after* the response, and these assertions wait for
 * it rather than assuming the race went their way.
 *
 * Polling rather than sleeping a fixed span, so the tests are as fast as the
 * database is and still pass on a loaded machine.
 */
describe("what the server emits on its own", () => {
  it("records a started assessment against the sitting it created", async () => {
    const session = await startAssessment();
    const row = await eventually("ASSESSMENT_STARTED");

    expect(row.sessionId).toBe(session);
  });

  it("records a submitted answer, and whether it was right", async () => {
    const session = await startSet();
    await answer(session, QUESTION, true);

    const row = await eventually("ANSWER_SUBMITTED");

    expect(row.questionId).toBe(QUESTION);
    expect((row.propsJson as { correct?: boolean }).correct).toBe(true);
  });

  it("records a hint request", async () => {
    const session = await startAssessment();
    const questionId = await firstQuestionOf(session);

    await request(app)
      .post(`/api/v1/assessments/${session}/hint`)
      .set("authorization", auth)
      .send({ questionId })
      .expect(200);

    await eventually("HINT_REQUESTED");

    expect(
      await prisma.learningEvent.count({ where: { userId: studentId, type: "HINT_REQUESTED" } }),
    ).toBe(1);
  });

  it("records a completed set once, however many times Finish is tapped", async () => {
    const session = await startSet();

    await complete(session);
    await complete(session);
    await complete(session);

    await eventually("ASSESSMENT_COMPLETED");

    expect(
      await prisma.learningEvent.count({
        where: { userId: studentId, type: "ASSESSMENT_COMPLETED" },
      }),
    ).toBe(1);
  });
});

describe("recording never breaks the thing being recorded", () => {
  it("still answers the question when the event names a question that is gone", async () => {
    const session = await startSet();

    const recorded = await post(auth, [
      { type: "QUESTION_VIEWED", sessionId: session, questionId: "no-such-question", props: {} },
    ]);

    // The foreign key rejects it, the service swallows it, and the endpoint
    // still answers rather than turning a note into a 500.
    expect(recorded).toBe(0);
  });
});

async function eventually(
  type: "ASSESSMENT_STARTED" | "ANSWER_SUBMITTED" | "HINT_REQUESTED" | "ASSESSMENT_COMPLETED",
) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const row = await prisma.learningEvent.findFirst({ where: { userId: studentId, type } });
    if (row) return row;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`No ${type} event was recorded within two seconds`);
}

async function post(token: string, events: unknown[]): Promise<number> {
  const response = await request(app)
    .post("/api/v1/events")
    .set("authorization", token)
    .send({ events })
    .expect(202);

  return successResponseSchema(recordEventsResultSchema).parse(response.body).data.recorded;
}

async function startSet(): Promise<string> {
  const response = await request(app)
    .post("/api/v1/practice-sessions")
    .set("authorization", auth)
    .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 4 })
    .expect(201);

  return (response.body as { data: { id: string } }).data.id;
}

async function startAssessment(): Promise<string> {
  const response = await request(app)
    .post("/api/v1/assessments")
    .set("authorization", auth)
    .send({ objective: "DIAGNOSTIC_FUNDAMENTALS", subjectId: SUBJECT, count: 5 })
    .expect(201);

  return (response.body as { data: { id: string } }).data.id;
}

async function firstQuestionOf(sessionId: string): Promise<string> {
  const session = await prisma.practiceSession.findUniqueOrThrow({
    where: { id: sessionId },
    select: { questionIds: true },
  });

  return session.questionIds[0] ?? "";
}

async function answer(sessionId: string, questionId: string, correct: boolean): Promise<void> {
  await request(app)
    .post(`/api/v1/practice-sessions/${sessionId}/attempts`)
    .set("authorization", auth)
    .send({
      questionId,
      responses: [
        {
          targetId: questionId,
          answer: { optionIds: [`${questionId}-${correct ? "a" : "b"}`], text: "" },
        },
      ],
      timeSpentMs: 30_000,
    })
    .expect(200);
}

async function complete(sessionId: string): Promise<void> {
  await request(app)
    .post(`/api/v1/practice-sessions/${sessionId}/complete`)
    .set("authorization", auth)
    .expect(200);
}

async function cleanUp(): Promise<void> {
  await prisma.learningEvent.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.bookmark.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
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
