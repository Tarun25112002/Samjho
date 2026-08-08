import {
  chapterDetailSchema,
  paginatedSchema,
  studentQuestionSchema,
  subjectDetailSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Catalog browsing and the student question view, against real Postgres.
 *
 * The most important test in this file is "never leaks an answer key". It is
 * written as a search of the raw response text rather than as an assertion about
 * named fields, because the failure it guards against is a field nobody thought
 * to assert on — a new `select` line, a relation included for convenience, a
 * serializer that spreads a row. Searching for the solution's own text catches
 * all of those; `expect(body.answer).toBeUndefined()` catches only the one you
 * predicted.
 */

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "qtest";
const SUBJECT = `${PREFIX}-science`;
const CH_PHYSICS = `${PREFIX}-ch-electricity`;
const CH_BIOLOGY = `${PREFIX}-ch-life-processes`;
const CH_EMPTY = `${PREFIX}-ch-empty`;
const TOPIC_OHM = `${PREFIX}-topic-ohms-law`;
const TOPIC_CASE = `${PREFIX}-topic-circuits`;

const Q_MCQ = `${PREFIX}-q-mcq`;
const Q_DRAFT = `${PREFIX}-q-draft`;
const Q_RESTRICTED = `${PREFIX}-q-restricted`;
const Q_CASE = `${PREFIX}-q-case`;
const Q_NUMERICAL = `${PREFIX}-q-numerical`;

/** Distinctive enough that finding it anywhere in a response is unambiguous. */
const SOLUTION_TEXT = "QTESTSOLUTIONSENTINEL: apply V = IR to each branch.";
const CORRECT_VALUE = "QTESTCORRECTVALUESENTINEL";

let auth: string;

beforeAll(async () => {
  await cleanUp();

  const user = await prisma.user.create({
    data: {
      clerkId: `${PREFIX}_reader`,
      email: `${PREFIX}-reader@example.test`,
      name: "Question Reader",
    },
    select: { clerkId: true },
  });
  auth = await bearer({ subject: user.clerkId });

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      code: "QTSCI",
      name: "Qtest Science",
      slug: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      theoryMarks: 80,
      syllabusYear: "2026-27",
    },
  });

  await prisma.chapter.createMany({
    data: [
      {
        id: CH_PHYSICS,
        subjectId: SUBJECT,
        name: "Electricity",
        slug: CH_PHYSICS,
        orderIndex: 0,
        ncertChapterNo: 11,
        domain: "Physics",
      },
      {
        id: CH_BIOLOGY,
        subjectId: SUBJECT,
        name: "Life Processes",
        slug: CH_BIOLOGY,
        orderIndex: 1,
        domain: "Biology",
      },
      // No questions at all — must still appear in the browse list.
      {
        id: CH_EMPTY,
        subjectId: SUBJECT,
        name: "Not Written Yet",
        slug: CH_EMPTY,
        orderIndex: 2,
        domain: "Physics",
      },
    ],
  });

  await prisma.topic.createMany({
    data: [
      { id: TOPIC_OHM, chapterId: CH_PHYSICS, name: "Ohm's law", slug: TOPIC_OHM, orderIndex: 0 },
      { id: TOPIC_CASE, chapterId: CH_PHYSICS, name: "Circuits", slug: TOPIC_CASE, orderIndex: 1 },
    ],
  });

  // A published MCQ with a real answer key attached, so the leak test has
  // something to fail on.
  await prisma.question.create({
    data: {
      id: Q_MCQ,
      subjectId: SUBJECT,
      chapterId: CH_PHYSICS,
      type: "MCQ",
      body: "Two resistors of $6\\ \\Omega$ and $3\\ \\Omega$ are in parallel. The equivalent resistance is:",
      marks: 1,
      difficulty: "EASY",
      expectedTimeSeconds: 60,
      status: "PUBLISHED",
      options: {
        create: [
          { label: "A", body: "$2\\ \\Omega$", isCorrect: true, orderIndex: 0 },
          { label: "B", body: "$9\\ \\Omega$", isCorrect: false, orderIndex: 1 },
          { label: "C", body: "$18\\ \\Omega$", isCorrect: false, orderIndex: 2 },
          { label: "D", body: "$0.5\\ \\Omega$", isCorrect: false, orderIndex: 3 },
        ],
      },
      answer: { create: { correctValue: CORRECT_VALUE, solution: SOLUTION_TEXT } },
      topics: { create: [{ topicId: TOPIC_OHM, isPrimary: true }] },
      assets: {
        create: [
          {
            kind: "DIAGRAM",
            url: "https://cdn.example.test/circuit.png",
            altText: "Two resistors connected in parallel across a cell",
            orderIndex: 0,
          },
        ],
      },
      source: {
        create: {
          sourceType: "CBSE_BOARD_PAPER",
          year: 2024,
          examSession: "Feb 2024",
          licenceStatus: "CLEARED",
          attributionText: "CBSE 2024, Set 1",
        },
      },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_DRAFT,
      subjectId: SUBJECT,
      chapterId: CH_PHYSICS,
      type: "SHORT_ANSWER",
      body: "A draft nobody has reviewed.",
      marks: 3,
      expectedTimeSeconds: 180,
      status: "DRAFT",
    },
  });

  await prisma.question.create({
    data: {
      id: Q_RESTRICTED,
      subjectId: SUBJECT,
      chapterId: CH_PHYSICS,
      type: "SHORT_ANSWER",
      body: "Copied verbatim from a publisher and not cleared.",
      marks: 3,
      expectedTimeSeconds: 180,
      status: "PUBLISHED",
      source: { create: { sourceType: "THIRD_PARTY", licenceStatus: "RESTRICTED" } },
    },
  });

  await prisma.question.create({
    data: {
      id: Q_NUMERICAL,
      subjectId: SUBJECT,
      chapterId: CH_BIOLOGY,
      type: "NUMERICAL",
      body: "Calculate the rate of transpiration.",
      marks: 3,
      difficulty: "HARD",
      expectedTimeSeconds: 240,
      status: "PUBLISHED",
      answer: { create: { correctValue: "12 ml/h", solution: "Divide volume by time." } },
    },
  });

  // A case study: the container is tagged with nothing, its sub-parts carry the
  // topic. Filtering by that topic must still find the case study.
  await prisma.question.create({
    data: {
      id: Q_CASE,
      subjectId: SUBJECT,
      chapterId: CH_PHYSICS,
      type: "CASE_BASED",
      body: "**A household circuit**\n\nA kitchen runs three appliances in parallel...",
      marks: 4,
      expectedTimeSeconds: 480,
      status: "PUBLISHED",
      isContainer: true,
      subParts: {
        create: [
          {
            subjectId: SUBJECT,
            chapterId: CH_PHYSICS,
            type: "VERY_SHORT_ANSWER",
            body: "(i) Name the quantity measured in amperes.",
            marks: 1,
            subPartIndex: 0,
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
            topics: { create: [{ topicId: TOPIC_CASE, isPrimary: true }] },
          },
          {
            subjectId: SUBJECT,
            chapterId: CH_PHYSICS,
            type: "VERY_SHORT_ANSWER",
            body: "(ii) State Ohm's law.",
            marks: 1,
            subPartIndex: 1,
            expectedTimeSeconds: 60,
            status: "PUBLISHED",
          },
          {
            subjectId: SUBJECT,
            chapterId: CH_PHYSICS,
            type: "SHORT_ANSWER",
            body: "(iii) Find the total current drawn.",
            marks: 2,
            subPartIndex: 2,
            expectedTimeSeconds: 120,
            status: "PUBLISHED",
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
  // Sub-parts cascade from their parent; everything else is ordered by FK.
  await prisma.question.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.topic.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.chapter.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}

function parseList(body: unknown) {
  return successResponseSchema(paginatedSchema(studentQuestionSchema)).parse(body).data;
}

// ── The rule the whole module exists to enforce ──────────────────────────────

describe("answer keys never reach a student", () => {
  it("omits the solution and correct value from a list response", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}`)
      .set("authorization", auth)
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain(SOLUTION_TEXT);
    expect(raw).not.toContain(CORRECT_VALUE);
    // The MCQ *is* in the response — otherwise this test would pass trivially.
    expect(raw).toContain(Q_MCQ);
  });

  it("omits isCorrect from options, so the answer is not inferable", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_MCQ}`)
      .set("authorization", auth)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain("isCorrect");

    const question = successResponseSchema(studentQuestionSchema).parse(response.body).data;
    expect(question.options).toHaveLength(4);
    // Present and ordered — the options themselves are needed to answer.
    expect(question.options.map((option) => option.label)).toEqual(["A", "B", "C", "D"]);
  });

  it("omits the answer key on a fetch by id too", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_NUMERICAL}`)
      .set("authorization", auth)
      .expect(200);

    const raw = JSON.stringify(response.body);
    expect(raw).not.toContain("12 ml/h");
    expect(raw).not.toContain("Divide volume by time");
  });
});

// ── Visibility ───────────────────────────────────────────────────────────────

describe("visibility", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/v1/questions").expect(401);
  });

  it("excludes drafts", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}&limit=50`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).not.toContain(Q_DRAFT);
  });

  it("excludes licence-restricted questions", async () => {
    // docs/07 R2. The row stays in the database for reference; it must never be
    // served in a commercial product.
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}&limit=50`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).not.toContain(Q_RESTRICTED);
  });

  it("answers 404 for a draft rather than 403", async () => {
    // Indistinguishable from "does not exist", so the endpoint cannot be used to
    // enumerate what is sitting in the draft pipeline.
    await request(app).get(`/api/v1/questions/${Q_DRAFT}`).set("authorization", auth).expect(404);
  });

  it("answers 404 for a restricted question", async () => {
    await request(app)
      .get(`/api/v1/questions/${Q_RESTRICTED}`)
      .set("authorization", auth)
      .expect(404);
  });

  it("does not return sub-parts as top-level results", async () => {
    // A case study is one question worth four marks, not three questions.
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}&limit=50`)
      .set("authorization", auth)
      .expect(200);

    const items = parseList(response.body).items;
    expect(items.map((q) => q.id).sort()).toEqual([Q_CASE, Q_MCQ].sort());
  });
});

