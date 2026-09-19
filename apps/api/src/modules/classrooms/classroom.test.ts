import {
  assignmentItemAnalysisSchema,
  classroomDiagnosticsSchema,
  practiceSessionSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Teacher-set work end to end: hand-built tests, timers and class diagnostics.
 *
 * Four things here are load-bearing:
 *
 *  1. **A curated test delivers the questions the teacher picked, in order.**
 *     The whole reason `CURATED` exists is that a drawn set gives every student
 *     different questions, which makes marks incomparable and item analysis
 *     meaningless.
 *  2. **A teacher-bank assignment delivers anything at all.** It did not. The
 *     selector drew from the teacher's bank and the hydrator filtered on
 *     `ownerTeacherId: null`, so every question dropped out between the two and
 *     the student got an empty set. Nothing exercised that path end to end,
 *     which is why it survived. The first test in that block is the regression.
 *  3. **The timer is the server's.** A late answer is refused against the stored
 *     deadline whatever the client believes the time is.
 *  4. **Diagnostics counts distractors**, which is the one thing on that page a
 *     teacher cannot get from an accuracy percentage.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "ctest";
const SUBJECT = `${PREFIX}-science`;
const CHAPTER = `${PREFIX}-ch`;
const TOPIC = `${PREFIX}-topic`;

/** Three shared-bank questions, deliberately created out of marks order. */
const Q_ONE = `${PREFIX}-q-1`;
const Q_TWO = `${PREFIX}-q-2`;
const Q_THREE = `${PREFIX}-q-3`;
/** One owned by the teacher — the bank a student may never browse. */
const Q_TEACHER = `${PREFIX}-q-teacher`;

let teacher: string;
let teacherId: string;
let studentA: string;
let studentAId: string;
let studentB: string;
let studentBId: string;
let classroomId: string;

beforeAll(async () => {
  await cleanUp();

  const teacherUser = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_teacher`,
      email: `${PREFIX}-teacher@example.test`,
      name: "Class Teacher",
      role: "TEACHER",
      teacherProfile: { create: {} },
    },
    select: { id: true, clerkId: true },
  });
  teacherId = teacherUser.id;
  teacher = await bearer({ subject: teacherUser.clerkId });

  const a = await makeStudent("a");
  studentAId = a.id;
  studentA = a.token;

  const b = await makeStudent("b");
  studentBId = b.id;
  studentB = b.token;

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "CTSCI",
      name: "Ctest Science",
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

  await makeMcq(Q_ONE, null);
  await makeMcq(Q_TWO, null);
  await makeMcq(Q_THREE, null);
  await makeMcq(Q_TEACHER, teacherId);

  const classroom = await prisma.classroom.create({
    data: {
      teacherId,
      subjectId: SUBJECT,
      name: "10B Science",
      joinCode: "CTEST1",
      members: { create: [{ studentId: studentAId }, { studentId: studentBId }] },
    },
    select: { id: true },
  });
  classroomId = classroom.id;
});

afterAll(cleanUp);

describe("a hand-built test", () => {
  let assignmentId: string;

  it("is created from the questions the teacher picked", async () => {
    const response = await request(app)
      .post(`/api/v1/classrooms/${classroomId}/assignments`)
      .set("authorization", teacher)
      .send({
        title: "Friday test",
        sourcePool: "CURATED",
        // Deliberately not in id order: the teacher's arrangement is the paper.
        questionIds: [Q_THREE, Q_ONE, Q_TWO],
        timeLimitMinutes: 30,
      })
      .expect(201);

    assignmentId = (response.body as { data: { assignmentId: string } }).data.assignmentId;

    const stored = await prisma.classroomAssignment.findUniqueOrThrow({
      where: { id: assignmentId },
      select: { questionIds: true, questionCount: true, timeLimitMinutes: true },
    });

    expect(stored.questionIds).toEqual([Q_THREE, Q_ONE, Q_TWO]);
    // The count is derived from the list rather than taken from the client, so
    // the two cannot disagree — and every count a student sees reads this column.
    expect(stored.questionCount).toBe(3);
    expect(stored.timeLimitMinutes).toBe(30);
  });

  it("refuses a question from another subject", async () => {
    const foreign = await prisma.subject.create({
      data: {
        id: `${PREFIX}-maths`,
        code: "CTMATH",
        name: "Ctest Maths",
        slug: `${PREFIX}-maths`,
        board: "CBSE",
        classLevel: 10,
        theoryMarks: 80,
        syllabusYear: "2026-27",
      },
      select: { id: true },
    });
    const foreignChapter = await prisma.chapter.create({
      data: {
        id: `${PREFIX}-ch-maths`,
        subjectId: foreign.id,
        name: "Real Numbers",
        slug: `${PREFIX}-ch-maths`,
        orderIndex: 0,
      },
      select: { id: true },
    });
    await prisma.question.create({
      data: {
        id: `${PREFIX}-q-maths`,
        subjectId: foreign.id,
        chapterId: foreignChapter.id,
        type: "MCQ",
        body: "A Maths question",
        marks: 1,
        difficulty: "EASY",
        expectedTimeSeconds: 60,
        status: "PUBLISHED",
      },
    });

    // Most likely to happen by accident, with a filter left on — and the people
    // who would otherwise discover it are the students, on the morning of.
    const rejected = await request(app)
      .post(`/api/v1/classrooms/${classroomId}/assignments`)
      .set("authorization", teacher)
      .send({
        title: "Wrong subject",
        sourcePool: "CURATED",
        questionIds: [Q_ONE, Q_TWO, `${PREFIX}-q-maths`],
      })
      .expect(400);

    // The message names how many were dropped, because "one of these is wrong"
    // sends a teacher back through a list they have already read.
    const body = rejected.body as { error: { details?: { path: string; message: string }[] } };
    expect(body.error.details?.[0]?.path).toBe("body.questionIds");
    expect(body.error.details?.[0]?.message).toMatch(/1 of those questions/);
  });

  it("refuses the same question twice", async () => {
    const rejected = await request(app)
      .post(`/api/v1/classrooms/${classroomId}/assignments`)
      .set("authorization", teacher)
      .send({
        title: "Duplicated question",
        sourcePool: "CURATED",
        questionIds: [Q_ONE, Q_ONE, Q_TWO],
      })
      .expect(400);

    const body = rejected.body as { error: { details?: { path: string; message: string }[] } };
    expect(body.error.details?.[0]?.path).toBe("body.questionIds");
    expect(body.error.details?.[0]?.message).toMatch(/only once/);
  });

  it("gives every student the same questions in the teacher's order", async () => {
    const first = await startAssignment(assignmentId, studentA);
    const second = await startAssignment(assignmentId, studentB);

    const order = [Q_THREE, Q_ONE, Q_TWO];
    expect(first.items.map((item) => item.question.id)).toEqual(order);
    // Two students, same paper. This is what makes their marks comparable and
    // the item analysis below arithmetic on something real.
    expect(second.items.map((item) => item.question.id)).toEqual(order);
  });

  it("carries the teacher's time limit onto the student's session", async () => {
    const session = await startAssignment(assignmentId, studentA);

    expect(session.timeLimitSeconds).toBe(30 * 60);
    expect(session.deadlineAt).not.toBeNull();
    expect(session.expired).toBe(false);
  });
});

describe("an assignment drawn from the teacher's own bank", () => {
  it("actually delivers the teacher's questions to the student", async () => {
    const created = await request(app)
      .post(`/api/v1/classrooms/${classroomId}/assignments`)
      .set("authorization", teacher)
      .send({ title: "From my bank", sourcePool: "TEACHER_BANK", questionCount: 3 })
      .expect(201);

    const session = await startAssignment(
      (created.body as { data: { assignmentId: string } }).data.assignmentId,
      studentB,
    );

    // The regression. This returned zero items: the selector drew from the
    // teacher's bank, then the hydrator filtered on `ownerTeacherId: null` and
    // threw every one of them away. A student opened their homework to an empty
    // set, and submitting an answer 404'd for the same reason.
    expect(session.items).toHaveLength(1);
    expect(session.items[0]?.question.id).toBe(Q_TEACHER);
  });
});

describe("the timer is the server's", () => {
  it("refuses an answer submitted after the deadline", async () => {
    const created = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentA)
      .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 3, timeLimitMinutes: 30 })
      .expect(201);

    const session = successResponseSchema(practiceSessionSchema).parse(created.body).data;
    expect(session.deadlineAt).not.toBeNull();

    // Move the deadline into the past rather than waiting thirty minutes. The
    // client is never consulted about the time, so there is nothing to fake on
    // that side — the stored instant is the whole mechanism.
    await prisma.practiceSession.update({
      where: { id: session.id },
      data: { deadlineAt: new Date(Date.now() - 1_000) },
    });

    const rejected = await request(app)
      .post(`/api/v1/practice-sessions/${session.id}/attempts`)
      .set("authorization", studentA)
      .send({
        questionId: Q_ONE,
        responses: [{ targetId: Q_ONE, answer: { optionIds: [], text: "" } }],
        timeSpentMs: 1_000,
      })
      .expect(409);

    expect((rejected.body as { error: { message: string } }).error.message).toMatch(/Time is up/);
  });

  it("closes an expired set at its deadline, not when the student came back", async () => {
    const created = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentA)
      .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 3, timeLimitMinutes: 30 })
      .expect(201);

    const session = successResponseSchema(practiceSessionSchema).parse(created.body).data;
    const deadline = new Date(Date.now() - 5 * 60 * 60 * 1000);

    await prisma.practiceSession.update({
      where: { id: session.id },
      data: { deadlineAt: deadline },
    });

    const reloaded = await readSession(session.id, studentA);

    expect(reloaded.status).toBe("COMPLETED");
    expect(reloaded.expired).toBe(true);
    // Five hours ago, not now. Recording the moment they reopened it would put
    // five hours of nothing into their history and make `expired` depend on when
    // they happened to come back.
    expect(reloaded.completedAt).toBe(deadline.toISOString());
  });

  it("counts a part-answered expired set towards the subject rollup, like any other", async () => {
    const session = await timedSessionWithOneAnswer();
    const before = await sessionCount();

    await expireNow(session.id);
    await readSession(session.id, studentA);

    // The first version of the expiry path wrote the status and stopped, so a
    // set the student finished counted and an identical one the clock closed did
    // not. A student who times out three days running would have watched their
    // session count sit still while their attempts climbed.
    expect(await sessionCount()).toBe(before + 1);
  });

  it("does not double-count when two tabs load the same expired set", async () => {
    const session = await timedSessionWithOneAnswer();
    const before = await sessionCount();

    await expireNow(session.id);

    // Both reads see an IN_PROGRESS session and both try to close it. The
    // guarded `updateMany` means one wins and the other does nothing — without
    // it the subject rollup gains two sessions for one set, and nothing
    // downstream would ever correct it.
    await Promise.all([readSession(session.id, studentA), readSession(session.id, studentA)]);

    expect(await sessionCount()).toBe(before + 1);
  });

  it("leaves an untimed set alone", async () => {
    const created = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentA)
      .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 3 })
      .expect(201);

    const session = successResponseSchema(practiceSessionSchema).parse(created.body).data;

    expect(session.timeLimitSeconds).toBeNull();
    expect(session.deadlineAt).toBeNull();
    expect(session.expired).toBe(false);
  });
});

describe("class diagnostics", () => {
  it("counts which wrong option the class chose", async () => {
    // Both students pick the same wrong option on the same question — a shared
    // misconception, which is the thing an accuracy percentage cannot express.
    const first = await startAssignment(await curatedAssignment("Diagnostics test"), studentA);
    await answerIn(first.id, Q_ONE, `${Q_ONE}-wrong`, studentA);

    const second = await startAssignment(lastAssignmentId, studentB);
    await answerIn(second.id, Q_ONE, `${Q_ONE}-wrong`, studentB);

    const response = await request(app)
      .get(`/api/v1/classrooms/assignments/${lastAssignmentId}/item-analysis`)
      .set("authorization", teacher)
      .expect(200);

    const analysis = successResponseSchema(assignmentItemAnalysisSchema).parse(response.body).data;
    const item = analysis.items.find((row) => row.questionId === Q_ONE);

    expect(analysis.sameQuestionsForEveryone).toBe(true);
    expect(item).toBeDefined();
    expect(item?.attempted).toBe(2);
    expect(item?.correct).toBe(0);

    const wrongOption = item?.options.find((option) => !option.isCorrect);
    // "Two of the two who missed this chose B" — the sentence a teacher can
    // teach from, and the entire reason this surface exists.
    expect(wrongOption?.chosenBy).toBe(2);
    expect(item?.options.find((option) => option.isCorrect)?.chosenBy).toBe(0);
  });

  it("shows the teacher their class, weakest topics first", async () => {
    const response = await request(app)
      .get(`/api/v1/classrooms/${classroomId}/diagnostics`)
      .set("authorization", teacher)
      .expect(200);

    const diagnostics = successResponseSchema(classroomDiagnosticsSchema).parse(response.body).data;

    expect(diagnostics.studentCount).toBe(2);
    expect(diagnostics.hardestQuestions.length).toBeGreaterThan(0);
    expect(diagnostics.classScoreRatio).not.toBeNull();
  });

  it("refuses a teacher who does not own the classroom", async () => {
    const outsider = await prisma.user.create({
      data: {
        clerkId: `${PREFIX}_outsider`,
        email: `${PREFIX}-outsider@example.test`,
        role: "TEACHER",
        teacherProfile: { create: {} },
      },
      select: { clerkId: true },
    });

    // 404 rather than 403: a 403 would confirm the classroom exists.
    await request(app)
      .get(`/api/v1/classrooms/${classroomId}/diagnostics`)
      .set("authorization", await bearer({ subject: outsider.clerkId }))
      .expect(404);
  });

  it("refuses a student outright", async () => {
    await request(app)
      .get(`/api/v1/classrooms/${classroomId}/diagnostics`)
      .set("authorization", studentA)
      .expect(403);
  });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

let lastAssignmentId = "";

async function curatedAssignment(title: string): Promise<string> {
  const response = await request(app)
    .post(`/api/v1/classrooms/${classroomId}/assignments`)
    .set("authorization", teacher)
    .send({ title, sourcePool: "CURATED", questionIds: [Q_ONE, Q_TWO, Q_THREE] })
    .expect(201);

  lastAssignmentId = (response.body as { data: { assignmentId: string } }).data.assignmentId;
  return lastAssignmentId;
}

async function startAssignment(assignmentId: string, auth: string) {
  const response = await request(app)
    .post(`/api/v1/classrooms/assignments/${assignmentId}/start`)
    .set("authorization", auth)
    .expect(201);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

/**
 * A timed set with one question answered in it.
 *
 * The answer is the point. `findSessionSubjectIds` derives a session's subjects
 * from its *attempts*, so a set nobody answered belongs to no subject and counts
 * towards nothing — on the Finish path as much as the expiry one. Testing the
 * rollup with an empty set would have been testing that zero equals zero.
 */
async function timedSessionWithOneAnswer() {
  const created = await request(app)
    .post("/api/v1/practice-sessions")
    .set("authorization", studentA)
    .send({ mode: "CHAPTER", filters: { chapterId: CHAPTER }, count: 3, timeLimitMinutes: 30 })
    .expect(201);

  const session = successResponseSchema(practiceSessionSchema).parse(created.body).data;
  const first = session.items[0];
  if (!first) throw new Error("The chapter should have produced at least one question.");

  await answerIn(session.id, first.question.id, `${first.question.id}-right`, studentA);
  return session;
}

async function sessionCount(): Promise<number> {
  const row = await prisma.subjectProgress.findUnique({
    where: { userId_subjectId: { userId: studentAId, subjectId: SUBJECT } },
    select: { practiceSessions: true },
  });

  return row?.practiceSessions ?? 0;
}

async function expireNow(sessionId: string): Promise<void> {
  await prisma.practiceSession.update({
    where: { id: sessionId },
    data: { deadlineAt: new Date(Date.now() - 1_000) },
  });
}

async function readSession(sessionId: string, auth: string) {
  const response = await request(app)
    .get(`/api/v1/practice-sessions/${sessionId}`)
    .set("authorization", auth)
    .expect(200);

  return successResponseSchema(practiceSessionSchema).parse(response.body).data;
}

async function answerIn(
  sessionId: string,
  questionId: string,
  optionId: string,
  auth: string,
): Promise<void> {
  await request(app)
    .post(`/api/v1/practice-sessions/${sessionId}/attempts`)
    .set("authorization", auth)
    .send({
      questionId,
      responses: [{ targetId: questionId, answer: { optionIds: [optionId], text: "" } }],
      timeSpentMs: 4_000,
    })
    .expect(200);
}

async function makeStudent(suffix: string): Promise<{ id: string; token: string }> {
  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student_${suffix}`,
      email: `${PREFIX}-student-${suffix}@example.test`,
      name: `Student ${suffix.toUpperCase()}`,
      studentProfile: { create: { classLevel: 10, onboardedAt: new Date() } },
    },
    select: { id: true, clerkId: true },
  });

  return { id: user.id, token: await bearer({ subject: user.clerkId }) };
}

