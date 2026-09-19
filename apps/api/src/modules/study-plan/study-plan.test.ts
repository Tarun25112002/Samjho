import { dailyStudyPlanSchema, successResponseSchema } from "@medhavi/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { istDay, toDayKey } from "../../lib/study-day.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The plan has no mutable state of its own, so these tests exercise the things
 * it must compose without crossing their ownership boundaries: live sessions,
 * teacher briefs, revision debt, and per-student mastery.
 */
const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "study-plan-test";
const SUBJECT = `${PREFIX}-science`;
const CHAPTER = `${PREFIX}-electricity`;
const TOPIC = `${PREFIX}-ohms-law`;
const QUESTION = `${PREFIX}-question`;

let student: string;
let studentId: string;
let stranger: string;
let teacher: string;
let assignmentId: string;

beforeAll(async () => {
  await cleanUp();

  const teacherUser = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}-teacher`,
      email: `${PREFIX}-teacher@example.test`,
      role: "TEACHER",
      teacherProfile: { create: {} },
    },
    select: { id: true, clerkId: true },
  });
  teacher = await bearer({ subject: teacherUser.clerkId });

  const studentUser = await makeStudent("student");
  studentId = studentUser.id;
  student = studentUser.token;
  stranger = (await makeStudent("stranger")).token;

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "SPTSCI",
      name: "Study Plan Science",
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
      id: QUESTION,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "MCQ",
      body: "Which relationship describes Ohm's law?",
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      options: {
        create: [
          { id: `${QUESTION}-right`, label: "A", body: "V = IR", isCorrect: true, orderIndex: 0 },
          { id: `${QUESTION}-wrong`, label: "B", body: "V = I/R", orderIndex: 1 },
        ],
      },
      answer: { create: { solution: "Voltage equals current times resistance." } },
      topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
    },
  });

  const profile = await prisma.studentProfile.findUniqueOrThrow({
    where: { userId: studentId },
    select: { id: true },
  });
  await prisma.subjectEnrolment.create({ data: { profileId: profile.id, subjectId: SUBJECT } });

  const classroom = await prisma.classroom.create({
    data: {
      teacherId: teacherUser.id,
      subjectId: SUBJECT,
      name: "10B Science",
      joinCode: "SPLAN1",
      members: { create: { studentId } },
    },
    select: { id: true },
  });
  const assignment = await prisma.classroomAssignment.create({
    data: {
      classroomId: classroom.id,
      chapterId: CHAPTER,
      title: "Electricity follow-up",
      questionCount: 6,
      sourcePool: "SHARED",
      questionIds: [],
      dueAt: new Date(Date.now() - 60_000),
    },
    select: { id: true },
  });
  assignmentId = assignment.id;

  await prisma.mistakeRecord.create({
    data: { userId: studentId, questionId: QUESTION, nextReviewAt: new Date(Date.now() - 60_000) },
  });
  await prisma.topicMastery.create({
    data: {
      userId: studentId,
      topicId: TOPIC,
      attempted: 4,
      correct: 1,
      marksEarned: 1,
      marksPossible: 4,
      masteryScore: 0.25,
      unrepairedMistakes: 1,
    },
  });
});

afterAll(cleanUp);

describe("GET /api/v1/study-plan/today", () => {
  it("requires the student's own signed-in account", async () => {
    await request(app).get("/api/v1/study-plan/today").expect(401);
    await request(app).get("/api/v1/study-plan/today").set("authorization", teacher).expect(403);
  });

  it("ranks an overdue teacher brief, due review, then the weakest topic", async () => {
    const plan = await readPlan(student);

    expect(plan.date).toBe(toDayKey(istDay(new Date())));
    expect(plan.items.map((item) => item.kind)).toEqual(["ASSIGNMENT", "REVIEW", "TOPIC_PRACTICE"]);
    expect(plan.items[0]).toMatchObject({
      kind: "ASSIGNMENT",
      assignmentId,
      progress: "NOT_STARTED",
    });
    expect(plan.items[1]).toMatchObject({ kind: "REVIEW", dueToday: 1, count: 1 });
    expect(plan.items[2]).toMatchObject({ kind: "TOPIC_PRACTICE", topicId: TOPIC });

    // A recommendation is not a question transport. The execution endpoints
    // own frozen question sets and answer visibility.
    expect(JSON.stringify(plan)).not.toContain(QUESTION);
  });

  it("never shows another student's classroom assignment", async () => {
    const plan = await readPlan(stranger);

    expect(plan.items.some((item) => item.kind === "ASSIGNMENT")).toBe(false);
    expect(JSON.stringify(plan)).not.toContain(assignmentId);
  });

  it("does not recommend work from a subject the student has left", async () => {
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: studentId },
      select: { id: true },
    });

    await prisma.subjectEnrolment.update({
      where: { profileId_subjectId: { profileId: profile.id, subjectId: SUBJECT } },
      data: { isActive: false },
    });

    try {
      const plan = await readPlan(student);
      expect(plan.items).toEqual([]);
    } finally {
      await prisma.subjectEnrolment.update({
        where: { profileId_subjectId: { profileId: profile.id, subjectId: SUBJECT } },
        data: { isActive: true },
      });
    }
  });

  it("makes an existing session the only next step", async () => {
    const session = await prisma.practiceSession.create({
      data: {
        userId: studentId,
        mode: "QUICK",
        filtersJson: { unseenOnly: true },
        questionIds: [QUESTION],
        totalQuestions: 1,
      },
      select: { id: true },
    });

    const plan = await readPlan(student);
    expect(plan.items).toEqual([
      expect.objectContaining({
        kind: "RESUME",
        sessionId: session.id,
        answered: 0,
        totalQuestions: 1,
      }),
    ]);

    await prisma.practiceSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

  it("gives a new enrolled student a small fresh starting point", async () => {
    const newcomer = await makeStudent("newcomer");
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: newcomer.id },
      select: { id: true },
    });
    await prisma.subjectEnrolment.create({ data: { profileId: profile.id, subjectId: SUBJECT } });

    const plan = await readPlan(newcomer.token);
    expect(plan.items).toEqual([
      expect.objectContaining({
        kind: "TOPIC_PRACTICE",
        subject: expect.objectContaining({ id: SUBJECT }),
        topicId: null,
        questionCount: 6,
        unseenOnly: true,
      }),
    ]);
  });
});

async function readPlan(authorization: string) {
  const response = await request(app)
    .get("/api/v1/study-plan/today")
    .set("authorization", authorization)
    .expect(200);

  return successResponseSchema(dailyStudyPlanSchema).parse(response.body).data;
}

async function makeStudent(suffix: string): Promise<{ id: string; token: string }> {
  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}-${suffix}`,
      email: `${PREFIX}-${suffix}@example.test`,
      name: `Study Plan ${suffix}`,
      studentProfile: { create: { classLevel: 10, onboardedAt: new Date() } },
    },
    select: { id: true, clerkId: true },
  });
  return { id: user.id, token: await bearer({ subject: user.clerkId }) };
}