// ── Shape ────────────────────────────────────────────────────────────────────

describe("question shape", () => {
  it("returns a case study with its sub-parts in order", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_CASE}`)
      .set("authorization", auth)
      .expect(200);

    const question = successResponseSchema(studentQuestionSchema).parse(response.body).data;

    expect(question.isContainer).toBe(true);
    expect(question.subParts.map((part) => part.subPartIndex)).toEqual([0, 1, 2]);
    expect(question.subParts.map((part) => part.marks)).toEqual([1, 1, 2]);
    // Sub-part marks reconcile with the container's total, which is what the
    // exam blueprint validator also insists on.
    expect(question.subParts.reduce((sum, part) => sum + part.marks, 0)).toBe(question.marks);
  });

  it("carries provenance so attribution can be displayed", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_MCQ}`)
      .set("authorization", auth)
      .expect(200);

    const question = successResponseSchema(studentQuestionSchema).parse(response.body).data;
    expect(question.provenance).toMatchObject({
      sourceType: "CBSE_BOARD_PAPER",
      year: 2024,
      attributionText: "CBSE 2024, Set 1",
    });
  });

  it("never exposes the internal licence decision", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_MCQ}`)
      .set("authorization", auth)
      .expect(200);

    // An editorial judgement, not something a student is owed.
    expect(JSON.stringify(response.body)).not.toContain("licenceStatus");
  });

  it("requires alt text on every asset", async () => {
    const response = await request(app)
      .get(`/api/v1/questions/${Q_MCQ}`)
      .set("authorization", auth)
      .expect(200);

    const question = successResponseSchema(studentQuestionSchema).parse(response.body).data;
    expect(question.assets[0]?.altText).toMatch(/resistors/i);
  });
});

// ── Filters ──────────────────────────────────────────────────────────────────

describe("filters", () => {
  it("filters by type, accepting a comma-separated list", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}&type=MCQ,TRUE_FALSE`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_MCQ]);
  });

  it("filters by type, accepting repeated parameters", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_PHYSICS}&type=MCQ&type=TRUE_FALSE`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_MCQ]);
  });

  it("filters by difficulty", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&difficulty=HARD`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_NUMERICAL]);
  });

  it("finds a case study by a topic tagged only on its sub-parts", async () => {
    // The container carries no topics of its own. Matching only the parent's
    // tags would hide most case studies from topic-filtered browsing.
    const response = await request(app)
      .get(`/api/v1/questions?topicId=${TOPIC_CASE}`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_CASE]);
  });

  it("filters by a topic tagged on the question itself", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?topicId=${TOPIC_OHM}`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_MCQ]);
  });

  it("searches the body case-insensitively", async () => {
    const response = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&search=TRANSPIRATION`)
      .set("authorization", auth)
      .expect(200);

    expect(parseList(response.body).items.map((q) => q.id)).toEqual([Q_NUMERICAL]);
  });

  it("rejects an unknown question type rather than ignoring it", async () => {
    // Silently dropping an unrecognised filter returns *more* than the caller
    // asked for, which is the wrong direction to fail in.
    await request(app)
      .get("/api/v1/questions?type=NOT_A_TYPE")
      .set("authorization", auth)
      .expect(400);
  });

  it("caps the page size", async () => {
    await request(app).get("/api/v1/questions?limit=500").set("authorization", auth).expect(400);
  });
});

