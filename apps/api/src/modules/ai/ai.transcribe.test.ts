import { answerTranscriptionSchema, successResponseSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";
import { resetRateLimits } from "./ai.quota.js";
import { FallbackChainProvider } from "./provider/fallback.js";
import { resetAIProvider, setAIProvider } from "./provider/registry.js";
import {
  estimateTokens,
  type AIProvider,
  type ChatRequest,
  type ContentPart,
} from "./provider/types.js";

/**
 * Reading a handwritten answer off a photograph.
 *
 * Four things are asserted, and only the first is about the happy path:
 *
 *  1. The image reaches the model as an image part, alongside the question.
 *  2. **The answer key does not.** This is the one AI path in the module that
 *     is denied it, because a transcriber shown the right answer will write the
 *     right answer down regardless of what is on the page — and the student's
 *     mistake is the only thing on that page worth having.
 *  3. A provider that cannot see is skipped rather than sent a request it will
 *     reject, and when nothing in the chain can see, the student gets an empty
 *     field instead of an error.
 *  4. Nothing is stored. No attempt is written, no answer is submitted, and the
 *     photograph is not persisted anywhere — a picture of a child's exercise
 *     book is a liability with no use once the text is out of it (docs/07 R6).
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "trtest";
const SUBJECT = `${PREFIX}-maths`;
const CHAPTER = `${PREFIX}-ch`;
const Q_PUBLISHED = `${PREFIX}-q-published`;
const Q_DRAFT = `${PREFIX}-q-draft`;

const SOLUTION = "The roots are x = 2 and x = 3, found by factorising.";

/** A one-pixel JPEG. Content is irrelevant; the fake provider never decodes it. */
const PIXEL =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==";

let student: string;
let studentId: string;
let lastRequest: ChatRequest | null = null;

interface FakeBehaviour {
  text?: string;
  fail?: Error;
  images?: boolean;
}

function fakeProvider(behaviour: FakeBehaviour = {}): AIProvider {
  return {
    id: "openrouter",
    capabilities: {
      structuredOutput: true,
      images: behaviour.images ?? true,
      documents: true,
    },

    // eslint-disable-next-line require-yield
    async *streamChat(): AsyncIterable<never> {
      throw new Error("transcription never streams");
    },

    async complete(chatRequest: ChatRequest) {
      lastRequest = chatRequest;
      if (behaviour.fail) throw behaviour.fail;

      return {
        text:
          behaviour.text ??
          JSON.stringify({
            text: "$x^2 - 5x + 6 = 0$\n$(x-2)(x-4) = 0$",
            confidence: "MEDIUM",
            caveat: "",
          }),
        model: "fake-model",
        promptTokens: 900,
        completionTokens: 60,
      };
    },

    async countTokens(chatRequest: Pick<ChatRequest, "system" | "messages">) {
      return estimateTokens(chatRequest);
    },
  };
}

function installProviders(providers: AIProvider[]): void {
  setAIProvider(
    new FallbackChainProvider(providers, {
      requestTimeoutMs: 2_000,
      firstTokenTimeoutMs: 500,
      cooldownMs: 100,
    }),
  );
}

function installProvider(behaviour: FakeBehaviour = {}): void {
  installProviders([fakeProvider(behaviour)]);
}

beforeAll(async () => {
  await cleanUp();

  const owner = await prisma.user.create({
    data: { clerkId: `${PREFIX}_student`, email: `${PREFIX}@example.test`, name: "Photo Student" },
    select: { id: true, clerkId: true },
  });
  studentId = owner.id;
  student = await bearer({ subject: owner.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "TRMTH",
      name: "Trtest Mathematics",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });
  await prisma.chapter.create({
    data: { id: CHAPTER, subjectId: SUBJECT, name: "Quadratics", slug: CHAPTER, orderIndex: 0 },
  });

  await prisma.question.create({
    data: {
      id: Q_PUBLISHED,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "LONG_ANSWER",
      body: "Solve $x^2 - 5x + 6 = 0$ by factorisation. Show your working.",
      marks: 3,
      difficulty: "MEDIUM",
      expectedTimeSeconds: 240,
      status: "PUBLISHED",
      answer: { create: { solution: SOLUTION, correctValue: "x = 2, x = 3" } },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_DRAFT,
      subjectId: SUBJECT,
      chapterId: CHAPTER,
      type: "LONG_ANSWER",
      body: "An unpublished question.",
      marks: 3,
      difficulty: "MEDIUM",
      expectedTimeSeconds: 240,
      status: "DRAFT",
    },
  });
});

afterAll(async () => {
  resetAIProvider();
  await cleanUp();
});

beforeEach(() => {
  lastRequest = null;
  resetRateLimits();
  installProvider();
});

function post(token: string, body: object) {
  return request(app).post("/api/v1/ai/transcribe").set("Authorization", token).send(body);
}

function parts(): ContentPart[] {
  const content = lastRequest?.messages[0]?.content;
  return Array.isArray(content) ? content : [];
}

function promptText(): string {
  const system = lastRequest?.system ?? "";
  const text = parts()
    .filter((part) => part.type === "text")
    .map((part) => (part.type === "text" ? part.text : ""))
    .join("\n");

  return `${system}\n${text}`;
}

describe("reading a page", () => {
  it("returns the transcription", async () => {
    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(200);
    const { data } = successResponseSchema(answerTranscriptionSchema).parse(response.body);

    expect(data.generated).toBe(true);
    expect(data.text).toContain("x^2 - 5x + 6");
    expect(data.confidence).toBe("MEDIUM");
  });

  it("sends the photograph as an image part", async () => {
    await post(student, { questionId: Q_PUBLISHED, image: image() });

    const image_ = parts().find((part) => part.type === "image");
    expect(image_).toBeDefined();
    expect(image_).toMatchObject({ mimeType: "image/jpeg", data: PIXEL });
  });

  it("gives the model the question, so it can resolve ambiguous handwriting", async () => {
    await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(promptText()).toContain("x^2 - 5x + 6 = 0");
    expect(promptText()).toContain("Trtest Mathematics");
  });

  it("never gives the model the answer key", async () => {
    await post(student, { questionId: Q_PUBLISHED, image: image() });

    const everything = JSON.stringify(lastRequest);
    expect(everything).not.toContain(SOLUTION);
    expect(everything).not.toContain("x = 2, x = 3");
  });

  it("tells the model in as many words not to correct what it reads", async () => {
    await post(student, { questionId: Q_PUBLISHED, image: image() });

    const text = promptText().toLowerCase();
    expect(text).toContain("do not correct");
    expect(text).toContain("do not solve the question");
  });

  it("asks for a deterministic reading", async () => {
    await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(lastRequest?.temperature).toBe(0);
  });
});

describe("degrading", () => {
  it("returns an empty field when no provider can see an image", async () => {
    installProvider({ images: false });

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(200);
    const { data } = successResponseSchema(answerTranscriptionSchema).parse(response.body);

    expect(data.generated).toBe(false);
    expect(data.text).toBe("");
    expect(lastRequest).toBeNull();
  });

  it("skips a blind provider and uses a sighted one", async () => {
    installProviders([fakeProvider({ images: false }), fakeProvider()]);

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(200);
    expect(response.body.data.generated).toBe(true);
  });

  it("returns an empty field when the model throws", async () => {
    installProvider({ fail: new Error("upstream is down") });

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(200);
    expect(response.body.data.generated).toBe(false);
  });

  it("returns an empty field when the reply does not match the schema", async () => {
    installProvider({ text: "Sure! Here is what it says: x squared minus five x" });

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(200);
    expect(response.body.data.generated).toBe(false);
  });

  it("moves a model's prose about a blank page into the caveat", async () => {
    installProvider({
      text: JSON.stringify({ text: "   ", confidence: "HIGH", caveat: "" }),
    });

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });
    const { data } = successResponseSchema(answerTranscriptionSchema).parse(response.body);

    expect(data.text).toBe("");
    expect(data.confidence).toBe("LOW");
    expect(data.caveat.length).toBeGreaterThan(0);
  });

  it("keeps the model's own caveat when there is one", async () => {
    installProvider({
      text: JSON.stringify({
        text: "$x = 2$",
        confidence: "LOW",
        caveat: "The last line is cut off at the right edge.",
      }),
    });

    const response = await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(response.body.data.caveat).toContain("cut off");
  });
});

