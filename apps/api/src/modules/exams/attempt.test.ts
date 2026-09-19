import {
  examAttemptSchema,
  examResultSchema,
  saveExamAnswerResultSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";
import { examAttemptService } from "./attempt.service.js";

/**
 * The exam engine, against the failure matrix in docs/04 §7.
 *
 * That matrix is the reason this file exists and is the reason it is long.
 * Every row in it names a way a three-hour high-stakes attempt can be lost —
 * a refresh, two tabs, a slept laptop, a changed system clock, a double-tapped
 * Submit, a student who never comes back — and the design's answer to each is
 * a specific mechanism rather than a hope. A mechanism nobody tested is a hope.
 *
 * The other thing asserted here is the one that cannot be fixed after the fact:
 * **no answer key appears in any payload of a live attempt.** It is checked by
 * searching the raw response text for the solution's own words, as Phase 3 does
 * for browsing, because the failure mode is a field nobody thought to assert on.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "xtest";
const SUBJECT = `${PREFIX}-science`;
const CHAPTER = `${PREFIX}-ch`;
const TOPIC = `${PREFIX}-topic`;
const PAPER = `${PREFIX}-paper`;
const DRAFT_PAPER = `${PREFIX}-paper-draft`;

const SECTION_A = `${PREFIX}-sec-a`;
const SECTION_B = `${PREFIX}-sec-b`;

const SLOT_MCQ = `${PREFIX}-slot-1`;
const SLOT_NUMERIC = `${PREFIX}-slot-2`;
const SLOT_WRITTEN = `${PREFIX}-slot-3`;
const SLOT_CHOICE = `${PREFIX}-slot-4`;

const Q_MCQ = `${PREFIX}-q-mcq`;
const Q_NUMERIC = `${PREFIX}-q-numeric`;
const Q_WRITTEN = `${PREFIX}-q-written`;
const Q_CHOICE_MAIN = `${PREFIX}-q-choice-main`;
const Q_CHOICE_OR = `${PREFIX}-q-choice-or`;

const ITEM_MCQ = `${PREFIX}-item-1`;
const ITEM_NUMERIC = `${PREFIX}-item-2`;
const ITEM_WRITTEN = `${PREFIX}-item-3`;
const ITEM_CHOICE_MAIN = `${PREFIX}-item-4a`;
const ITEM_CHOICE_OR = `${PREFIX}-item-4b`;

/** Distinctive enough that finding it anywhere in a response is unambiguous. */
const SOLUTION_SENTINEL = "XTESTSOLUTION: the current divides inversely with resistance.";

/** 1 + 3 + 5 + 3 = 12. */
const PAPER_MARKS = 12;
const DURATION_MINUTES = 180;

let student: string;
let stranger: string;
let studentId: string;
let keyCounter = 0;

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}@example.test`, name: "Exam Student" },
    select: { id: true, clerkId: true },
  });
  studentId = owner.id;
  student = await bearer({ subject: owner.clerkId });

  const other = await prisma.user.create({
    data: { clerkId: `${PREFIX}_other`, email: `${PREFIX}-other@example.test` },
    select: { clerkId: true },
  });
  stranger = await bearer({ subject: other.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "XTSCI",
      name: "Xtest Science",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Electricity", slug: CHAPTER, orderIndex: 0 },
  });
  await prisma.topic.create({
    data: { id: TOPIC, chapterId: CHAPTER, name: "Ohm's law", slug: TOPIC, orderIndex: 0 },
  });

  await prisma.question.create({
    data: {
      id: Q_MCQ,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "MCQ",
      body: "Two resistors in parallel give an equivalent resistance that is:",
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      options: {
        create: [
          { id: `${Q_MCQ}-a`, label: "A", body: "larger than either", orderIndex: 0 },
          {
            id: `${Q_MCQ}-b`,
            label: "B",
            body: "smaller than either",
            isCorrect: true,
            orderIndex: 1,
          },
        ],
      },
      answer: { create: { correctValue: "B", solution: SOLUTION_SENTINEL } },
      topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_NUMERIC,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "NUMERICAL",
      body: "A 12 V supply across 4 ohm. Find the current.",
      marks: 3,
      difficulty: "MEDIUM",
      expectedTimeSeconds: 180,
      status: "PUBLISHED",
      answer: { create: { correctValue: "3", unit: "A", solution: "I = V/R = 3 A" } },
      topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_WRITTEN,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "LONG_ANSWER",
      body: "Derive the expression for equivalent resistance in parallel.",
      marks: 5,
      difficulty: "HARD",
      expectedTimeSeconds: 420,
      status: "PUBLISHED",
      answer: {
        create: {
          solution: "Apply Kirchhoff's current law at the junction.",
          markingScheme: [
            { step: "States that voltage is common", marks: 2 },
            { step: "Adds the branch currents", marks: 3 },
          ],
        },
      },
      topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
    },
  });

  for (const [id, body] of [
    [Q_CHOICE_MAIN, "State Ohm's law."],
    [Q_CHOICE_OR, "State Joule's law of heating."],
  ] as const) {
    await prisma.question.create({
      data: {
        id,
        subjectId: SUBJECT,
        chapterId: CHAPTER,
        type: "SHORT_ANSWER",
        body,
        marks: 3,
        difficulty: "MEDIUM",
        expectedTimeSeconds: 180,
        status: "PUBLISHED",
        answer: { create: { solution: `Solution for ${id}` } },
        topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
      },
    });
  }

  for (const [paperId, slug, status] of [
    [PAPER, `${PREFIX}-published`, "PUBLISHED"],
    [DRAFT_PAPER, `${PREFIX}-draft`, "DRAFT"],
  ] as const) {
    await prisma.examPaper.create({
      data: {
        id: paperId,
        subjectId: SUBJECT,
        title: "Xtest Science Mock",
        slug,
        paperType: "GENERATED_MOCK",
        totalMarks: PAPER_MARKS,
        durationMinutes: DURATION_MINUTES,
        generalInstructions: ["All questions are compulsory."],
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
      },
    });
  }

  await prisma.examSection.createMany({
    data: [
      { id: SECTION_A, paperId: PAPER, name: "Section A", orderIndex: 0, marksPerQuestion: 1 },
      { id: SECTION_B, paperId: PAPER, name: "Section B", orderIndex: 1, marksPerQuestion: null },
    ],
  });

  await prisma.examSlot.createMany({
    data: [
      { id: SLOT_MCQ, sectionId: SECTION_A, questionNumber: 1, orderIndex: 0, marks: 1 },
      { id: SLOT_NUMERIC, sectionId: SECTION_B, questionNumber: 2, orderIndex: 0, marks: 3 },
      { id: SLOT_WRITTEN, sectionId: SECTION_B, questionNumber: 3, orderIndex: 1, marks: 5 },
      { id: SLOT_CHOICE, sectionId: SECTION_B, questionNumber: 4, orderIndex: 2, marks: 3 },
    ],
  });

  await prisma.examSlotItem.createMany({
    data: [
      { id: ITEM_MCQ, slotId: SLOT_MCQ, questionId: Q_MCQ, variantLabel: "MAIN", orderIndex: 0 },
      {
        id: ITEM_NUMERIC,
        slotId: SLOT_NUMERIC,
        questionId: Q_NUMERIC,
        variantLabel: "MAIN",
        orderIndex: 0,
      },
      {
        id: ITEM_WRITTEN,
        slotId: SLOT_WRITTEN,
        questionId: Q_WRITTEN,
        variantLabel: "MAIN",
        orderIndex: 0,
      },
      {
        id: ITEM_CHOICE_MAIN,
        slotId: SLOT_CHOICE,
        questionId: Q_CHOICE_MAIN,
        variantLabel: "MAIN",
        orderIndex: 0,
      },
      {
        id: ITEM_CHOICE_OR,
        slotId: SLOT_CHOICE,
        questionId: Q_CHOICE_OR,
        variantLabel: "OR",
        orderIndex: 1,
      },
    ],
  });
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.examAnswer.deleteMany({ where: { attempt: { userId: studentId } } });
  await prisma.examAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
  await prisma.subjectProgress.deleteMany({ where: { userId: studentId } });
  await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
  await prisma.studyDay.deleteMany({ where: { userId: studentId } });
});

describe("starting an attempt", () => {
  it("builds the whole paper and a server-computed deadline", async () => {
    const attempt = await start();

    expect(attempt.items).toHaveLength(4);
    expect(attempt.totalMarks).toBe(PAPER_MARKS);
    expect(attempt.status).toBe("IN_PROGRESS");

    const minutes =
      (new Date(attempt.deadlineAt).getTime() - new Date(attempt.startedAt).getTime()) / 60_000;
    expect(Math.round(minutes)).toBe(DURATION_MINUTES);
  });

  it("returns the same attempt for a repeated idempotency key", async () => {
    const key = `${PREFIX}-fixed-key`;
    const first = await start(key);
    const second = await start(key);

    expect(second.id).toBe(first.id);
    expect(await prisma.examAttempt.count({ where: { userId: studentId } })).toBe(1);
  });

  it("refuses a second live attempt at the same paper", async () => {
    await start();

    await request(app)
      .post("/api/v1/exam-attempts")
      .set("authorization", student)
      .send({ paperId: PAPER, idempotencyKey: `${PREFIX}-different-key` })
      .expect(409);
  });

  it("will not let a student sit an unpublished paper", async () => {
    await request(app)
      .post("/api/v1/exam-attempts")
      .set("authorization", student)
      .send({ paperId: DRAFT_PAPER, idempotencyKey: nextKey() })
      .expect(404);
  });

  it("orders the slots as the paper prints them", async () => {
    const attempt = await start();
    expect(attempt.items.map((item) => item.questionNumber)).toEqual([1, 2, 3, 4]);
  });

  it("carries both sides of an internal choice, with neither chosen", async () => {
    const attempt = await start();
    const choice = attempt.items.find((item) => item.slotId === SLOT_CHOICE);

    expect(choice?.items).toHaveLength(2);
    expect(choice?.items.map((item) => item.variantLabel)).toEqual(["MAIN", "OR"]);
    expect(choice?.chosenItemId).toBeNull();
  });
});

describe("the answer key never reaches a live attempt", () => {
  it("is absent from the runner payload", async () => {
    const attempt = await start();

    const response = await request(app)
      .get(`/api/v1/exam-attempts/${attempt.id}`)
      .set("authorization", student)
      .expect(200);

    const raw = JSON.stringify(response.body);

    expect(raw).not.toContain(SOLUTION_SENTINEL);
    expect(raw).not.toContain("isCorrect");
    expect(raw).not.toContain("correctValue");
    expect(raw).not.toContain("markingScheme");
  });

  it("appears on the result, once the attempt is over", async () => {
    const attempt = await start();
    const result = await submit(attempt.id);

    expect(JSON.stringify(result)).toContain(SOLUTION_SENTINEL);
  });
});

describe("saving answers", () => {
  it("stores an answer and reports the revision back", async () => {
    const attempt = await start();
    const saved = await save(attempt.id, SLOT_MCQ, { revision: 1 });

    expect(saved.accepted).toBe(true);
    expect(saved.revision).toBe(1);
    expect(saved.status).toBe("ANSWERED");
  });

  it("survives a reload: a refetched attempt carries every saved answer", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    await save(attempt.id, SLOT_NUMERIC, { revision: 1, text: "3" });

    const reloaded = await get(attempt.id);
    const mcq = reloaded.items.find((item) => item.slotId === SLOT_MCQ);
    const numeric = reloaded.items.find((item) => item.slotId === SLOT_NUMERIC);

    expect(mcq?.answer.optionIds).toEqual([`${Q_MCQ}-b`]);
    expect(numeric?.answer.text).toBe("3");
    expect(reloaded.deadlineAt).toBe(attempt.deadlineAt);
  });

  it("keeps the higher revision when two tabs disagree", async () => {
    const attempt = await start();

    await save(attempt.id, SLOT_NUMERIC, { revision: 5, text: "newer" });
    const stale = await save(attempt.id, SLOT_NUMERIC, { revision: 2, text: "older" });

    expect(stale.accepted).toBe(false);
    expect(stale.revision).toBe(5);

    const reloaded = await get(attempt.id);
    expect(reloaded.items.find((item) => item.slotId === SLOT_NUMERIC)?.answer.text).toBe("newer");
  });

  it("accepts a repeat of the same revision, so a retried request is harmless", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_NUMERIC, { revision: 3, text: "a" });
    const retry = await save(attempt.id, SLOT_NUMERIC, { revision: 3, text: "a" });

    expect(retry.accepted).toBe(true);
  });

  it("creates one row per slot however many times it is written", async () => {
    const attempt = await start();
    for (let revision = 1; revision <= 5; revision += 1) {
      await save(attempt.id, SLOT_NUMERIC, { revision, text: String(revision) });
    }

    expect(
      await prisma.examAnswer.count({ where: { attemptId: attempt.id, slotId: SLOT_NUMERIC } }),
    ).toBe(1);
  });

  it("records which side of an internal choice was taken", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_CHOICE, {
      revision: 1,
      text: "Joule's law",
      chosenItemId: ITEM_CHOICE_OR,
    });

    const reloaded = await get(attempt.id);
    expect(reloaded.items.find((item) => item.slotId === SLOT_CHOICE)?.chosenItemId).toBe(
      ITEM_CHOICE_OR,
    );
  });

  it("refuses a chosen item that does not belong to the slot", async () => {
    const attempt = await start();

    await request(app)
      .put(`/api/v1/exam-attempts/${attempt.id}/answers/${SLOT_CHOICE}`)
      .set("authorization", student)
      .send({
        answer: { optionIds: [], text: "x" },
        status: "ANSWERED",
        chosenItemId: ITEM_MCQ,
        revision: 1,
        timeSpentMs: 0,
      })
      .expect(404);
  });

  it("refuses a slot that is not in this paper", async () => {
    const attempt = await start();

    await request(app)
      .put(`/api/v1/exam-attempts/${attempt.id}/answers/not-a-slot`)
      .set("authorization", student)
      .send({
        answer: { optionIds: [], text: "x" },
        status: "ANSWERED",
        chosenItemId: null,
        revision: 1,
        timeSpentMs: 0,
      })
      .expect(404);
  });
});

describe("the clock", () => {
  it("rejects a write after the deadline with 410, and does not lose earlier work", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });

    await expire(attempt.id);

    await request(app)
      .put(`/api/v1/exam-attempts/${attempt.id}/answers/${SLOT_NUMERIC}`)
      .set("authorization", student)
      .send({
        answer: { optionIds: [], text: "too late" },
        status: "ANSWERED",
        chosenItemId: null,
        revision: 1,
        timeSpentMs: 0,
      })
      .expect(410);

    const result = await getResult(attempt.id);
    expect(result.score.objectiveAwarded).toBe(1);
  });

  it("finalises an expired attempt the next time anything touches it", async () => {
    const attempt = await start();
    await expire(attempt.id);

    const reloaded = await get(attempt.id);
    expect(reloaded.status).toBe("COMPLETED");
    expect(reloaded.submissionReason).toBe("AUTO_TIMEOUT_SERVER");
  });

  it("consumes the time a sleeping laptop was away, rather than pausing", async () => {
    const attempt = await start();
    const deadline = new Date(attempt.deadlineAt).getTime();

    // The laptop slept. Nothing about the attempt changes; the deadline is an
    // absolute instant and simply gets closer.
    const reloaded = await get(attempt.id);
    expect(new Date(reloaded.deadlineAt).getTime()).toBe(deadline);
  });

  it("reports the time left from the server's own clock", async () => {
    const attempt = await start();

    const response = await request(app)
      .post(`/api/v1/exam-attempts/${attempt.id}/heartbeat`)
      .set("authorization", student)
      .expect(200);

    const beat = (response.body as { data: { remainingMs: number; status: string } }).data;

    expect(beat.status).toBe("IN_PROGRESS");
    expect(beat.remainingMs).toBeGreaterThan(DURATION_MINUTES * 60_000 - 60_000);
    expect(beat.remainingMs).toBeLessThanOrEqual(DURATION_MINUTES * 60_000);
  });
});

describe("submitting", () => {
  it("grades the objective answers and leaves the written ones pending", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    await save(attempt.id, SLOT_NUMERIC, { revision: 1, text: "3" });
    await save(attempt.id, SLOT_WRITTEN, { revision: 1, text: "A derivation." });

    const result = await submit(attempt.id);

    expect(result.score.objectiveAwarded).toBe(4);
    expect(result.score.objectivePossible).toBe(4);
    expect(result.score.awaitingSelfEvaluation).toBeGreaterThan(0);
    expect(result.score.totalPossible).toBe(PAPER_MARKS);
  });

  it("never blends the two into a single unexplained number", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    const result = await submit(attempt.id);

    expect(result.score.objectiveAwarded).toBeDefined();
    expect(result.score.selfAssessedAwarded).toBeDefined();
    expect(result.score.totalAwarded).toBe(
      result.score.objectiveAwarded + result.score.selfAssessedAwarded,
    );
  });

  it("returns the same result however many times Submit is tapped", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });

    const first = await submit(attempt.id);
    const second = await submit(attempt.id);
    const third = await submit(attempt.id);

    expect(second.score).toEqual(first.score);
    expect(third.score).toEqual(first.score);
    expect(second.attempt.submittedAt).toBe(first.attempt.submittedAt);
  });

  it("writes exactly one attempt row per graded unit, even on a double submit", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });

    await Promise.all([submit(attempt.id), submit(attempt.id)]);

    expect(
      await prisma.questionAttempt.count({
        where: { examAttemptId: attempt.id, questionId: Q_MCQ },
      }),
    ).toBe(1);
  });

  it("scores only the chosen side of an internal choice", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_CHOICE, {
      revision: 1,
      text: "Heat produced is I squared R t.",
      chosenItemId: ITEM_CHOICE_OR,
    });

    const result = await submit(attempt.id);
    const graded = result.items.find((item) => item.slotId === SLOT_CHOICE);

    expect(graded?.question.id).toBe(Q_CHOICE_OR);
    expect(
      await prisma.questionAttempt.count({
        where: { examAttemptId: attempt.id, questionId: Q_CHOICE_MAIN },
      }),
    ).toBe(0);
  });

  it("breaks the score down by section", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });

    const result = await submit(attempt.id);
    const sectionA = result.sections.find((section) => section.name === "Section A");

    expect(sectionA?.marksAwarded).toBe(1);
    expect(sectionA?.marksPossible).toBe(1);
    expect(sectionA?.attempted).toBe(1);
  });

  it("updates mastery from the objective answers", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    await submit(attempt.id);

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC } },
    });

    expect(mastery?.attempted).toBeGreaterThan(0);
  });

  it("refuses to show a result while the exam is still running", async () => {
    const attempt = await start();

    await request(app)
      .get(`/api/v1/exam-attempts/${attempt.id}/result`)
      .set("authorization", student)
      .expect(409);
  });
});

describe("the sweeper", () => {
  it("finalises an attempt nobody came back to", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    await expire(attempt.id);

    const swept = await examAttemptService.sweepExpired();
    expect(swept).toBeGreaterThanOrEqual(1);

    const row = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("COMPLETED");
    expect(row.submissionReason).toBe("AUTO_TIMEOUT_SWEEPER");
    expect(row.objectiveScore).toBe(1);
  });

  it("leaves a live attempt alone", async () => {
    const attempt = await start();

    await examAttemptService.sweepExpired();

    const row = await prisma.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(row.status).toBe("IN_PROGRESS");
  });

  it("does not re-grade an attempt the student already submitted", async () => {
    const attempt = await start();
    await save(attempt.id, SLOT_MCQ, { revision: 1 });
    await submit(attempt.id);

    await expire(attempt.id);
    await examAttemptService.sweepExpired();

    expect(
      await prisma.questionAttempt.count({
        where: { examAttemptId: attempt.id, questionId: Q_MCQ },
      }),
    ).toBe(1);
  });
});

describe("authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    await request(app).get("/api/v1/exam-attempts").expect(401);
  });

  it("will not show one student another's attempt", async () => {
    const attempt = await start();

    await request(app)
      .get(`/api/v1/exam-attempts/${attempt.id}`)
      .set("authorization", stranger)
      .expect(404);
  });

  it("will not let one student write into another's attempt", async () => {
    const attempt = await start();

    await request(app)
      .put(`/api/v1/exam-attempts/${attempt.id}/answers/${SLOT_MCQ}`)
      .set("authorization", stranger)
      .send({
        answer: { optionIds: [`${Q_MCQ}-b`], text: "" },
        status: "ANSWERED",
        chosenItemId: null,
        revision: 1,
        timeSpentMs: 0,
      })
      .expect(404);
  });

  it("will not let one student submit another's attempt", async () => {
    const attempt = await start();

    await request(app)
      .post(`/api/v1/exam-attempts/${attempt.id}/submit`)
      .set("authorization", stranger)
      .send({ reason: "STUDENT" })
      .expect(404);
  });
});

function nextKey(): string {
  keyCounter += 1;
  return `${PREFIX}-key-${String(keyCounter)}-${String(Date.now())}`;
}

async function start(idempotencyKey = nextKey()) {
  const response = await request(app)
    .post("/api/v1/exam-attempts")
    .set("authorization", student)
    .send({ paperId: PAPER, idempotencyKey })
    .expect(201);

  return successResponseSchema(examAttemptSchema).parse(response.body).data;
}

async function get(attemptId: string) {
  const response = await request(app)
    .get(`/api/v1/exam-attempts/${attemptId}`)
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(examAttemptSchema).parse(response.body).data;
}

async function save(
  attemptId: string,
  slotId: string,
  options: { revision: number; text?: string; chosenItemId?: string },
) {
  const response = await request(app)
    .put(`/api/v1/exam-attempts/${attemptId}/answers/${slotId}`)
    .set("authorization", student)
    .send({
      answer:
        slotId === SLOT_MCQ
          ? { optionIds: [`${Q_MCQ}-b`], text: "" }
          : { optionIds: [], text: options.text ?? "" },
      status: "ANSWERED",
      chosenItemId: options.chosenItemId ?? null,
      revision: options.revision,
      timeSpentMs: 30_000,
    })
    .expect(200);

  return successResponseSchema(saveExamAnswerResultSchema).parse(response.body).data;
}

async function submit(attemptId: string) {
  const response = await request(app)
    .post(`/api/v1/exam-attempts/${attemptId}/submit`)
    .set("authorization", student)
    .send({ reason: "STUDENT" })
    .expect(200);

  return successResponseSchema(examResultSchema).parse(response.body).data;
}

async function getResult(attemptId: string) {
  const response = await request(app)
    .get(`/api/v1/exam-attempts/${attemptId}/result`)
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(examResultSchema).parse(response.body).data;
}

/**
 * Move the deadline into the past.
 *
 * Written directly rather than by advancing a clock, because the thing under
 * test is that the *server* compares against a stored instant — a test that
 * mocked time would be testing the mock.
 */
async function expire(attemptId: string): Promise<void> {
  const deadlineAt = new Date(Date.now() - 1000);

  await prisma.examAttempt.update({
    where: { id: attemptId },
    data: {
      // Both, and in that order. `exam_attempts_deadline_after_start` is a
      // CHECK constraint in the migration, so an attempt whose deadline
      // precedes its start is not a state the database will hold — which is
      // the constraint working, and is why this helper backdates the sitting
      // rather than only its end.
      startedAt: new Date(deadlineAt.getTime() - DURATION_MINUTES * 60_000),
      deadlineAt,
    },
  });
}

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.examAnswer.deleteMany({
    where: { attempt: { user: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.examAttempt.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.learningEvent.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.subjectProgress.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.studyDay.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.examSlotItem.deleteMany({ where: { slot: { section: { paperId: PAPER } } } });
  await prisma.examSlot.deleteMany({ where: { section: { paperId: PAPER } } });
  await prisma.examSection.deleteMany({ where: { paperId: PAPER } });
  await prisma.examPaper.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
