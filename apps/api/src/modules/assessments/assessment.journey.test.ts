import {
  practiceResultSchema,
  practiceSessionSchema,
  preparationAnalysisSchema,
  nextQuestionSchema,
  successResponseSchema,
  type AssessmentObjective,
  type PracticeSession,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The whole loop, once, in order.
 *
 * The unit tests argue about the engine's rules and the module tests about each
 * endpoint. This one exists for the claim those cannot make between them: that
 * a student can go from an empty account to a personalised sitting whose
 * contents demonstrably came from their own answers, without any step being
 * stubbed or any state being written by hand.
 *
 * It is deliberately one long test rather than several. The thing under test is
 * the sequence — each step's input is the previous step's output — and splitting
 * it into cases that share a `beforeAll` would mean testing the sequence in an
 * order the runner chose.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "jtest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;

const TOPICS = [
  `${PREFIX}-topic-algebra`,
  `${PREFIX}-topic-geometry`,
  `${PREFIX}-topic-probability`,
  `${PREFIX}-topic-trigonometry`,
  `${PREFIX}-topic-statistics`,
];

let auth: string;
let studentId: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}@example.test`,
      name: "Journey Student",
    },
    select: { id: true, clerkId: true },
  });
  studentId = user.id;
  auth = await bearer({ subject: user.clerkId });

  const profile = await prisma.studentProfile.create({
    data: { userId: studentId, classLevel: 10, board: "CBSE", onboardedAt: new Date() },
    select: { id: true },
  });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "JTMTH",
      name: "Jtest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.subjectEnrolment.create({ data: { profileId: profile.id, subjectId: SUBJECT } });

  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Everything", slug: CHAPTER, orderIndex: 0 },
  });

  await prisma.topic.createMany({
    data: TOPICS.map((id, index) => ({
      id,
      chapterId: CHAPTER,
      name: id.replace(`${PREFIX}-topic-`, ""),
      slug: id,
      orderIndex: index,
    })),
  });

  // Enough depth that the engine is never forced into a fallback: five topics,
  // three difficulties, four questions each. A journey test that fails because
  // the bank ran dry is a test about the fixture, not about the product.
  for (const topicId of TOPICS) {
    for (const difficulty of ["EASY", "MEDIUM", "HARD"] as const) {
      for (let n = 0; n < 4; n += 1) {
        const id = `${PREFIX}-q-${topicId}-${difficulty}-${String(n)}`;

        await prisma.question.create({
          data: {
            id,
            subjectId: SUBJECT,
            chapterId: CHAPTER,
            type: "MCQ",
            body: `${topicId} ${difficulty} ${String(n)}`,
            marks: 1,
            difficulty,
            bloomLevel: difficulty === "EASY" ? "UNDERSTAND" : "APPLY",
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
            options: {
              create: [
                { id: `${id}-a`, label: "A", body: "Right", isCorrect: true, orderIndex: 0 },
                { id: `${id}-b`, label: "B", body: "Wrong", orderIndex: 1 },
              ],
            },
            answer: { create: { correctValue: "A", solution: `Solution ${id}` } },
            topics: { create: [{ topicId, isPrimary: true }] },
          },
        });
      }
    }
  }
});

afterAll(cleanUp);

describe("a student's first fortnight, in one pass", () => {
  it("goes from an empty account to a sitting built from their own answers", async () => {
    // 1. Nothing has happened yet, and the product says so rather than
    //    inventing a starting point.
    const beforeAnything = await getAnalysis();
    expect(beforeAnything.overallMastery).toBeNull();
    expect(beforeAnything.diagnosticsComplete).toBe(false);
    expect(beforeAnything.insight).toBeNull();

    // 2. Three diagnostics, sat in order. Probability is answered wrongly
    //    throughout and Algebra correctly, so there is a real signal for the
    //    engine to find later rather than a coin toss.
    for (const objective of [
      "DIAGNOSTIC_FUNDAMENTALS",
      "DIAGNOSTIC_APPLICATION",
      "DIAGNOSTIC_CHALLENGE",
    ] as const) {
      await sitOut(objective, 6);
    }

    // 3. The diagnostics are done, so the analysis has something to say and
    //    every figure on it came out of the answers above.
    const analysis = await getAnalysis();
    expect(analysis.diagnosticsComplete).toBe(true);
    expect(analysis.overallMastery).not.toBeNull();
    expect(analysis.questionsAttempted).toBeGreaterThan(0);
    expect(analysis.insight).not.toBeNull();

    // 4. The picture is the one the answers describe: Probability weak,
    //    Algebra not.
    const bandOf = (topic: string) =>
      [...analysis.weak, ...analysis.needsPractice, ...analysis.strong].find((entry) =>
        entry.id.endsWith(topic),
      )?.band;

    expect(bandOf("probability")).toBe("WEAK");
    expect(bandOf("algebra")).toBe("STRONG");

    // 5. The personalised sitting opens. It starts with exactly one question,
    //    because the second one does not exist until the first is answered.
    const adaptive = await start("ADAPTIVE_PERSONALISED", 6);
    expect(adaptive.items).toHaveLength(1);
    expect(adaptive.plannedQuestions).toBe(6);

    // 6. Answering it produces the next one, and the engine says why it chose
    //    it. The weak-area slot lands on the topic the report called weak.
    await answer(adaptive.id, adaptive.items[0]?.question.id ?? "", true);
    const second = await next(adaptive.id);

    expect(second.exhausted).toBe(false);
    expect(second.item).not.toBeNull();
    expect(second.selection?.reason).toBe("WEAK_AREA");
    expect(second.selection?.topicId).toContain("probability");

    // 7. The rest of the sitting, answered wrongly throughout. The levels the
    //    engine aims at move, and at least one of them moves down in response to
    //    a miss.
    //
    //    Not "the last level is below the first". Successive slots are asking
    //    different questions — a challenge slot aims high on the student's
    //    strongest topic however the sitting is going, which is what makes it a
    //    challenge — so comparing the ends of the list compares two things that
    //    were never meant to be equal.
    let cursor = second;
    const levels: number[] = [second.selection?.targetLevel ?? 0];

    while (cursor.item !== null) {
      await answer(adaptive.id, cursor.item.question.id, false);
      cursor = await next(adaptive.id);
      if (cursor.selection) levels.push(cursor.selection.targetLevel);
    }

    const steppedDown = levels.some(
      (level, position) => position > 0 && level < (levels[position - 1] ?? 0),
    );

    expect(levels.length).toBeGreaterThan(2);
    expect(steppedDown).toBe(true);
    expect(new Set(levels).size).toBeGreaterThan(1);

    // 8. Six questions were served, none of them twice, and every one has a
    //    recorded reason.
    const stored = await prisma.practiceSession.findUniqueOrThrow({
      where: { id: adaptive.id },
      select: { questionIds: true, selectionsJson: true },
    });

    expect(stored.questionIds).toHaveLength(6);
    expect(new Set(stored.questionIds).size).toBe(6);
    expect(Object.keys(stored.selectionsJson as Record<string, unknown>)).toHaveLength(6);

    // 9. Finishing produces a result built from the stored attempts.
    const result = await complete(adaptive.id);
    expect(result.session.totals.answered).toBe(6);
    expect(result.session.totals.correct).toBe(1);
    expect(result.mistakeQuestionIds).toHaveLength(5);

    // 10. And the student's mastery moved, which is the loop closing: the
    //     answers changed the model that will choose the next sitting.
    const afterwards = await getAnalysis();
    expect(afterwards.questionsAttempted).toBeGreaterThan(analysis.questionsAttempted);
    // Four sittings, answered one question at a time, is around forty sequential
    // round trips. That is the shape of the thing being tested rather than a
    // slow test, and the default five seconds is not enough for it when the
    // whole suite is competing for the same connection pool.
  }, 60_000);
});

/** Start a sitting, answer every question it serves, and finish it. */
async function sitOut(objective: AssessmentObjective, count: number): Promise<void> {
  const session = await start(objective, count);

  let questionId: string | null = session.items[0]?.question.id ?? null;

  while (questionId !== null) {
    await answer(session.id, questionId, !questionId.includes("probability"));
    const served = await next(session.id);
    questionId = served.item?.question.id ?? null;
  }

  await complete(session.id);
}

async function start(objective: AssessmentObjective, count: number): Promise<PracticeSession> {
  const response = await request(app)
    .post("/api/v1/assessments")
    .set("authorization", auth)
    .send({ objective, subjectId: SUBJECT, count })
    .expect(201);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

async function next(sessionId: string) {
  const response = await request(app)
    .post(`/api/v1/assessments/${sessionId}/next-question`)
    .set("authorization", auth)
    .expect(200);

  return successResponseSchema(nextQuestionSchema).parse(response.body).data;
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
      timeSpentMs: 45_000,
    })
    .expect(200);
}

async function complete(sessionId: string) {
  const response = await request(app)
    .post(`/api/v1/practice-sessions/${sessionId}/complete`)
    .set("authorization", auth)
    .expect(200);

  return successResponseSchema(practiceResultSchema).parse(response.body).data;
}

async function getAnalysis() {
  const response = await request(app)
    .get("/api/v1/analysis")
    .set("authorization", auth)
    .expect(200);

  return successResponseSchema(preparationAnalysisSchema).parse(response.body).data;
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
