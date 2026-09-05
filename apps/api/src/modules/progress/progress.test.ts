import { progressOverviewSchema, successResponseSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/** Proves the progress page reads the same persisted rollups that practice writes. */
const app = createApp({ verifyToken: createTestVerifier() });
const PREFIX = "progress-test";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-triangles`;
const TOPIC = `${PREFIX}-similarity`;
const QUESTION = `${PREFIX}-question`;

let authorization: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}-student`,
      email: `${PREFIX}@example.test`,
      name: "Progress Student",
    },
    select: { id: true, clerkId: true },
  });
  authorization = await bearer({ subject: user.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "PGMTH",
      name: "Progress Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });
  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Triangles", slug: CHAPTER, orderIndex: 0 },
  });
  await prisma.topic.create({
    data: { id: TOPIC, chapterId: CHAPTER, name: "Similarity", slug: TOPIC, orderIndex: 0 },
  });
  await prisma.question.create({
    data: {
      id: QUESTION,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "SHORT_ANSWER",
      body: "State the basic proportionality theorem.",
      marks: 2,
      difficulty: "EASY",
      expectedTimeSeconds: 90,
      status: "PUBLISHED",
    },
  });
  const profile = await prisma.studentProfile.create({
    data: { userId: user.id, classLevel: 10, onboardedAt: new Date() },
    select: { id: true },
  });
  await prisma.subjectEnrolment.create({ data: { profileId: profile.id, subjectId: SUBJECT } });
  await prisma.subjectProgress.create({
    data: {
      userId: user.id,
      subjectId: SUBJECT,
      attempted: 8,
      correct: 5,
      marksEarned: 9,
      marksPossible: 14,
      masteryScore: 0.64,
      unrepairedMistakes: 1,
      questionsBookmarked: 1,
      practiceSessions: 2,
    },
  });
  await prisma.topicMastery.create({
    data: {
      userId: user.id,
      topicId: TOPIC,
      attempted: 4,
      correct: 2,
      masteryScore: 0.45,
      unrepairedMistakes: 1,
    },
  });
  await prisma.mistakeRecord.create({ data: { userId: user.id, questionId: QUESTION } });
  await prisma.bookmark.create({ data: { userId: user.id, questionId: QUESTION } });
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

describe("GET /api/v1/progress/overview", () => {
  it("returns active-subject rollups, weak topics, and revision counts", async () => {
    const response = await request(app)
      .get("/api/v1/progress/overview")
      .set("authorization", authorization)
      .expect(200);

    const overview = successResponseSchema(progressOverviewSchema).parse(response.body).data;
    expect(overview.openMistakes).toBe(1);
    expect(overview.savedQuestions).toBe(1);
    expect(overview.subjects).toEqual([
      expect.objectContaining({
        subject: expect.objectContaining({ id: SUBJECT }),
        attempted: 8,
        correct: 5,
        masteryScore: 0.64,
      }),
    ]);
    expect(overview.weakTopics).toEqual([
      expect.objectContaining({ id: TOPIC, chapterId: CHAPTER, attempted: 4, masteryScore: 0.45 }),
    ]);
  });

  it("requires a signed-in student", async () => {
    await request(app).get("/api/v1/progress/overview").expect(401);
  });
});

async function cleanUp(): Promise<void> {
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
  await prisma.question.deleteMany({ where: { id: QUESTION } });
  await prisma.topic.deleteMany({ where: { id: TOPIC } });
  await prisma.chapter.deleteMany({ where: { id: CHAPTER } });
  await prisma.subject.deleteMany({ where: { id: SUBJECT } });
}