async function makeMcq(id: string, ownerTeacherId: string | null): Promise<void> {
  await prisma.question.create({
    data: {
      id,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "MCQ",
      body: `Question ${id}`,
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      ownerTeacherId,
      options: {
        create: [
          { id: `${id}-right`, label: "A", body: "Right", isCorrect: true, orderIndex: 0 },
          { id: `${id}-wrong`, label: "B", body: "Wrong", orderIndex: 1 },
        ],
      },
      answer: { create: { solution: "Because." } },
      topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
    },
  });
}

async function cleanUp(): Promise<void> {
  const owned = { user: { clerkId: { startsWith: PREFIX } } };

  await prisma.questionAttempt.deleteMany({ where: owned });
  await prisma.assignmentSubmission.deleteMany({
    where: { student: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({ where: owned });
  await prisma.mistakeRecord.deleteMany({ where: owned });
  await prisma.studyDay.deleteMany({ where: owned });
  await prisma.topicMastery.deleteMany({ where: owned });
  await prisma.subjectProgress.deleteMany({ where: owned });
  await prisma.classroomAssignment.deleteMany({
    where: { classroom: { teacher: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.classroomMembership.deleteMany({
    where: { classroom: { teacher: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.classroom.deleteMany({
    where: { teacher: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({ where: { subject: { id: { startsWith: PREFIX } } } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subjectEnrolment.deleteMany({
    where: { profile: { user: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.studentProfile.deleteMany({ where: owned });
  await prisma.teacherProfile.deleteMany({ where: owned });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
