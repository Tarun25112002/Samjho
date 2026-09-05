import { meResponseSchema, teacherBankResponseSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The teacher workspace, against real Postgres.
 *
 * The load-bearing test in this file is **"a teacher's own questions never
 * reach open practice"**. Everything else here is ordinary authorization
 * plumbing; that one is the invariant the whole ownership design exists to
 * hold, and it is the failure that would be found last and cost most — one
 * teacher's unreviewed OCR served to every student in the country.
 *
 * It is written as a query through the real student-facing predicate rather
 * than as an assertion about a `where` clause, because the way this breaks is
 * a new query that forgets to spread `STUDENT_VISIBLE_QUESTION` in. Asserting
 * on the constant would pass while the leak was live.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "ttest";
const SUBJECT = `${PREFIX}-subject`;
const CHAPTER = `${PREFIX}-chapter`;
const TOPIC = `${PREFIX}-topic`;
const OWNED_QUESTION = `${PREFIX}-q-owned`;
const SHARED_QUESTION = `${PREFIX}-q-shared`;
const OTHER_TEACHER_QUESTION = `${PREFIX}-q-other`;

let teacherAuth: string;
let otherTeacherAuth: string;
let studentAuth: string;
let teacherId: string;
let otherTeacherId: string;

beforeAll(async () => {
  await cleanUp();

  const teacher = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_teacher`,
      email: `${PREFIX}-teacher@example.test`,
      name: "Meera Teacher",
      role: "TEACHER",
      teacherProfile: { create: { onboardedAt: new Date() } },
    },
    select: { id: true, clerkId: true },
  });
  teacherId = teacher.id;
  teacherAuth = await bearer({ subject: teacher.clerkId });

  const otherTeacher = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_other_teacher`,
      email: `${PREFIX}-other@example.test`,
      role: "TEACHER",
      teacherProfile: { create: { onboardedAt: new Date() } },
    },
    select: { id: true, clerkId: true },
  });
  otherTeacherId = otherTeacher.id;
  otherTeacherAuth = await bearer({ subject: otherTeacher.clerkId });

  const student = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}-student@example.test` },
    select: { clerkId: true },
  });
  studentAuth = await bearer({ subject: student.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      code: `${PREFIX}-SCI`,
      name: "Test Science",
      slug: `${PREFIX}-science`,
      syllabusYear: "2026-27",
      theoryMarks: 80,
      internalMarks: 20,
      chapters: {
        create: {
          id: CHAPTER,
          name: "Electricity",
          slug: `${PREFIX}-electricity`,
          orderIndex: 0,
          topics: {
            create: { id: TOPIC, name: "Ohm's law", slug: `${PREFIX}-ohms-law`, orderIndex: 0 },
          },
        },
      },
    },
  });

  // Three published questions that differ only in who owns them. Same subject,
  // same chapter, same status — so anything that tells them apart downstream is
  // the ownership rule and nothing else.
  for (const [id, ownerTeacherId] of [
    [SHARED_QUESTION, null],
    [OWNED_QUESTION, teacherId],
    [OTHER_TEACHER_QUESTION, otherTeacherId],
  ] as const) {
    await prisma.question.create({
      data: {
        id,
        subjectId: SUBJECT,
        chapterId: CHAPTER,
        ownerTeacherId,
        type: "SHORT_ANSWER",
        body: `Question ${id}`,
        marks: 2,
        difficulty: "MEDIUM",
        expectedTimeSeconds: 120,
        status: "PUBLISHED",
        publishedAt: new Date(),
        answer: { create: { solution: "A solution." } },
        topics: { create: { topicId: TOPIC, isPrimary: true } },
      },
    });
  }
});

afterAll(async () => {
  await cleanUp();
});

describe("teacher routes are teacher-only", () => {
  it("refuses a student", async () => {
    await request(app)
      .get("/api/v1/teacher/dashboard")
      .set("authorization", studentAuth)
      .expect(403);
  });

  it("refuses an anonymous caller", async () => {
    await request(app).get("/api/v1/teacher/dashboard").expect(401);
  });

  it("serves a teacher", async () => {
    const response = await request(app)
      .get("/api/v1/teacher/dashboard")
      .set("authorization", teacherAuth)
      .expect(200);

    expect(response.body.data.bank.total).toBe(1);
  });
});

describe("the question bank is scoped to its owner", () => {
  it("returns only this teacher's questions", async () => {
    const response = await request(app)
      .get("/api/v1/teacher/questions")
      .set("authorization", teacherAuth)
      .expect(200);

    const data = teacherBankResponseSchema.parse(response.body.data);
    expect(data.items.map((item) => item.id)).toEqual([OWNED_QUESTION]);
  });

  it("does not show one teacher another teacher's bank", async () => {
    const response = await request(app)
      .get("/api/v1/teacher/questions")
      .set("authorization", otherTeacherAuth)
      .expect(200);

    const data = teacherBankResponseSchema.parse(response.body.data);
    expect(data.items.map((item) => item.id)).toEqual([OTHER_TEACHER_QUESTION]);
  });

  it("counts facets over the owner's questions only", async () => {
    const response = await request(app)
      .get("/api/v1/teacher/questions")
      .set("authorization", teacherAuth)
      .expect(200);

    const data = teacherBankResponseSchema.parse(response.body.data);
    expect(data.facets.total).toBe(1);
    expect(data.facets.byChapter).toEqual([
      { chapterId: CHAPTER, chapterName: "Electricity", count: 1 },
    ]);
  });

  it("refuses to change the status of a question owned by someone else", async () => {
    await request(app)
      .put(`/api/v1/teacher/questions/${OTHER_TEACHER_QUESTION}/status`)
      .set("authorization", teacherAuth)
      .send({ status: "ARCHIVED" })
      .expect(404);

    const unchanged = await prisma.question.findUnique({
      where: { id: OTHER_TEACHER_QUESTION },
      select: { status: true },
    });
    expect(unchanged?.status).toBe("PUBLISHED");
  });
});

describe("teacher-owned questions stay out of the shared bank", () => {
  /**
   * The invariant, checked through the routes a student actually uses rather
   * than against the predicate constant — because the way this breaks is a
   * query that forgot to apply the predicate at all.
   */
  it("does not serve them from the student question list", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&limit=50`)
      .set("authorization", studentAuth)
      .expect(200);

    const ids: string[] = response.body.data.items.map((item: { id: string }) => item.id);

    expect(ids).toContain(SHARED_QUESTION);
    expect(ids).not.toContain(OWNED_QUESTION);
    expect(ids).not.toContain(OTHER_TEACHER_QUESTION);
  });

  it("does not draw them into an ordinary practice session", async () => {
    const response = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentAuth)
      .send({ mode: "CUSTOM", filters: { subjectId: SUBJECT, unseenOnly: false }, count: 20 })
      .expect(201);

    const ids: string[] = response.body.data.items.map(
      (item: { question: { id: string } }) => item.question.id,
    );

    expect(ids).toContain(SHARED_QUESTION);
    expect(ids).not.toContain(OWNED_QUESTION);
    expect(ids).not.toContain(OTHER_TEACHER_QUESTION);
  });

  it("does not let a student bookmark one", async () => {
    await request(app)
      .post("/api/v1/bookmarks")
      .set("authorization", studentAuth)
      .send({ questionId: OWNED_QUESTION })
      .expect(404);
  });
});

