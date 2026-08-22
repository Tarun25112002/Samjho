import {
  attemptOutcomeSchema,
  bookmarkStateSchema,
  practiceResultSchema,
  practiceSessionSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Practice sessions end to end, against real Postgres.
 *
 * Three things here are load-bearing rather than routine:
 *
 *  1. **The answer key does not appear until the student has answered.** Tested
 *     by searching the raw response body for the solution's own text, as Phase 3
 *     does, because the failure mode is a field nobody thought to assert on.
 *  2. **Ownership.** docs/02 §4 names this the most commonly missed check in
 *     apps like this, and the Phase 5 gate requires it verified by test rather
 *     than by inspection. A second student exists in this file for no other
 *     reason.
 *  3. **The rollups tell the truth.** Mastery, mistake records and session
 *     totals are asserted against the database, not against the response that
 *     wrote them — a response can be right about a write that did not land.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "ptest";
const SUBJECT = `${PREFIX}-science`;
const CHAPTER = `${PREFIX}-ch-electricity`;
const TOPIC_OHM = `${PREFIX}-topic-ohms-law`;
const TOPIC_CASE = `${PREFIX}-topic-circuits`;

const Q_MCQ = `${PREFIX}-q-mcq`;
const Q_NUMERICAL = `${PREFIX}-q-numerical`;
const Q_SUBJECTIVE = `${PREFIX}-q-subjective`;
const Q_CASE = `${PREFIX}-q-case`;
const CASE_PART_MCQ = `${PREFIX}-q-case-i`;
const CASE_PART_NUMERICAL = `${PREFIX}-q-case-ii`;
const CASE_PART_WRITTEN = `${PREFIX}-q-case-iii`;

const MCQ_CORRECT_OPTION = `${PREFIX}-opt-mcq-b`;
const CASE_CORRECT_OPTION = `${PREFIX}-opt-case-a`;

/** Distinctive enough that finding it anywhere in a response is unambiguous. */
const MCQ_SOLUTION = "PTESTSOLUTION: parallel resistors add as reciprocals.";
const NUMERICAL_SOLUTION = "PTESTNUMERICALSOLUTION: divide the power by the voltage.";

/** The whole set is worth this: 1 + 3 + 5 + (1 + 1 + 2). */
const SET_MARKS = 13;

let student: string;
let stranger: string;
let studentId: string;

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}-student@example.test`,
      name: "Practice Student",
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
      code: "PTSCI",
      name: "Ptest Science",
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
      name: "Electricity",
      slug: CHAPTER,
      orderIndex: 0,
      domain: "Physics",
    },
  });

  await prisma.topic.createMany({
    data: [
      { id: TOPIC_OHM, chapterId: CHAPTER, name: "Ohm's law", slug: TOPIC_OHM, orderIndex: 0 },
      { id: TOPIC_CASE, chapterId: CHAPTER, name: "Circuits", slug: TOPIC_CASE, orderIndex: 1 },
    ],
  });

  await prisma.question.create({
    data: {
      id: Q_MCQ,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "MCQ",
      body: "Two resistors of $6\\ \\Omega$ and $3\\ \\Omega$ in parallel give:",
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      options: {
        create: [
          { id: `${PREFIX}-opt-mcq-a`, label: "A", body: "$9\\ \\Omega$", orderIndex: 0 },
          {
            id: MCQ_CORRECT_OPTION,
            label: "B",
            body: "$2\\ \\Omega$",
            isCorrect: true,
            orderIndex: 1,
          },
        ],
      },
      answer: { create: { solution: MCQ_SOLUTION } },
      topics: { create: [{ topicId: TOPIC_OHM, isPrimary: true }] },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_NUMERICAL,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "NUMERICAL",
      body: "A 1760 W geyser runs on 220 V. Find the current drawn.",
      marks: 3,
      difficulty: "MEDIUM",
      expectedTimeSeconds: 180,
      status: "PUBLISHED",
      answer: { create: { correctValue: "8", unit: "A", solution: NUMERICAL_SOLUTION } },
      topics: { create: [{ topicId: TOPIC_OHM, isPrimary: true }] },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_SUBJECTIVE,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "LONG_ANSWER",
      body: "Derive the expression for the equivalent resistance of three resistors in series.",
      marks: 5,
      difficulty: "HARD",
      expectedTimeSeconds: 300,
      status: "PUBLISHED",
      answer: {
        create: {
          solution: "Apply Kirchhoff's loop rule across the three resistors.",
          markingScheme: [
            { step: "States that current is the same through each resistor", marks: 2 },
            { step: "Adds the potential differences", marks: 2 },
            { step: "States the final expression", marks: 1 },
          ],
        },
      },
      topics: { create: [{ topicId: TOPIC_OHM, isPrimary: true }] },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_CASE,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "CASE_BASED",
      body: "**A household circuit.** A kitchen runs three appliances in parallel.",
      marks: 4,
      expectedTimeSeconds: 480,
      status: "PUBLISHED",
      isContainer: true,
      topics: { create: [{ topicId: TOPIC_CASE, isPrimary: true }] },
      subParts: {
        create: [
          {
            id: CASE_PART_MCQ,
            subjectId: SUBJECT,
            chapterId: CHAPTER,
            type: "MCQ",
            body: "(i) Appliances in a household circuit are connected in:",
            marks: 1,
            subPartIndex: 0,
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
            options: {
              create: [
                {
                  id: CASE_CORRECT_OPTION,
                  label: "A",
                  body: "Parallel",
                  isCorrect: true,
                  orderIndex: 0,
                },
                { id: `${PREFIX}-opt-case-b`, label: "B", body: "Series", orderIndex: 1 },
              ],
            },
            answer: { create: { solution: "Each appliance needs the full supply voltage." } },
            topics: { create: [{ topicId: TOPIC_CASE, isPrimary: true }] },
          },
          {
            id: CASE_PART_NUMERICAL,
            subjectId: SUBJECT,
            chapterId: CHAPTER,
            type: "NUMERICAL",
            body: "(ii) Find the current through a 220 W bulb on 220 V.",
            marks: 1,
            subPartIndex: 1,
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
            answer: { create: { correctValue: "1", unit: "A", solution: "$I = P/V$." } },
            // Deliberately untagged: mastery must fall back to the container's
            // topic rather than dropping the attempt.
          },
          {
            id: CASE_PART_WRITTEN,
            subjectId: SUBJECT,
            chapterId: CHAPTER,
            type: "SHORT_ANSWER",
            body: "(iii) Explain why a fuse is connected in the live wire.",
            marks: 2,
            subPartIndex: 2,
            expectedTimeSeconds: 120,
            status: "PUBLISHED",
            answer: { create: { solution: "It breaks the live path before the appliance." } },
            topics: { create: [{ topicId: TOPIC_CASE, isPrimary: true }] },
          },
        ],
      },
    },
  });
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.bookmark.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.subjectProgress.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  // Sub-parts cascade from their parent.
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}

/** A fresh chapter-wide set: all four questions, in marks order. */
async function startSession(auth = student) {
  const response = await request(app)
    .post("/api/v1/practice-sessions")
    .set("authorization", auth)
    .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 20 })
    .expect(201);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

function parseOutcome(body: unknown) {
  return successResponseSchema(attemptOutcomeSchema).parse(body).data;
}

async function answer(
  sessionId: string,
  questionId: string,
  responses: { targetId: string; answer: { optionIds?: string[]; text?: string } }[],
  timeSpentMs = 30_000,
) {
  const response = await request(app)
    .post(`/api/v1/practice-sessions/${sessionId}/attempts`)
    .set("authorization", student)
    .send({
      questionId,
      responses: responses.map((entry) => ({
        targetId: entry.targetId,
        answer: { optionIds: entry.answer.optionIds ?? [], text: entry.answer.text ?? "" },
      })),
      timeSpentMs,
    })
    .expect(200);

  return parseOutcome(response.body);
}

// ── Building a set ───────────────────────────────────────────────────────────

describe("creating a session", () => {
  it("materialises the question set and states what it is worth", async () => {
    const session = await startSession();

    expect(session.status).toBe("IN_PROGRESS");
    expect(session.mode).toBe("CHAPTER");
    expect(session.focus).toBe("Electricity");
    expect(session.totals.totalQuestions).toBe(4);
    // Summed over graded units, so the case study contributes 1 + 1 + 2 rather
    // than the container's own 4 counted twice.
    expect(session.totals.marksPossible).toBe(SET_MARKS);
    expect(session.totals.answered).toBe(0);
  });

  it("orders the set cheapest first, the way a paper is ordered", async () => {
    const session = await startSession();

    expect(session.items.map((item) => item.question.marks)).toEqual([1, 3, 4, 5]);
  });

  it("shows no answer key for a question the student has not answered", async () => {
    const session = await startSession();
    const raw = JSON.stringify(session);

    expect(raw).not.toContain(MCQ_SOLUTION);
    expect(raw).not.toContain(NUMERICAL_SOLUTION);
    expect(raw).not.toContain("isCorrect");
    // Not a trivial pass: the questions themselves are in there.
    expect(raw).toContain(Q_MCQ);
  });

  it("refuses to build a set from a filter nothing matches", async () => {
    await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", student)
      .send({ mode: "CUSTOM", filters: { chapterId: `${PREFIX}-no-such-chapter` }, count: 10 })
      .expect(404);
  });

  it("requires authentication", async () => {
    await request(app).post("/api/v1/practice-sessions").send({ mode: "QUICK" }).expect(401);
  });
});

// ── Answering ────────────────────────────────────────────────────────────────

describe("answering", () => {
  it("grades an objective answer and reveals the key with it", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_MCQ, [
      { targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION] } },
    ]);

    const attempt = outcome.item.attempts[0];
    expect(attempt?.isCorrect).toBe(true);
    expect(attempt?.marksAwarded).toBe(1);
    expect(attempt?.evaluationMode).toBe("AUTO");
    // The key arrives only now, attached to the attempt rather than to the
    // question — the student has earned it by answering.
    expect(attempt?.key?.solution).toBe(MCQ_SOLUTION);
    expect(attempt?.key?.correctOptionIds).toEqual([MCQ_CORRECT_OPTION]);

    expect(outcome.totals.answered).toBe(1);
    expect(outcome.totals.correct).toBe(1);
    expect(outcome.totals.marksEarned).toBe(1);
    expect(outcome.totals.marksPossible).toBe(SET_MARKS);
  });

  it("accepts a numerical answer written with its unit", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_NUMERICAL, [
      { targetId: Q_NUMERICAL, answer: { text: "8 A" } },
    ]);

    expect(outcome.item.attempts[0]?.isCorrect).toBe(true);
    expect(outcome.totals.marksEarned).toBe(3);
  });

  it("returns the first attempt when the same question is submitted twice", async () => {
    // A double-tapped Submit on a slow connection is the normal case. Two
    // attempt rows would double-count mastery and open a mistake record against
    // an answer the student got right.
    const session = await startSession();

    const first = await answer(session.id, Q_MCQ, [
      { targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION] } },
    ]);
    const second = await answer(session.id, Q_MCQ, [
      { targetId: Q_MCQ, answer: { optionIds: [] } },
    ]);

    expect(second.item.attempts).toHaveLength(1);
    expect(second.item.attempts[0]?.id).toBe(first.item.attempts[0]?.id);
    expect(second.totals.answered).toBe(1);
    expect(second.totals.marksEarned).toBe(1);

    const rows = await prisma.questionAttempt.count({
      where: { practiceSessionId: session.id, questionId: Q_MCQ },
    });
    expect(rows).toBe(1);
  });

  it("writes one attempt per sub-part of a case study, and counts it as one question", async () => {
    const session = await startSession();

    const outcome = await answer(session.id, Q_CASE, [
      { targetId: CASE_PART_MCQ, answer: { optionIds: [CASE_CORRECT_OPTION] } },
      { targetId: CASE_PART_NUMERICAL, answer: { text: "0.5" } },
      {
        targetId: CASE_PART_WRITTEN,
        answer: { text: "Because the fuse must break the live path." },
      },
    ]);

    expect(outcome.item.attempts).toHaveLength(3);
    expect(outcome.totals.answered).toBe(1);
    // One part right, one wrong, one waiting to be scored — so the item is not
    // correct, and says so rather than rounding in the student's favour.
    expect(outcome.totals.correct).toBe(0);
    expect(outcome.totals.marksEarned).toBe(1);
    expect(outcome.totals.awaitingSelfEvaluation).toBe(1);
  });

  it("records a blank answer for a sub-part the client left out", async () => {
    const session = await startSession();

    const outcome = await answer(session.id, Q_CASE, [
      { targetId: CASE_PART_MCQ, answer: { optionIds: [CASE_CORRECT_OPTION] } },
    ]);

    expect(outcome.item.attempts).toHaveLength(3);
    expect(outcome.item.attempts.filter((attempt) => attempt.isCorrect === false)).toHaveLength(1);
  });

  it("rejects an answer aimed at a question that is not part of this one", async () => {
    const session = await startSession();

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts`)
      .set("authorization", student)
      .send({
        questionId: Q_MCQ,
        responses: [{ targetId: Q_NUMERICAL, answer: { optionIds: [], text: "8" } }],
        timeSpentMs: 1000,
      })
      .expect(400);
  });

  it("refuses an answer to a question that is not in the set", async () => {
    const session = await startSession();

    // A published question, just not one this session drew. Indistinguishable
    // from a question that does not exist, so the endpoint cannot enumerate.
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: { questionIds: [Q_MCQ] },
    });

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts`)
      .set("authorization", student)
      .send({
        questionId: Q_NUMERICAL,
        responses: [{ targetId: Q_NUMERICAL, answer: { optionIds: [], text: "8" } }],
        timeSpentMs: 1000,
      })
      .expect(404);
  });
});

// ── Self-evaluation ──────────────────────────────────────────────────────────

describe("self-evaluation", () => {
  it("leaves a written answer unscored until the student scores it", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Series resistors add." } },
    ]);

    const attempt = outcome.item.attempts[0];
    expect(attempt?.evaluationMode).toBe("PENDING");
    // Not `false`. An unscored answer is neither right nor wrong, and calling it
    // wrong would drop it into the student's mistake list while it waits.
    expect(attempt?.isCorrect).toBeNull();
    expect(outcome.totals.awaitingSelfEvaluation).toBe(1);
    expect(outcome.totals.correct).toBe(0);

    // The marking scheme is what they score themselves against, so it has to be
    // in the response that asks them to.
    expect(attempt?.key?.markingScheme).toHaveLength(3);
  });

  it("records a partial self-score as marks earned but not as correct", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Series resistors add." } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    const scored = await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", student)
      .send({ marksAwarded: 3 })
      .expect(200);

    const result = parseOutcome(scored.body);
    expect(result.item.attempts[0]?.evaluationMode).toBe("SELF");
    expect(result.item.attempts[0]?.marksAwarded).toBe(3);
    expect(result.item.attempts[0]?.isCorrect).toBe(false);
    expect(result.totals.marksEarned).toBe(3);
    expect(result.totals.correct).toBe(0);
    expect(result.totals.awaitingSelfEvaluation).toBe(0);
  });

  it("counts full self-awarded marks as correct", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "A complete derivation." } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    const scored = await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", student)
      .send({ marksAwarded: 5 })
      .expect(200);

    expect(parseOutcome(scored.body).totals.correct).toBe(1);
  });

  it("refuses to score the same answer twice", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Series resistors add." } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", student)
      .send({ marksAwarded: 1 })
      .expect(200);

    // Self-evaluation, not self-marking: the score is a judgement made once
    // against the marking scheme, not a dial.
    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", student)
      .send({ marksAwarded: 5 })
      .expect(409);
  });

  it("still accepts a score after the session is finished", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Half a derivation." } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);

    // A student who hit Finish with an answer unscored can score it from the
    // result page rather than losing it.
    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", student)
      .send({ marksAwarded: 2 })
      .expect(200);
  });
});

// ── The rollups ──────────────────────────────────────────────────────────────

describe("progress rollups", () => {
  /**
   * Rollups are cumulative by design — that is the whole point of them — so
   * every test above this one leaves a mark on the same student's mastery. These
   * tests assert on absolute figures, so they start from zero rather than
   * reasoning about what the rest of the file has already added, which would
   * make each of them depend on the order of all the others.
   */
  beforeEach(async () => {
    await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
    await prisma.subjectProgress.deleteMany({ where: { userId: studentId } });
    await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
  });

  it("moves topic mastery and subject progress on a graded attempt", async () => {
    const session = await startSession();
    await answer(session.id, Q_MCQ, [
      { targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION] } },
    ]);

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC_OHM } },
    });

    expect(mastery?.attempted).toBe(1);
    expect(mastery?.correct).toBe(1);
    expect(mastery?.marksEarned).toBe(1);
    expect(mastery?.masteryScore).toBe(1);

    const subject = await prisma.subjectProgress.findUnique({
      where: { userId_subjectId: { userId: studentId, subjectId: SUBJECT } },
    });
    expect(subject?.attempted).toBe(1);
  });

  it("opens a mistake record on a wrong answer and closes it on a right one", async () => {
    const wrongSession = await startSession();
    await answer(wrongSession.id, Q_NUMERICAL, [{ targetId: Q_NUMERICAL, answer: { text: "4" } }]);

    const opened = await prisma.mistakeRecord.findUnique({
      where: { userId_questionId: { userId: studentId, questionId: Q_NUMERICAL } },
    });
    expect(opened?.repairedAt).toBeNull();

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC_OHM } },
    });
    expect(mastery?.unrepairedMistakes).toBe(1);

    const rightSession = await startSession();
    await answer(rightSession.id, Q_NUMERICAL, [
      { targetId: Q_NUMERICAL, answer: { text: "8 A" } },
    ]);

    const repaired = await prisma.mistakeRecord.findUnique({
      where: { userId_questionId: { userId: studentId, questionId: Q_NUMERICAL } },
    });
    expect(repaired?.repairedAt).not.toBeNull();
    expect(repaired?.repairAttempts).toBe(1);

    const after = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC_OHM } },
    });
    expect(after?.unrepairedMistakes).toBe(0);
  });

  it("attributes an untagged sub-part to its container's topic", async () => {
    const session = await startSession();
    await answer(session.id, Q_CASE, [{ targetId: CASE_PART_NUMERICAL, answer: { text: "1 A" } }]);

    // The sub-part carries no topics of its own. Without the fallback the
    // attempt would vanish from mastery entirely, which is how a student ends up
    // with a dashboard that under-reports the work they did.
    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC_CASE } },
    });
    expect(mastery?.attempted).toBeGreaterThanOrEqual(1);
  });

  it("does not roll up an answer that has not been scored yet", async () => {
    const session = await startSession();
    await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Something." } },
    ]);

    const mastery = await prisma.topicMastery.findUnique({
      where: { userId_topicId: { userId: studentId, topicId: TOPIC_OHM } },
    });
    // Recording a zero the student has not been given would be a lie that
    // survives into every average built on it.
    expect(mastery).toBeNull();
  });

  it("records why the student thinks they got it wrong", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_NUMERICAL, [
      { targetId: Q_NUMERICAL, answer: { text: "4" } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/mistake-reason`)
      .set("authorization", student)
      .send({ reason: "CALCULATION_ERROR" })
      .expect(200);

    const record = await prisma.mistakeRecord.findUnique({
      where: { userId_questionId: { userId: studentId, questionId: Q_NUMERICAL } },
    });
    expect(record?.lastReason).toBe("CALCULATION_ERROR");
  });
});