describe("what it refuses", () => {
  it("rejects an anonymous request", async () => {
    const response = await request(app)
      .post("/api/v1/ai/transcribe")
      .send({ questionId: Q_PUBLISHED, image: image() });

    expect(response.status).toBe(401);
  });

  it("will not read a page for a question that is not published", async () => {
    const response = await post(student, { questionId: Q_DRAFT, image: image() });

    expect(response.status).toBe(404);
    expect(lastRequest).toBeNull();
  });

  it("will not read a page for a question that does not exist", async () => {
    const response = await post(student, { questionId: "no-such-question", image: image() });

    expect(response.status).toBe(404);
  });

  it("rejects a file type that is not an image we accept", async () => {
    const response = await post(student, {
      questionId: Q_PUBLISHED,
      image: { mimeType: "application/pdf", data: PIXEL },
    });

    expect(response.status).toBe(400);
    expect(lastRequest).toBeNull();
  });

  it("rejects an image past the size ceiling before it costs a model call", async () => {
    const response = await post(student, {
      questionId: Q_PUBLISHED,
      image: { mimeType: "image/jpeg", data: "A".repeat(700_001) },
    });

    expect(response.status).toBe(400);
    expect(lastRequest).toBeNull();
  });

  it("rate limits, because a photograph is the most expensive call we make", async () => {
    let last = 0;
    for (let n = 0; n < 12; n += 1) {
      last = (await post(student, { questionId: Q_PUBLISHED, image: image() })).status;
      if (last === 429) break;
    }

    expect(last).toBe(429);
  });
});

describe("what it does not touch", () => {
  it("stores nothing: no attempt, no answer, no photograph", async () => {
    const before = await prisma.questionAttempt.count({ where: { userId: studentId } });

    await post(student, { questionId: Q_PUBLISHED, image: image() });

    expect(await prisma.questionAttempt.count({ where: { userId: studentId } })).toBe(before);
    expect(await prisma.practiceSession.count({ where: { userId: studentId } })).toBe(0);
  });
});

function image(): { mimeType: string; data: string } {
  return { mimeType: "image/jpeg", data: PIXEL };
}

async function cleanUp(): Promise<void> {
  await prisma.questionAttempt.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.practiceSession.deleteMany({
    where: { user: { clerkId: { startsWith: PREFIX } } },
  });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