describe("becoming a teacher", () => {
  it("elevates a fresh account and gives it a profile", async () => {
    const fresh = await prisma.user.create({
      data: { clerkId: `${PREFIX}_fresh`, email: `${PREFIX}-fresh@example.test` },
      select: { id: true, clerkId: true },
    });
    const auth = await bearer({ subject: fresh.clerkId });

    const response = await request(app)
      .post("/api/v1/me/teacher-onboarding")
      .set("authorization", auth)
      .send({ school: "Test School", subjectsTaught: "Class 10 Science", termsAccepted: true })
      .expect(200);

    const me = meResponseSchema.parse(response.body.data);
    expect(me.user.role).toBe("TEACHER");
    expect(me.onboarded).toBe(true);
    expect(me.teacherProfile?.school).toBe("Test School");
  });

  it("refuses an account that has already onboarded as a student", async () => {
    const enrolled = await prisma.user.create({
      data: {
        clerkId: `${PREFIX}_enrolled`,
        email: `${PREFIX}-enrolled@example.test`,
        studentProfile: { create: { classLevel: 10, onboardedAt: new Date() } },
      },
      select: { clerkId: true },
    });
    const auth = await bearer({ subject: enrolled.clerkId });

    await request(app)
      .post("/api/v1/me/teacher-onboarding")
      .set("authorization", auth)
      .send({ termsAccepted: true })
      .expect(409);
  });

  it("refuses an admin, so a form cannot quietly demote one", async () => {
    const admin = await prisma.user.create({
      data: { clerkId: `${PREFIX}_admin`, email: `${PREFIX}-admin@example.test`, role: "ADMIN" },
      select: { clerkId: true },
    });
    const auth = await bearer({ subject: admin.clerkId });

    await request(app)
      .post("/api/v1/me/teacher-onboarding")
      .set("authorization", auth)
      .send({ termsAccepted: true })
      .expect(403);

    const unchanged = await prisma.user.findUnique({
      where: { clerkId: `${PREFIX}_admin` },
      select: { role: true },
    });
    expect(unchanged?.role).toBe("ADMIN");
  });

  it("will not accept an unticked terms box", async () => {
    const fresh = await prisma.user.create({
      data: { clerkId: `${PREFIX}_noterms`, email: `${PREFIX}-noterms@example.test` },
      select: { clerkId: true },
    });
    const auth = await bearer({ subject: fresh.clerkId });

    await request(app)
      .post("/api/v1/me/teacher-onboarding")
      .set("authorization", auth)
      .send({ termsAccepted: false })
      .expect(400);
  });
});

describe("a teacher is not onboarded until they have a profile", () => {
  it("reports onboarded: false for a TEACHER with no profile row", async () => {
    // The state the migration's backfill exists to prevent. Worth a test
    // because the symptom — an endless redirect to a setup page — is one of
    // those bugs that is obvious in production and invisible in review.
    const bare = await prisma.user.create({
      data: { clerkId: `${PREFIX}_bare`, email: `${PREFIX}-bare@example.test`, role: "TEACHER" },
      select: { clerkId: true },
    });
    const auth = await bearer({ subject: bare.clerkId });

    const response = await request(app).get("/api/v1/me").set("authorization", auth).expect(200);
    const me = meResponseSchema.parse(response.body.data);

    expect(me.user.role).toBe("TEACHER");
    expect(me.onboarded).toBe(false);
    expect(me.teacherProfile).toBeNull();
  });
});

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({ where: { question: { subjectId: SUBJECT } } });
  await prisma.bookmark.deleteMany({ where: { question: { subjectId: SUBJECT } } });
  await prisma.practiceSession.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.extractedQuestion.deleteMany({
    where: { upload: { teacher: { clerkId: { startsWith: PREFIX } } } },
  });
  await prisma.questionPaperUpload.deleteMany({
    where: { teacher: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { chapterId: CHAPTER } });
  await prisma.chapter.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT } });
  await prisma.teacherProfile.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.studentProfile.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