// ── Finishing ────────────────────────────────────────────────────────────────

describe("results", () => {
  it("breaks the session down by topic and names the weak ones", async () => {
    const session = await startSession();

    await answer(session.id, Q_MCQ, [
      { targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION] } },
    ]);
    await answer(session.id, Q_NUMERICAL, [{ targetId: Q_NUMERICAL, answer: { text: "4" } }]);

    const response = await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);

    const result = successResponseSchema(practiceResultSchema).parse(response.body).data;

    expect(result.session.status).toBe("COMPLETED");
    expect(result.session.completedAt).not.toBeNull();

    const ohm = result.topics.find((topic) => topic.topicId === TOPIC_OHM);
    expect(ohm?.attempted).toBe(2);
    expect(ohm?.correct).toBe(1);
    expect(ohm?.marksEarned).toBe(1);
    expect(ohm?.marksPossible).toBe(4);

    // 1 of 4 marks over two attempts clears both weak-topic thresholds.
    expect(result.weakTopics.map((topic) => topic.topicId)).toContain(TOPIC_OHM);
    expect(result.mistakeQuestionIds).toEqual([Q_NUMERICAL]);
  });

  it("finishing twice is not an error", async () => {
    const session = await startSession();

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);
  });

  it("refuses new answers once the session is finished", async () => {
    const session = await startSession();

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", student)
      .expect(200);

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts`)
      .set("authorization", student)
      .send({
        questionId: Q_MCQ,
        responses: [{ targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION], text: "" } }],
        timeSpentMs: 1000,
      })
      .expect(409);
  });

  it("remembers where the student had got to", async () => {
    const session = await startSession();

    await request(app)
      .patch(`/api/v1/practice-sessions/${session.id}`)
      .set("authorization", student)
      .send({ currentIndex: 2 })
      .expect(200);

    const reopened = await request(app)
      .get(`/api/v1/practice-sessions/${session.id}`)
      .set("authorization", student)
      .expect(200);

    expect(
      successResponseSchema(practiceSessionSchema).parse(reopened.body).data.currentIndex,
    ).toBe(2);
  });
});

// ── Ownership ────────────────────────────────────────────────────────────────

describe("a session belongs to exactly one student", () => {
  it("hides another student's session behind a 404", async () => {
    const session = await startSession();

    // 404 rather than 403: a 403 confirms the session exists, which is itself
    // information about somebody else's account.
    await request(app)
      .get(`/api/v1/practice-sessions/${session.id}`)
      .set("authorization", stranger)
      .expect(404);
  });

  it("refuses answers, scores and completion from anyone else", async () => {
    const session = await startSession();
    const outcome = await answer(session.id, Q_SUBJECTIVE, [
      { targetId: Q_SUBJECTIVE, answer: { text: "Mine." } },
    ]);
    const attemptId = outcome.item.attempts[0]?.id ?? "";

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts`)
      .set("authorization", stranger)
      .send({
        questionId: Q_MCQ,
        responses: [{ targetId: Q_MCQ, answer: { optionIds: [MCQ_CORRECT_OPTION], text: "" } }],
        timeSpentMs: 1000,
      })
      .expect(404);

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts/${attemptId}/self-evaluation`)
      .set("authorization", stranger)
      .send({ marksAwarded: 5 })
      .expect(404);

    await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/complete`)
      .set("authorization", stranger)
      .expect(404);
  });

  it("lists only the student's own sessions", async () => {
    await startSession();

    const response = await request(app)
      .get("/api/v1/practice-sessions?limit=50")
      .set("authorization", stranger)
      .expect(200);

    const body = response.body as { data: { items: unknown[] } };
    expect(body.data.items).toHaveLength(0);
  });
});

