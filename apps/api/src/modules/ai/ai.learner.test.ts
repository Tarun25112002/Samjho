import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "../../lib/prisma.js";
import { aiLearner } from "./ai.learner.js";

/**
 * What the tutor is told about the student.
 *
 * Two kinds of assertion here, and the second matters more than the first.
 *
 * The obvious one: a student with a history gets a profile that describes it.
 *
 * The one worth having: a student *without* a history gets nothing. A tutor
 * told "this student is at 0% on Probability" for a topic they have never been
 * asked about will teach to a weakness that does not exist — and a pattern
 * claimed from two data points is not a pattern. Most of this file is about
 * the profile refusing to say things it cannot support.
 */

const PREFIX = "lrtest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const TOPIC = `${PREFIX}-topic`;
const OTHER_TOPIC = `${PREFIX}-topic-other`;

let studentId: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}@example.test` },
    select: { id: true },
  });
  studentId = user.id;

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "LRMTH",
      name: "Lrtest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });
  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Algebra", slug: CHAPTER, orderIndex: 0 },
  });
  await prisma.topic.createMany({
    data: [
      { id: TOPIC, chapterId: CHAPTER, name: "Quadratic equations", slug: TOPIC, orderIndex: 0 },
      {
        id: OTHER_TOPIC,
        chapterId: CHAPTER,
        name: "Probability",
        slug: OTHER_TOPIC,
        orderIndex: 1,
      },
    ],
  });

  for (let n = 0; n < 12; n += 1) {
    await prisma.question.create({
      data: {
        id: `${PREFIX}-q-${String(n)}`,
        subjectId: SUBJECT,
        chapterId: CHAPTER,
        type: "SHORT_ANSWER",
        body: `Question ${String(n)}`,
        marks: 2,
        difficulty: "MEDIUM",
        expectedTimeSeconds: 120,
        status: "PUBLISHED",
        answer: { create: { solution: "s" } },
        topics: { create: [{ topicId: TOPIC, isPrimary: true }] },
      },
    });
  }
});

afterAll(cleanUp);

beforeEach(async () => {
  await prisma.mistakeRecord.deleteMany({ where: { userId: studentId } });
  await prisma.questionAttempt.deleteMany({ where: { userId: studentId } });
  await prisma.practiceSession.deleteMany({ where: { userId: studentId } });
  await prisma.topicMastery.deleteMany({ where: { userId: studentId } });
});

describe("a student the tutor knows nothing about", () => {
  it("says nothing at all", async () => {
    const profile = await aiLearner.profile(studentId, [TOPIC]);
    expect(profile.lines).toEqual([]);
  });

  it("says nothing when no topic was supplied", async () => {
    const profile = await aiLearner.profile(studentId, []);
    expect(profile.lines).toEqual([]);
  });

  it("will not band a topic from one or two attempts", async () => {
    await setMastery(TOPIC, 0.1, 2, 0);

    const profile = await aiLearner.profile(studentId, [TOPIC]);
    expect(profile.lines.join(" ")).not.toContain("Quadratic");
  });
});

describe("a student with a history", () => {
  it("describes their standing in words rather than a percentage", async () => {
    await setMastery(TOPIC, 0.35, 10, 3);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");

    expect(text).toContain("Quadratic equations");
    expect(text).toContain("finding this difficult");
    expect(text).not.toContain("35%");
    expect(text).not.toContain("0.35");
  });

  it("bands a strong topic differently from a weak one", async () => {
    await setMastery(TOPIC, 0.9, 10, 9);
    const strong = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");

    await setMastery(TOPIC, 0.2, 10, 2);
    const weak = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");

    expect(strong).toContain("strong on this");
    expect(weak).toContain("struggling");
  });

  it("counts the mistakes on this topic they have not put right", async () => {
    await setMastery(TOPIC, 0.4, 8, 3);
    await openMistake(`${PREFIX}-q-0`);
    await openMistake(`${PREFIX}-q-1`);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text).toContain("2 questions on this topic");
  });

  it("ignores a mistake the student has since repaired", async () => {
    await setMastery(TOPIC, 0.4, 8, 3);
    await openMistake(`${PREFIX}-q-0`, new Date());

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text).not.toContain("not yet put right");
  });

  it("scopes everything to the topic asked about", async () => {
    await setMastery(OTHER_TOPIC, 0.1, 10, 1);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text).not.toContain("Probability");
  });
});

describe("naming a pattern", () => {
  it("names the reason that dominates their recent mistakes", async () => {
    await setMastery(TOPIC, 0.4, 10, 4);
    await recordReasons([
      "CALCULATION_ERROR",
      "CALCULATION_ERROR",
      "CALCULATION_ERROR",
      "MISREAD_QUESTION",
    ]);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text.toLowerCase()).toContain("calculation slip");
  });

  it("refuses to claim a pattern from scattered reasons", async () => {
    await setMastery(TOPIC, 0.4, 10, 4);
    await recordReasons([
      "CALCULATION_ERROR",
      "MISREAD_QUESTION",
      "CONCEPT_NOT_KNOWN",
      "SILLY_MISTAKE",
      "GUESSED",
      "INCOMPLETE_ANSWER",
    ]);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text).not.toContain("most often");
  });

  it("refuses to claim a pattern from two mistakes", async () => {
    await setMastery(TOPIC, 0.4, 10, 4);
    await recordReasons(["CALCULATION_ERROR", "CALCULATION_ERROR"]);

    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");
    expect(text).not.toContain("most often");
  });
});

describe("what is never sent", () => {
  it("carries no personal detail about the student", async () => {
    await prisma.user.update({
      where: { id: studentId },
      data: { name: "Sunita Rao", email: `${PREFIX}-personal@example.test` },
    });
    await prisma.studentProfile.upsert({
      where: { userId: studentId },
      create: {
        userId: studentId,
        classLevel: 10,
        board: "CBSE",
        school: "Kendriya Vidyalaya",
        parentEmail: `${PREFIX}-parent@example.test`,
      },
      update: { school: "Kendriya Vidyalaya" },
    });

    await setMastery(TOPIC, 0.4, 10, 4);
    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");

    expect(text).not.toContain("Sunita");
    expect(text).not.toContain("Kendriya");
    expect(text).not.toContain("@example.test");
    expect(text).not.toContain(studentId);
  });

  it("tells the model not to read the figures back as a score", async () => {
    await setMastery(TOPIC, 0.4, 10, 4);
    const text = (await aiLearner.profile(studentId, [TOPIC])).lines.join("\n");

    expect(text).toContain("never read these figures back");
  });
});

async function setMastery(
  topicId: string,
  masteryScore: number,
  attempted: number,
  correct: number,
): Promise<void> {
  await prisma.topicMastery.upsert({
    where: { userId_topicId: { userId: studentId, topicId } },
    create: { userId: studentId, topicId, masteryScore, attempted, correct },
    update: { masteryScore, attempted, correct },
  });
}

async function openMistake(questionId: string, repairedAt: Date | null = null): Promise<void> {
  await prisma.mistakeRecord.upsert({
    where: { userId_questionId: { userId: studentId, questionId } },
    create: { userId: studentId, questionId, repairedAt },
    update: { repairedAt },
  });
}

async function recordReasons(reasons: string[]): Promise<void> {
  const session = await prisma.practiceSession.create({
    data: { userId: studentId, mode: "CUSTOM", filtersJson: {}, questionIds: [] },
    select: { id: true },
  });

  for (const [index, reason] of reasons.entries()) {
    await prisma.questionAttempt.create({
      data: {
        userId: studentId,
        questionId: `${PREFIX}-q-${String(index)}`,
        questionVersion: 1,
        questionSnapshot: {},
        practiceSessionId: session.id,
        isCorrect: false,
        marksAwarded: 0,
        marksPossible: 2,
        evaluationMode: "AUTO",
        mistakeReason: reason as "CALCULATION_ERROR",
      },
    });
  }
}

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.mistakeRecord.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.subjectProgress.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.studentProfile.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
