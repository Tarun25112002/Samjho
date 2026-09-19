import {
  practiceSessionSchema,
  revisionQueueSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The revision queue end to end, against real Postgres.
 *
 * The scheduler's arithmetic is covered by `revision.scheduler.test.ts` without
 * a database. What is left for this file is everything the pure function cannot
 * see, and all of it is a place the feature could be silently wrong:
 *
 *  1. **Answering wrongly actually schedules something.** The schema carried a
 *     `nextReviewAt` column for two phases and nothing ever wrote it. A test
 *     that asserts the scheduler returns a date proves nothing about whether the
 *     rollups store it.
 *  2. **A repaired mistake stays in the queue.** This is the whole behavioural
 *     change: getting it right once removes a question from the mistake *list*
 *     and must not remove it from the review *queue*.
 *  3. **Ownership.** A student's queue is theirs. The stranger in this file
 *     exists to be shown nothing.
 *  4. **The queue is scoped to active enrolments**, so a dropped subject does
 *     not fill a student's revision with a course they left.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "rtest";
const SUBJECT = `${PREFIX}-science`;
const OTHER_SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const OTHER_CHAPTER = `${PREFIX}-ch-other`;
const TOPIC = `${PREFIX}-topic`;

const Q_WRONGABLE = `${PREFIX}-q-a`;
const Q_SECOND = `${PREFIX}-q-b`;
const Q_OTHER_SUBJECT = `${PREFIX}-q-other`;

const RIGHT = `${PREFIX}-opt-right`;
const WRONG = `${PREFIX}-opt-wrong`;

let student: string;
let stranger: string;
let studentId: string;

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}-student@example.test`,
      name: "Revision Student",
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

  for (const [id, code, name] of [
    [SUBJECT, "RTSCI", "Rtest Science"],
    [OTHER_SUBJECT, "RTMATH", "Rtest Maths"],
  ] as const) {
    await prisma.subject.create({
      data: {
        id,
        code,
        name,
        slug: id,
        board: "CBSE",
        classLevel: 10,
        theoryMarks: 80,
        syllabusYear: "2026-27",
      },
    });
  }

  await prisma.chapter.createMany({
    data: [
      { id: CHAPTER, subjectId: SUBJECT, name: "Electricity", slug: CHAPTER, orderIndex: 0 },
      {
        id: OTHER_CHAPTER,
        subjectId: OTHER_SUBJECT,
        name: "Real Numbers",
        slug: OTHER_CHAPTER,
        orderIndex: 0,
      },
    ],
  });

  await prisma.topic.create({
    data: { id: TOPIC, chapterId: CHAPTER, name: "Ohm's law", slug: TOPIC, orderIndex: 0 },
  });

  await makeMcq(Q_WRONGABLE, SUBJECT, CHAPTER, TOPIC);
  await makeMcq(Q_SECOND, SUBJECT, CHAPTER, TOPIC);
  await makeMcq(Q_OTHER_SUBJECT, OTHER_SUBJECT, OTHER_CHAPTER, null);

  // Enrolled in Science only. The Maths enrolment is inactive, which is what
  // makes the "dropped subject" case below meaningful rather than hypothetical.
  const profile = await prisma.studentProfile.create({
    data: { userId: studentId, classLevel: 10, onboardedAt: new Date() },
    select: { id: true },
  });
  await prisma.subjectEnrolment.createMany({
    data: [
      { profileId: profile.id, subjectId: SUBJECT, isActive: true },
      { profileId: profile.id, subjectId: OTHER_SUBJECT, isActive: false },
    ],
  });
});

afterAll(cleanUp);

describe("GET /revision", () => {
  it("is empty before the student has got anything wrong", async () => {
    const queue = await readQueue();

    expect(queue.dueToday).toBe(0);
    expect(queue.dueTotal).toBe(0);
    expect(queue.streak.current).toBe(0);
  });

  it("refuses a teacher", async () => {
    const teacher = await prisma.user.create({
      data: {
        clerkId: `${PREFIX}_teacher`,
        email: `${PREFIX}-teacher@example.test`,
        role: "TEACHER",
      },
      select: { clerkId: true },
    });

    // There is no teacher view of a student's queue, deliberately: what a
    // student has personally failed to retain is the most intimate data this
    // product holds, and the teacher-facing answer is the class aggregate.
    await request(app)
      .get("/api/v1/revision")
      .set("authorization", await bearer({ subject: teacher.clerkId }))
      .expect(403);
  });

  it("refuses an unauthenticated caller", async () => {
    await request(app).get("/api/v1/revision").expect(401);
  });
});

describe("answering wrongly puts a question into the queue", () => {
  it("schedules a review and records the day's work", async () => {
    await answer(Q_WRONGABLE, WRONG);

    const record = await prisma.mistakeRecord.findFirstOrThrow({
      where: { userId: studentId, questionId: Q_WRONGABLE },
      select: { nextReviewAt: true, repairedAt: true, intervalDays: true, graduatedAt: true },
    });

    // The column existed for two phases with nothing writing to it. This is the
    // assertion that says something now does.
    expect(record.nextReviewAt).not.toBeNull();
    expect(record.repairedAt).toBeNull();
    expect(record.intervalDays).toBe(1);
    expect(record.graduatedAt).toBeNull();

    const studyDay = await prisma.studyDay.findFirstOrThrow({
      where: { userId: studentId },
      select: { attempts: true, correct: true },
    });
    expect(studyDay.attempts).toBeGreaterThan(0);
    expect(studyDay.correct).toBe(0);
  });

  it("counts the streak from today's work", async () => {
    const queue = await readQueue();
    expect(queue.streak.current).toBe(1);
    expect(queue.streak.studiedToday).toBe(true);
  });

  it("is not due yet, because tomorrow is not today", async () => {
    const queue = await readQueue();

    // Scheduled for tomorrow, so it is upcoming rather than due. A schedule that
    // put a just-missed question straight back into today's queue would be
    // re-showing the solution the student is still looking at.
    expect(queue.dueTotal).toBe(0);
    expect(queue.dueThisWeek).toBe(1);
    expect(queue.nextDueAt).not.toBeNull();
  });

  it("ignores mistakes in a subject the student has dropped", async () => {
    await prisma.mistakeRecord.create({
      data: {
        userId: studentId,
        questionId: Q_OTHER_SUBJECT,
        nextReviewAt: new Date(Date.now() - 60_000),
      },
    });

    const queue = await readQueue();

    // The mistake is real and reviewing it is no longer the best use of half an
    // hour. A student who switched from Standard to Basic must not open their
    // revision to a course they left.
    expect(queue.dueTotal).toBe(0);
    expect(queue.bySubject.every((row) => row.subject.id !== OTHER_SUBJECT)).toBe(true);
  });
});

describe("the queue, once something is due", () => {
  it("reports it as due and attributes it to its subject", async () => {
    await makeDue(Q_WRONGABLE);

    const queue = await readQueue();

    expect(queue.dueTotal).toBe(1);
    expect(queue.dueToday).toBe(1);
    expect(queue.bySubject).toHaveLength(1);
    expect(queue.bySubject[0]?.subject.id).toBe(SUBJECT);
    expect(queue.bySubject[0]?.due).toBe(1);
  });

  it("builds a review session from exactly what the queue counted", async () => {
    const session = await startReview();

    expect(session.mode).toBe("REVIEW_DUE");

    // A due mistake in the dropped Maths subject is still sitting in the table
    // from the test above, which makes this a regression test rather than a
    // formality: the count and the session were scoped differently, so the queue
    // said "1 due" and handed back two questions, one from a course the student
    // had left. A count and the thing it counts have to be the same query.
    expect(session.items.map((item) => item.question.id)).toEqual([Q_WRONGABLE]);
  });

  it("resumes the current review instead of materialising it twice", async () => {
    const first = await startReview();
    const second = await startReview();

    expect(second.id).toBe(first.id);
    expect(
      await prisma.practiceSession.count({
        where: { userId: studentId, mode: "REVIEW_DUE", status: "IN_PROGRESS" },
      }),
    ).toBe(1);
  });

  it("refuses to start when nothing is due", async () => {
    // Clearing the schedule rather than the record: "nothing due" and "no
    // mistakes" are different states and only the first is being tested.
    await prisma.mistakeRecord.updateMany({
      where: { userId: studentId },
      data: { nextReviewAt: null },
    });

    await request(app)
      .post("/api/v1/revision/sessions")
      .set("authorization", student)
      .send({})
      .expect(404);
  });
});

describe("a repaired mistake stays in the queue until it graduates", () => {
  it("keeps scheduling a question the student has now got right once", async () => {
    await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
    await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });

    await answer(Q_SECOND, WRONG);
    await answer(Q_SECOND, RIGHT);

    const record = await prisma.mistakeRecord.findFirstOrThrow({
      where: { userId: studentId, questionId: Q_SECOND },
      select: { repairedAt: true, nextReviewAt: true, reviewStreak: true, graduatedAt: true },
    });

    // The heart of the feature. Under the old model one correct answer ended the
    // story; getting it right ninety seconds after reading the solution is
    // recognition, not recall, and the forgetting curve is unmoved by it.
    expect(record.repairedAt).not.toBeNull();
    expect(record.nextReviewAt).not.toBeNull();
    expect(record.reviewStreak).toBe(1);
    expect(record.graduatedAt).toBeNull();
  });

  it("graduates after four consecutive successes and leaves the queue for good", async () => {
    for (let success = 0; success < 3; success += 1) {
      await makeDue(Q_SECOND);
      await answer(Q_SECOND, RIGHT);
    }

    const record = await prisma.mistakeRecord.findFirstOrThrow({
      where: { userId: studentId, questionId: Q_SECOND },
      select: { graduatedAt: true, nextReviewAt: true, reviewStreak: true },
    });

    expect(record.reviewStreak).toBe(4);
    expect(record.graduatedAt).not.toBeNull();
    // A queue that only grows is a queue that gets abandoned. This is the reward
    // the whole schedule pays out.
    expect(record.nextReviewAt).toBeNull();

    const queue = await readQueue();
    expect(queue.graduated).toBe(1);
    expect(queue.dueTotal).toBe(0);
  });

  it("reopens a graduated question if it is ever missed again", async () => {
    await answer(Q_SECOND, WRONG);

    const record = await prisma.mistakeRecord.findFirstOrThrow({
      where: { userId: studentId, questionId: Q_SECOND },
      select: { graduatedAt: true, nextReviewAt: true, reviewStreak: true, repairedAt: true },
    });

    expect(record.graduatedAt).toBeNull();
    expect(record.repairedAt).toBeNull();
    expect(record.reviewStreak).toBe(0);
    expect(record.nextReviewAt).not.toBeNull();
  });
});

describe("ownership", () => {
  it("shows a stranger their own empty queue, not this student's", async () => {
    const response = await request(app)
      .get("/api/v1/revision")
      .set("authorization", stranger)
      .expect(200);

    expect(successResponseSchema(revisionQueueSchema).parse(response.body).data.dueTotal).toBe(0);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

async function readQueue() {
  const response = await request(app)
    .get("/api/v1/revision")
    .set("authorization", student)
    .expect(200);

  return successResponseSchema(revisionQueueSchema).parse(response.body).data;
}

async function startReview() {
  const response = await request(app)
    .post("/api/v1/revision/sessions")
    .set("authorization", student)
    .send({})
    .expect(201);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

/**
 * Answer one question in a throwaway single-question session.
 *
 * A new session each time, deliberately: answering is idempotent *within* a
 * session, so re-answering the same question in the same session would return
 * the first attempt and none of the scheduling below would run. Repeated review
 * of one question is exactly what this feature is, so it has to be modelled the
 * way it actually happens — separate sittings.
 */
async function answer(questionId: string, choice: typeof RIGHT | typeof WRONG): Promise<void> {
  // Option ids are namespaced per question, so the caller names the *choice* and
  // this resolves it. Passing the bare constant would submit an option id that
  // belongs to no question, which grades as a blank answer — and a blank is
  // wrong, so every "correct" case in this file would have quietly tested the
  // incorrect path.
  const optionId = `${questionId}-${choice}`;
  const created = await request(app)
    .post("/api/v1/practice-sessions")
    .set("authorization", student)
    .send({ mode: "CUSTOM", filters: {}, count: 1 })
    .expect(201);

  const session = successResponseSchema(practiceSessionSchema).parse(created.body).data;

  // The selector picks at random from the chapter, so the set is overwritten
  // with the question under test. Going through the API for the *answer* is what
  // matters here — that is the path the rollups hang off.
  await prisma.practiceSession.update({
    where: { id: session.id },
    data: { questionIds: [questionId], totalQuestions: 1 },
  });

  await request(app)
    .post(`/api/v1/practice-sessions/${session.id}/attempts`)
    .set("authorization", student)
    .send({
      questionId,
      responses: [{ targetId: questionId, answer: { optionIds: [optionId], text: "" } }],
      timeSpentMs: 5_000,
    })
    .expect(200);
}

/** Pull a scheduled review back into the past so it counts as due. */
async function makeDue(questionId: string): Promise<void> {
  await prisma.mistakeRecord.updateMany({
    where: { userId: studentId, questionId },
    data: { nextReviewAt: new Date(Date.now() - 60_000) },
  });
}

async function makeMcq(
  id: string,
  subjectId: string,
  chapterId: string,
  topicId: string | null,
): Promise<void> {
  await prisma.question.create({
    data: {
      id,
      subjectId,
      chapterId,
      type: "MCQ",
      body: `Question ${id}`,
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      options: {
        create: [
          { id: `${id}-${RIGHT}`, label: "A", body: "Right", isCorrect: true, orderIndex: 0 },
          { id: `${id}-${WRONG}`, label: "B", body: "Wrong", orderIndex: 1 },
        ],
      },
      answer: { create: { solution: "Because." } },
      ...(topicId ? { topics: { create: [{ topicId, isPrimary: true }] } } : {}),
    },
  });
}

async function cleanUp(): Promise<void> {
  const owned = { user: { clerkId: { startsWith: PREFIX } } };

  await prisma.questionAttempt.deleteMany({ where: owned });
  await prisma.practiceSession.deleteMany({ where: owned });
  await prisma.mistakeRecord.deleteMany({ where: owned });
  await prisma.studyDay.deleteMany({ where: owned });
  await prisma.bookmark.deleteMany({ where: owned });
  await prisma.topicMastery.deleteMany({ where: owned });
  await prisma.subjectProgress.deleteMany({ where: owned });
  await prisma.subjectEnrolment.deleteMany({
    where: { profile: { user: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.studentProfile.deleteMany({ where: owned });
  await prisma.question.deleteMany({ where: { subjectId: { in: [SUBJECT, OTHER_SUBJECT] } } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