// ── Pagination ───────────────────────────────────────────────────────────────

describe("cursor pagination", () => {
  it("walks pages without repeating or skipping", async () => {
    const first = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&limit=1`)
      .set("authorization", auth)
      .expect(200);

    const page1 = parseList(first.body);
    expect(page1.items).toHaveLength(1);
    expect(page1.pageInfo.hasMore).toBe(true);
    expect(page1.pageInfo.nextCursor).toBe(page1.items[0]?.id);

    const second = await request(app)
      .get(
        `/api/v1/questions?subjectId=${SUBJECT}&limit=10&cursor=${String(page1.pageInfo.nextCursor)}`,
      )
      .set("authorization", auth)
      .expect(200);

    const page2 = parseList(second.body);
    expect(page2.items.map((q) => q.id)).not.toContain(page1.items[0]?.id);
    expect(page2.pageInfo.hasMore).toBe(false);
    expect(page2.pageInfo.nextCursor).toBeNull();

    // Together the pages are the whole set: three visible top-level questions.
    expect(page1.items.length + page2.items.length).toBe(3);
  });
});

// ── Catalog ──────────────────────────────────────────────────────────────────

describe("GET /catalog/subjects/:idOrSlug", () => {
  it("resolves by slug and reports domains in chapter order", async () => {
    const response = await request(app)
      .get(`/api/v1/catalog/subjects/${SUBJECT}`)
      .set("authorization", auth)
      .expect(200);

    const subject = successResponseSchema(subjectDetailSchema).parse(response.body).data;
    expect(subject.code).toBe("QTSCI");
    expect(subject.domains).toEqual(["Biology", "Physics"]);
    expect(subject.counts.total).toBe(3);
  });

  it("keeps a chapter with no questions in the list", async () => {
    // A chapter that vanishes when empty is indistinguishable from one that is
    // not in the syllabus. "Nothing here yet" is information.
    const response = await request(app)
      .get(`/api/v1/catalog/subjects/${SUBJECT}/chapters`)
      .set("authorization", auth)
      .expect(200);

    const chapters = response.body.data.chapters as { id: string; questionCount: number }[];
    const empty = chapters.find((chapter) => chapter.id === CH_EMPTY);
    expect(empty).toBeDefined();
    expect(empty?.questionCount).toBe(0);
  });

  it("counts a case study once, not once per sub-part", async () => {
    const response = await request(app)
      .get(`/api/v1/catalog/subjects/${SUBJECT}/chapters`)
      .set("authorization", auth)
      .expect(200);

    const chapters = response.body.data.chapters as { id: string; questionCount: number }[];
    // MCQ + case study. The three sub-parts and the two hidden questions do not
    // count.
    expect(chapters.find((chapter) => chapter.id === CH_PHYSICS)?.questionCount).toBe(2);
  });

  it("404s for an unknown subject", async () => {
    await request(app)
      .get("/api/v1/catalog/subjects/no-such-subject")
      .set("authorization", auth)
      .expect(404);
  });
});

describe("GET /catalog/chapters/:idOrSlug", () => {
  it("returns topics with their own counts and a full difficulty breakdown", async () => {
    const response = await request(app)
      .get(`/api/v1/catalog/chapters/${CH_PHYSICS}`)
      .set("authorization", auth)
      .expect(200);

    const chapter = successResponseSchema(chapterDetailSchema).parse(response.body).data;

    expect(chapter.subject.code).toBe("QTSCI");
    expect(chapter.domain).toBe("Physics");
    expect(chapter.ncertChapterNo).toBe(11);

    const ohm = chapter.topics.find((topic) => topic.id === TOPIC_OHM);
    expect(ohm?.questionCount).toBe(1);

    // Every enum member present, zeros included — a filter whose options change
    // shape as content is added is a filter that cannot be relied on.
    expect(chapter.counts.byType).toHaveLength(10);
    expect(chapter.counts.byDifficulty).toHaveLength(3);
    expect(chapter.counts.byDifficulty.find((row) => row.difficulty === "HARD")?.count).toBe(0);
    expect(chapter.counts.byType.find((row) => row.type === "MCQ")?.count).toBe(1);
  });
});
