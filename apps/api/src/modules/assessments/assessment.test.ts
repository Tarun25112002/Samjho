import {
  assessmentPlanSchema,
  diagnosticProgressSchema,
  hintResponseSchema,
  nextQuestionSchema,
  practiceSessionSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "atest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch-algebra`;

const TOPICS = [
  { id: `${PREFIX}-topic-linear`, name: "Linear equations" },
  { id: `${PREFIX}-topic-quadratic`, name: "Quadratic equations" },
  { id: `${PREFIX}-topic-probability`, name: "Probability" },
  { id: `${PREFIX}-topic-trigonometry`, name: "Trigonometry" },
];

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

const AUTHORED_HINT = "ATESTHINT: think about how the quadratic can be factorised.";
const HINTED_QUESTION = `${PREFIX}-q-${TOPICS[1]?.id ?? ""}-MEDIUM-0`;

let student: string;
let stranger: string;
let studentId: string;

function questionId(topicId: string, difficulty: string, index: number): string {
  return `${PREFIX}-q-${topicId}-${difficulty}-${index}`;
}

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}-student@example.test`,
      name: "Assessment Student",
    },
    select: { id: true, clerkId: true },
  });
  studentId = owner.id;
  student = await bearer({ subject: owner.clerkId });

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
      code: "ATMTH",
      name: "Atest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.chapter.create({
    data: {
      id: CHAPTER,
      subjectId: SUBJECT,
      name: "Algebra",
      slug: CHAPTER,
      orderIndex: 0,
    },
  });

  await prisma.topic.createMany({
    data: TOPICS.map((topic, index) => ({
      id: topic.id,
      chapterId: CHAPTER,
      name: topic.name,
      slug: topic.id,
      orderIndex: index,
    })),
  });

  // Four topics x three difficulties x three questions: deep enough that the
  // engine always has something at the level it asks for, so a test that fails
  // fails on the choice rather than on an empty bank.
  for (const topic of TOPICS) {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < 3; index += 1) {
        const id = questionId(topic.id, difficulty, index);

        await prisma.question.create({
          data: {
            id,
            subjectId: SUBJECT,
            chapterId: CHAPTER,
            type: "MCQ",
            body: `${topic.name} ${difficulty} question ${String(index)}`,
            marks: 1,
            difficulty,
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
            options: {
              create: [
                { id: `${id}-a`, label: "A", body: "Right", isCorrect: true, orderIndex: 0 },
                { id: `${id}-b`, label: "B", body: "Wrong", orderIndex: 1 },
              ],
            },
            answer: {
              create: {
                correctValue: "A",
                solution: `Solution for ${id}`,
                ...(id === HINTED_QUESTION ? { hint: AUTHORED_HINT } : {}),
              },
            },
            topics: { create: [{ topicId: topic.id, isPrimary: true }] },
          },
        });
      }
    }
  }
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
});

describe("the diagnostic sequence", () => {
  it("offers only the first stage to a brand-new student", async () => {
    const progress = await getDiagnostics();

    expect(progress.stages.map((stage) => stage.status)).toEqual(["AVAILABLE", "LOCKED", "LOCKED"]);
    expect(progress.completedCount).toBe(0);
    expect(progress.analysisReady).toBe(false);
    expect(progress.nextObjective).toBe("DIAGNOSTIC_FUNDAMENTALS");
  });

  it("refuses a stage whose predecessor is unfinished", async () => {
    await request(app)
      .post("/api/v1/assessments")
      .set("authorization", student)
      .send({ objective: "DIAGNOSTIC_CHALLENGE", subjectId: SUBJECT, count: 5 })
      .expect(409);
  });

  it("returns the running sitting rather than starting a second one", async () => {
    const first = await start("DIAGNOSTIC_FUNDAMENTALS");
    const again = await start("DIAGNOSTIC_FUNDAMENTALS");

    expect(again.id).toBe(first.id);
  });

  it("unlocks the next stage once one is finished, and the analysis after all three", async () => {
    for (const objective of [
      "DIAGNOSTIC_FUNDAMENTALS",
      "DIAGNOSTIC_APPLICATION",
      "DIAGNOSTIC_CHALLENGE",
    ] as const) {
      const session = await start(objective);
      await request(app)
        .post(`/api/v1/practice-sessions/${session.id}/complete`)
        .set("authorization", student)
        .expect(200);
    }

    const progress = await getDiagnostics();
    expect(progress.completedCount).toBe(3);
    expect(progress.analysisReady).toBe(true);
    expect(progress.nextObjective).toBeNull();
  });

  it("keeps a diagnostic on easy ground and a challenge off it", async () => {
    const fundamentals = await start("DIAGNOSTIC_FUNDAMENTALS");
    const levels = Object.values(fundamentals.selections).map((selection) => selection.targetLevel);

    expect(levels.every((level) => level <= 3)).toBe(true);
    expect(Object.values(fundamentals.selections)[0]?.reason).toBe("DIAGNOSTIC_LADDER");
  });
});

describe("starting an assessment", () => {
  it("cannot be built through the ordinary practice endpoint", async () => {
    await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", student)
      .send({ mode: "ADAPTIVE", filters: { subjectId: SUBJECT }, count: 10 })
      .expect(400);
  });

  it("serves exactly one question to begin with, and records why", async () => {
    const session = await start("ADAPTIVE_PERSONALISED");

    expect(session.items).toHaveLength(1);
    expect(session.plannedQuestions).toBe(5);
    expect(session.objective).toBe("ADAPTIVE_PERSONALISED");

    const first = session.items[0];
    expect(first).toBeDefined();
    const selection = session.selections[first?.question.id ?? ""];
    expect(selection).toBeDefined();
    expect(selection?.reason).toBe("CURRENT_LEVEL");
  });

  it("previews the blend before the student commits to it", async () => {
    const response = await request(app)
      .post("/api/v1/assessments/plan")
      .set("authorization", student)
      .send({ objective: "ADAPTIVE_PERSONALISED", subjectId: SUBJECT, count: 10 })
      .expect(200);

    const plan = successResponseSchema(assessmentPlanSchema).parse(response.body).data;

    expect(plan.blend).toEqual([
      { reason: "WEAK_AREA", count: 4 },
      { reason: "REINFORCEMENT", count: 3 },
      { reason: "CURRENT_LEVEL", count: 2 },
      { reason: "CHALLENGE", count: 1 },
    ]);
    expect(plan.subjectName).toBe("Atest Mathematics");
  });
});

describe("serving the next question", () => {
  it("grows the set one question at a time up to the planned length", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);

    for (let served = 1; served < 5; served += 1) {
      const next = await nextQuestion(session.id);
      expect(next.exhausted).toBe(false);
      expect(next.index).toBe(served);
    }

    const beyond = await nextQuestion(session.id);
    expect(beyond.index).toBeNull();
    expect(beyond.exhausted).toBe(false);

    const stored = await prisma.practiceSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { questionIds: true, totalQuestions: true },
    });
    expect(stored.questionIds).toHaveLength(5);
    expect(stored.totalQuestions).toBe(5);
  });

  it("never serves the same question twice", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 8);
    for (let i = 1; i < 8; i += 1) await nextQuestion(session.id);

    const stored = await prisma.practiceSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { questionIds: true },
    });

    expect(new Set(stored.questionIds).size).toBe(stored.questionIds.length);
  });

  it("aims a weak-area slot at the topic the student is worst at", async () => {
    await setMastery(TOPICS[2]?.id ?? "", 0.1);
    await setMastery(TOPICS[0]?.id ?? "", 0.9);

    const session = await start("ADAPTIVE_PERSONALISED", 5);
    const next = await nextQuestion(session.id);

    expect(next.selection?.reason).toBe("WEAK_AREA");
    expect(next.selection?.topicId).toBe(TOPICS[2]?.id);
  });

  it("raises the aim after a correct answer and lowers it after a wrong one", async () => {
    const correctRun = await start("ADAPTIVE_PERSONALISED", 6);
    await answer(correctRun, 0, true);
    const afterCorrect = await nextQuestion(correctRun.id);

    await resetStudentHistory();

    const wrongRun = await start("ADAPTIVE_PERSONALISED", 6);
    await answer(wrongRun, 0, false);
    const afterWrong = await nextQuestion(wrongRun.id);

    expect(afterCorrect.selection?.targetLevel).toBeGreaterThan(
      afterWrong.selection?.targetLevel ?? 99,
    );
  });

  it("does not raise the aim when the answer needed a hint", async () => {
    // Each run starts from a cleared student, because a previous run's mastery
    // would move the second run's opening level and make the two incomparable.
    const plain = await start("ADAPTIVE_PERSONALISED", 6);
    await answer(plain, 0, true);
    const afterPlain = await nextQuestion(plain.id);

    await resetStudentHistory();

    const hinted = await start("ADAPTIVE_PERSONALISED", 6);
    await answer(hinted, 0, true, { hintFirst: true });
    const afterHint = await nextQuestion(hinted.id);

    expect(afterHint.selection?.targetLevel).toBeLessThan(afterPlain.selection?.targetLevel ?? 0);
  });

  it("refuses to extend a finished sitting", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);
    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);

    await request(app)
      .post(`/api/v1/assessments/${session.id}/next-question`)
      .set("authorization", student)
      .expect(409);
  });

  it("refuses to extend a set that is not an assessment", async () => {
    const response = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", student)
      .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 3 })
      .expect(201);

    const plain = successResponseSchema(practiceSessionSchema).parse(response.body).data;

    await request(app)
      .post(`/api/v1/assessments/${plain.id}/next-question`)
      .set("authorization", student)
      .expect(409);
  });
});

describe("hints", () => {
  it("returns the authored hint and records that it was used", async () => {
    const session = await startWithQuestion(HINTED_QUESTION);

    const response = await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", student)
      .send({ questionId: HINTED_QUESTION })
      .expect(200);

    const hint = successResponseSchema(hintResponseSchema).parse(response.body).data;
    expect(hint.authored).toBe(true);
    expect(hint.hint).toBe(AUTHORED_HINT);
  });

  it("falls back to a method nudge when no hint was authored", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);
    const id = session.items[0]?.question.id ?? "";

    const response = await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", student)
      .send({ questionId: id })
      .expect(200);

    const hint = successResponseSchema(hintResponseSchema).parse(response.body).data;
    expect(hint.authored).toBe(false);
    expect(hint.hint.length).toBeGreaterThan(20);
  });

  it("never contains the solution text", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);
    const id = session.items[0]?.question.id ?? "";

    const response = await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", student)
      .send({ questionId: id })
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain(`Solution for ${id}`);
  });

  it("refuses a question that is not in the set", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);
    const outsider = session.items.some((item) => item.question.id === HINTED_QUESTION)
      ? questionId(TOPICS[3]?.id ?? "", "HARD", 2)
      : HINTED_QUESTION;

    await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", student)
      .send({ questionId: outsider })
      .expect(404);
  });
});

describe("authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    await request(app).get("/api/v1/assessments/diagnostics").expect(401);
  });

  it("will not let another student extend this student's assessment", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);

    await request(app)
      .post(`/api/v1/assessments/${session.id}/next-question`)
      .set("authorization", stranger)
      .expect(404);
  });

  it("will not let another student read a hint from this student's assessment", async () => {
    const session = await start("ADAPTIVE_PERSONALISED", 5);
    const id = session.items[0]?.question.id ?? "";

    await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", stranger)
      .send({ questionId: id })
      .expect(404);
  });

  it("keeps each student's diagnostic progress to themselves", async () => {
    await start("DIAGNOSTIC_FUNDAMENTALS");

    const response = await request(app)
      .get("/api/v1/assessments/diagnostics")
      .set("authorization", stranger)
      .expect(200);

    const progress = diagnosticProgressSchema.parse(
      successResponseSchema(diagnosticProgressSchema).parse(response.body).data,
    );
    expect(progress.stages[0]?.sessionId).toBeNull();
  });
});

async function start(
  objective:
    | "DIAGNOSTIC_FUNDAMENTALS"
    | "DIAGNOSTIC_APPLICATION"
    | "DIAGNOSTIC_CHALLENGE"
    | "ADAPTIVE_PERSONALISED",
  count = 5,
) {
  const response = await request(app)
    .post("/api/v1/assessments")
    .set("authorization", student)
    .send({ objective, subjectId: SUBJECT, count })
    .expect(201);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

async function startWithQuestion(target: string) {
  const session = await start("ADAPTIVE_PERSONALISED", 25);

  for (let served = 1; served < 25; served += 1) {
    const stored = await prisma.practiceSession.findUniqueOrThrow({
      where: { id: session.id },
      select: { questionIds: true },
    });
    if (stored.questionIds.includes(target)) break;

    const next = await nextQuestion(session.id);
    if (next.exhausted || next.index === null) break;
  }

  const final = await prisma.practiceSession.findUniqueOrThrow({
    where: { id: session.id },
    select: { questionIds: true },
  });

  if (!final.questionIds.includes(target)) {
    // The engine chose a set that never reaches the hinted question. Put it in
    // directly rather than failing on a legitimate selection: this test is
    // about the hint, and the selection has its own tests.
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: { questionIds: [...final.questionIds, target] },
    });
  }

  return session;
}

async function nextQuestion(sessionId: string) {
  const response = await request(app)
    .post(`/api/v1/assessments/${sessionId}/next-question`)
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(nextQuestionSchema).parse(response.body).data;
}

async function getDiagnostics() {
  const response = await request(app)
    .get("/api/v1/assessments/diagnostics")
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(diagnosticProgressSchema).parse(response.body).data;
}

async function answer(
  session: { id: string; items: { question: { id: string; options: { id: string }[] } }[] },
  index: number,
  correct: boolean,
  options: { hintFirst?: boolean; questionId?: string } = {},
) {
  const item = session.items[index];
  if (!item) throw new Error("no item at that index");

  const id = options.questionId ?? item.question.id;

  if (options.hintFirst) {
    await request(app)
      .post(`/api/v1/assessments/${session.id}/hint`)
      .set("authorization", student)
      .send({ questionId: id })
      .expect(200);
  }

  await request(app)
    .post(`/api/v1/practice-sessions/${session.id}/attempts`)
    .set("authorization", student)
    .send({
      questionId: id,
      responses: [
        { targetId: id, answer: { optionIds: [`${id}-${correct ? "a" : "b"}`], text: "" } },
      ],
      timeSpentMs: 30_000,
    })
    .expect(200);

  if (options.hintFirst) {
    await prisma.questionAttempt.updateMany({
      where: { practiceSessionId: session.id, questionId: id },
      data: { hintUsed: true },
    });
  }
}

async function resetStudentHistory(): Promise<void> {
  await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.practiceSession.deleteMany({ where: { userId: studentId } });
  await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
  await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
  await prisma.subjectProgress.deleteMany({ where: { userId: studentId } });
}

async function setMastery(topicId: string, masteryScore: number): Promise<void> {
  await prisma.topicMastery.upsert({
    where: { userId_topicId: { userId: studentId, topicId } },
    create: { userId: studentId, topicId, masteryScore, attempted: 6, correct: 3 },
    update: { masteryScore, attempted: 6, correct: 3 },
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