// ── Bookmarks and the modes that read them ───────────────────────────────────

describe("bookmarks", () => {
  it("saves, appears on the session item, and un-saves", async () => {
    await request(app)
      .put("/api/v1/bookmarks")
      .set("authorization", student)
      .send({ questionId: Q_MCQ, note: "Revisit before the exam" })
      .expect(200);

    const session = await startSession();
    const item = session.items.find((candidate) => candidate.question.id === Q_MCQ);
    expect(item?.bookmarked).toBe(true);

    const removed = await request(app)
      .delete(`/api/v1/bookmarks/${Q_MCQ}`)
      .set("authorization", student)
      .expect(200);

    expect(bookmarkStateSchema.parse((removed.body as { data: unknown }).data).bookmarked).toBe(
      false,
    );
  });

  it("removing a bookmark that was never saved is not an error", async () => {
    // The end state the client asked for is the end state either way.
    await request(app)
      .delete(`/api/v1/bookmarks/${Q_SUBJECTIVE}`)
      .set("authorization", student)
      .expect(200);
  });

  it("builds a set from saved questions", async () => {
    await request(app)
      .put("/api/v1/bookmarks")
      .set("authorization", student)
      .send({ questionId: Q_SUBJECTIVE, note: null })
      .expect(200);

    const response = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", student)
      .send({ mode: "BOOKMARKS", count: 10 })
      .expect(201);

    const session = successResponseSchema(practiceSessionSchema).parse(response.body).data;
    expect(session.items.map((item) => item.question.id)).toContain(Q_SUBJECTIVE);
  });

  it("builds a set from unrepaired mistakes, mapped up to the whole case study", async () => {
    const session = await startSession();
    await answer(session.id, Q_CASE, [{ targetId: CASE_PART_MCQ, answer: { optionIds: [] } }]);

    const response = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", student)
      .send({ mode: "MISTAKE_REVIEW", count: 10 })
      .expect(201);

    const review = successResponseSchema(practiceSessionSchema).parse(response.body).data;
    const ids = review.items.map((item) => item.question.id);

    // The mistake is recorded against the sub-part; practising the sub-part on
    // its own would show the question without the stimulus that makes it
    // answerable, so the set draws the container.
    expect(ids).toContain(Q_CASE);
    expect(ids).not.toContain(CASE_PART_MCQ);
  });
});