async function cleanUp(): Promise<void> {
  const ownedUsers = { clerkId: { startsWith: PREFIX } };

  await prisma.questionAttempt.deleteMany({ where: { user: ownedUsers } });
  await prisma.assignmentSubmission.deleteMany({ where: { student: ownedUsers } });
  await prisma.practiceSession.deleteMany({ where: { user: ownedUsers } });
  await prisma.mistakeRecord.deleteMany({ where: { user: ownedUsers } });
  await prisma.topicMastery.deleteMany({ where: { user: ownedUsers } });
  await prisma.subjectProgress.deleteMany({ where: { user: ownedUsers } });
  await prisma.studyDay.deleteMany({ where: { user: ownedUsers } });
  await prisma.classroomAssignment.deleteMany({
    where: { classroom: { teacher: ownedUsers } },
  });
  await prisma.classroomMembership.deleteMany({
    where: { classroom: { teacher: ownedUsers } },
  });
  await prisma.classroom.deleteMany({ where: { teacher: ownedUsers } });
  await prisma.subjectEnrolment.deleteMany({ where: { profile: { user: ownedUsers } } });
  await prisma.studentProfile.deleteMany({ where: { user: ownedUsers } });
  await prisma.teacherProfile.deleteMany({ where: { user: ownedUsers } });
  await prisma.question.deleteMany({ where: { id: QUESTION } });
  await prisma.topic.deleteMany({ where: { id: TOPIC } });
  await prisma.chapter.deleteMany({ where: { id: CHAPTER } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT } });
  await prisma.user.deleteMany({ where: ownedUsers });
  await prisma.$disconnect();
}
