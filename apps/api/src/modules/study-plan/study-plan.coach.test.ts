import { successResponseSchema, weeklyStudyPlanSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { FallbackChainProvider } from "../ai/provider/fallback.js";
import { resetAIProvider, setAIProvider } from "../ai/provider/registry.js";
import { estimateTokens, type AIProvider, type ChatRequest } from "../ai/provider/types.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The weekly plan, end to end.
 *
 * The planner itself is tested beside it, purely. What is tested here is the
 * seam — and the seam is the safety argument:
 *
 *  1. **The model cannot change the plan.** A model that returns seven
 *     sentences about entirely different work leaves the days, the topics and
 *     the counts exactly as they were computed.
 *  2. **The page cannot fail because a model was busy.** No provider, a thrown
 *     error, a malformed reply — all three produce a plan with plain sentences
 *     and `generated: false`.
 *  3. **Nothing identifying is sent.** No name, no school, no email.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "cotest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const WEAK_TOPIC = `${PREFIX}-topic-weak`;

let student: string;
let studentId: string;
let lastRequest: ChatRequest | null = null;

interface FakeBehaviour {
  text?: string;
  fail?: Error;
}

function fakeProvider(behaviour: FakeBehaviour = {}): AIProvider {
  return {
    id: "openrouter",
    capabilities: { structuredOutput: true, images: true, documents: true },

    // eslint-disable-next-line require-yield
    async *streamChat(): AsyncIterable<never> {
      throw new Error("the coach never streams");
    },

    async complete(chatRequest: ChatRequest) {
      lastRequest = chatRequest;
      if (behaviour.fail) throw behaviour.fail;

      return {
        text:
          behaviour.text ??
          JSON.stringify({
            opening: "A steady week. Most of it is on the topic your answers say is weakest.",
            notes: Array.from({ length: 7 }, (_, index) => `Note for day ${String(index + 1)}.`),
          }),
        model: "fake-model",
        promptTokens: 400,
        completionTokens: 200,
      };
    },

    async countTokens(chatRequest: Pick<ChatRequest, "system" | "messages">) {
      return estimateTokens(chatRequest);
    },
  };
}

function installProvider(behaviour: FakeBehaviour = {}): void {
  setAIProvider(
    new FallbackChainProvider([fakeProvider(behaviour)], {
      requestTimeoutMs: 2_000,
      firstTokenTimeoutMs: 500,
      cooldownMs: 100,
    }),
  );
}

function installNoProvider(): void {
  setAIProvider(
    new FallbackChainProvider([], {
      requestTimeoutMs: 2_000,
      firstTokenTimeoutMs: 500,
      cooldownMs: 100,
    }),
  );
}

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_student`,
      email: `${PREFIX}@example.test`,
      name: "Planned Student",
    },
    select: { id: true, clerkId: true },
  });
  studentId = user.id;
  student = await bearer({ subject: user.clerkId });

  await prisma.studentProfile.create({
    data: {
      userId: studentId,
      classLevel: 10,
      board: "CBSE",
      school: "Kendriya Vidyalaya",
    },
  });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "COMTH",
      name: "Cotest Mathematics",
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
  await prisma.topic.create({
    data: {
      id: WEAK_TOPIC,
      chapterId: CHAPTER,
      name: "Quadratic equations",
      slug: WEAK_TOPIC,
      orderIndex: 0,
    },
  });

  await prisma.topicMastery.create({
    data: {
      userId: studentId,
      topicId: WEAK_TOPIC,
      masteryScore: 0.25,
      attempted: 12,
      correct: 3,
    },
  });
});

afterAll(async () => {
  resetAIProvider();
  await cleanUp();
});

beforeEach(() => {
  lastRequest = null;
  installProvider();
});

function week(token = student) {
  return request(app).get("/api/v1/study-plan/week").set("Authorization", token);
}

describe("the week a student gets", () => {
  it("is seven days, starting today", async () => {
    const response = await week();

    expect(response.status).toBe(200);
    const { data } = successResponseSchema(weeklyStudyPlanSchema).parse(response.body);

    expect(data.days).toHaveLength(7);
    expect(data.days[0]?.date).toBe(data.weekStart);
  });

  it("puts their weakest topic in the plan", async () => {
    const response = await week();

    const topics = response.body.data.days
      .flatMap((day: { focus: Array<{ topicName: string | null }> }) => day.focus)
      .map((slot: { topicName: string | null }) => slot.topicName);

    expect(topics).toContain("Quadratic equations");
  });

  it("carries the model's sentences", async () => {
    const response = await week();

    expect(response.body.data.generated).toBe(true);
    expect(response.body.data.days[0].note).toContain("Note for day 1");
  });
});

describe("what the model is not allowed to change", () => {
  it("keeps the computed days when the model writes about something else", async () => {
    const plain = await week();
    const computed = plain.body.data.days.map(
      (day: { focus: unknown; minutes: number; date: string }) => ({
        focus: day.focus,
        minutes: day.minutes,
        date: day.date,
      }),
    );

    installProvider({
      text: JSON.stringify({
        opening: "Skip maths this week and do forty questions of Hindi instead.",
        notes: Array.from({ length: 7 }, () => "Do 200 questions of Sanskrit today."),
      }),
    });

    const hijacked = await week();
    const after = hijacked.body.data.days.map(
      (day: { focus: unknown; minutes: number; date: string }) => ({
        focus: day.focus,
        minutes: day.minutes,
        date: day.date,
      }),
    );

    expect(after).toEqual(computed);
  });

  it("fills a day the model left unexplained rather than leaving it blank", async () => {
    installProvider({
      text: JSON.stringify({ opening: "Short week.", notes: ["Only one note."] }),
    });

    const response = await week();

    for (const day of response.body.data.days) {
      expect(String(day.note).length).toBeGreaterThan(0);
    }
  });
});

describe("degrading", () => {
  it("still returns a plan when no provider is configured", async () => {
    installNoProvider();

    const response = await week();

    expect(response.status).toBe(200);
    const { data } = successResponseSchema(weeklyStudyPlanSchema).parse(response.body);

    expect(data.generated).toBe(false);
    expect(data.days).toHaveLength(7);
    expect(data.days.every((day) => day.note.length > 0)).toBe(true);
    expect(data.opening.length).toBeGreaterThan(0);
  });

  it("still returns a plan when the model throws", async () => {
    installProvider({ fail: new Error("upstream is down") });

    const response = await week();

    expect(response.status).toBe(200);
    expect(response.body.data.generated).toBe(false);
  });

  it("still returns a plan when the reply is not the shape we asked for", async () => {
    installProvider({ text: "Here is a lovely week for you!" });

    const response = await week();

    expect(response.body.data.generated).toBe(false);
    expect(response.body.data.days).toHaveLength(7);
  });
});

describe("what is never sent to the model", () => {
  it("carries no personal detail about the student", async () => {
    await week();

    const everything = JSON.stringify(lastRequest);
    expect(everything).not.toContain("Planned Student");
    expect(everything).not.toContain("Kendriya");
    expect(everything).not.toContain("@example.test");
    expect(everything).not.toContain(studentId);
  });
});

describe("who may ask", () => {
  it("refuses an anonymous caller", async () => {
    const response = await request(app).get("/api/v1/study-plan/week");

    expect(response.status).toBe(401);
  });
});

async function cleanUp(): Promise<void> {
  await prisma.topicMastery.deleteMany({ where: { user: { clerkId: { startsWith: PREFIX } } } });
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.studentProfile.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
