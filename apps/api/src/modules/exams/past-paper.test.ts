import {
  ingestPastPaperResultSchema,
  pastPaperCoverageSchema,
  pastPaperSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The previous-year pipeline against real Postgres.
 *
 * The tests that carry the weight are the ones about *provenance*, because that
 * is what this pipeline exists to get right:
 *
 *  - **A row cannot claim its own source.** The whole design is that the paper
 *    header is stamped onto every question; a row that smuggles in its own
 *    provenance has to be rejected, not merged, or the file's questions can
 *    disagree with the file.
 *  - **Every written question is linked to the registry row**, sub-parts
 *    included — that link is what makes coverage a query rather than a string
 *    comparison over free text.
 *  - **An ingest writes all of a file or none of it**, so a rejected row cannot
 *    leave half a paper in the bank.
 *  - **Coverage stays null while the denominator is unknown.** A progress bar
 *    that reads 100% because nobody counted the paper is worse than no bar.
 *  - **The seeded placeholder is claimed, once.** Without that, a 26-year
 *    backlog grid keeps a permanently empty shadow row for every year worked on.
 */

const app = createApp({ verifyToken: createTestVerifier() });

/** Distinct from every other test file's prefix *and* subject code. */
const PREFIX = "pyqtest";
const SUBJECT = `${PREFIX}-science`;
const CHAPTER = `${PREFIX}-ch-electricity`;
const TOPIC = `${PREFIX}-topic-ohm`;

const ADMIN = "/api/v1/admin/past-papers";

let adminAuth: string;
let studentAuth: string;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function paperHeader(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    year: 2024,
    examSession: "Annual",
    paperCode: "30/1/1",
    setCode: "1",
    printedQuestionCount: 38,
    totalMarks: 80,
    ...overrides,
  };
}

function row(number: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    questionNumber: number,
    chapter: CHAPTER,
    topics: [TOPIC],
    type: "SHORT_ANSWER",
    body: `Question ${number}: state Ohm's law and sketch the V–I graph for a metallic conductor.`,
    marks: 2,
    answer: { solution: "V = IR at constant temperature; the graph is a straight line through 0." },
    ...overrides,
  };
}

function ingestBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subjectId: SUBJECT,
    paper: paperHeader(),
    reproduction: "CBSE_BOARD_PAPER",
    licenceStatus: "CLEARED",
    rows: [row("1"), row("2")],
    ...overrides,
  };
}

function ingest(body: Record<string, unknown>, auth = adminAuth) {
  return request(app).post(`${ADMIN}/ingest`).set("authorization", auth).send(body);
}

function registerPaper(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post(ADMIN)
    .set("authorization", adminAuth)
    .send({ subjectId: SUBJECT, ...paperHeader(), ...overrides });
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanUp();

  const [admin, student] = await Promise.all([
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_admin`,
        email: `${PREFIX}-admin@example.test`,
        name: "Paper Admin",
        role: "ADMIN",
      },
      select: { clerkId: true },
    }),
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_student`,
        email: `${PREFIX}-student@example.test`,
        name: "Ordinary Student",
        role: "STUDENT",
      },
      select: { clerkId: true },
    }),
  ]);

  [adminAuth, studentAuth] = await Promise.all([
    bearer({ subject: admin.clerkId }),
    bearer({ subject: student.clerkId }),
  ]);

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      code: "PYQSCI",
      name: "Pyqtest Science",
      slug: SUBJECT,
      theoryMarks: 80,
      syllabusYear: "2026-27",
      orderIndex: 91,
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

  await prisma.topic.create({
    data: { id: TOPIC, chapterId: CHAPTER, name: "Ohm's law", slug: TOPIC, orderIndex: 0 },
  });
});

beforeEach(async () => {
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
  await prisma.pastPaper.deleteMany({ where: { subjectId: SUBJECT } });
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("past papers — authorization", () => {
  const writes: [string, string, Record<string, unknown>][] = [
    ["get", ADMIN, {}],
    ["post", ADMIN, {}],
    ["post", `${ADMIN}/ingest`, {}],
    ["get", `${ADMIN}/coverage?subjectId=${SUBJECT}`, {}],
  ];

  // Asserted per route rather than once: the failure being guarded against is a
  // fifth route added without the guard, and a single "the router refuses
  // students" test passes happily while that route is mounted elsewhere.
  it.each(writes)("refuses %s %s to a student", async (method, path, body) => {
    await request(app)
      [method as "post"](path)
      .set("authorization", studentAuth)
      .send(body)
      .expect(403);
  });

  it("answers 401, not 403, without a token", async () => {
    await request(app).get(ADMIN).expect(401);
  });

  it("lets a student read the year options — that is the point of them", async () => {
    await request(app)
      .get(`/api/v1/past-papers/years?subjectId=${SUBJECT}`)
      .set("authorization", studentAuth)
      .expect(200);
  });
});

// ── The registry ─────────────────────────────────────────────────────────────

describe("past papers — the registry", () => {
  it("registers a paper and builds its label server-side", async () => {
    const response = await registerPaper().expect(201);
    const paper = pastPaperSchema.parse(response.body.data);

    expect(paper.label).toBe("CBSE 2024 · Annual · 30/1/1 Set 1");
    expect(paper.publishedQuestions).toBe(0);
    expect(paper.importedQuestions).toBe(0);
    expect(paper.coverage).toBe(0);
  });

  it("refuses a second registration of the same paper, by name", async () => {
    await registerPaper().expect(201);
    const conflict = await registerPaper().expect(409);

    expect(conflict.body.error.message).toContain("2024");
  });

  it("treats a different set as a different paper", async () => {
    await registerPaper().expect(201);
    await registerPaper({ setCode: "2" }).expect(201);
  });

  it("makes a cancelled sitting explain itself", async () => {
    // A permanent hole in the coverage grid with no explanation gets
    // re-investigated by a different person every quarter.
    await registerPaper({ paperCode: null, setCode: null, wasHeld: false }).expect(400);

    await registerPaper({
      paperCode: null,
      setCode: null,
      printedQuestionCount: null,
      wasHeld: false,
      notes: "Cancelled during the second wave of COVID-19.",
    }).expect(201);
  });

  it("hides cancelled sittings from the list unless asked", async () => {
    await registerPaper().expect(201);
    await registerPaper({
      year: 2021,
      paperCode: null,
      setCode: null,
      printedQuestionCount: null,
      wasHeld: false,
      notes: "Cancelled.",
    }).expect(201);

    const listed = await request(app)
      .get(`${ADMIN}?subjectId=${SUBJECT}`)
      .set("authorization", adminAuth)
      .expect(200);
    expect(listed.body.data.items).toHaveLength(1);

    const all = await request(app)
      .get(`${ADMIN}?subjectId=${SUBJECT}&includeNotHeld=true`)
      .set("authorization", adminAuth)
      .expect(200);
    expect(all.body.data.items).toHaveLength(2);
  });

  it("reports coverage as unknown, not complete, while nobody has counted", async () => {
    await registerPaper({ printedQuestionCount: null }).expect(201);
    await ingest(ingestBody({ paper: paperHeader({ printedQuestionCount: null }), dryRun: false }));

    const response = await request(app)
      .get(`${ADMIN}/coverage?subjectId=${SUBJECT}`)
      .set("authorization", adminAuth)
      .expect(200);

    const coverage = pastPaperCoverageSchema.parse(response.body.data);
    expect(coverage.years[0]?.importedQuestions).toBe(2);
    expect(coverage.years[0]?.printedQuestions).toBeNull();
  });
});

// ── Ingest ───────────────────────────────────────────────────────────────────

describe("past papers — ingest", () => {
  it("dry-runs by default and writes nothing", async () => {
    const response = await ingest(ingestBody()).expect(200);
    const result = ingestPastPaperResultSchema.parse(response.body.data);

    expect(result.dryRun).toBe(true);
    expect(result.valid).toBe(2);
    expect(result.written).toBe(0);
    expect(result.paperCreated).toBe(true);
    expect(result.pastPaperId).toBeNull();

    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(0);
    expect(await prisma.pastPaper.count({ where: { subjectId: SUBJECT } })).toBe(0);
  });

  it("stamps the paper header onto every question and links them to the registry", async () => {
    const response = await ingest(ingestBody({ dryRun: false })).expect(201);
    const result = ingestPastPaperResultSchema.parse(response.body.data);

    expect(result.written).toBe(2);
    expect(result.pastPaperId).not.toBeNull();

    const sources = await prisma.questionSource.findMany({
      where: { question: { subjectId: SUBJECT } },
      select: {
        sourceType: true,
        year: true,
        examSession: true,
        paperCode: true,
        setNumber: true,
        originalQuestionNumber: true,
        attributionText: true,
        pastPaperId: true,
      },
      orderBy: { originalQuestionNumber: "asc" },
    });

    expect(sources).toHaveLength(2);
    for (const source of sources) {
      expect(source.sourceType).toBe("CBSE_BOARD_PAPER");
      expect(source.year).toBe(2024);
      expect(source.paperCode).toBe("30/1/1");
      expect(source.setNumber).toBe("1");
      expect(source.pastPaperId).toBe(result.pastPaperId);
    }

    // Attribution is built rather than typed, so the adapted-and-attributed
    // position holds by construction rather than by everyone remembering.
    expect(sources[0]?.attributionText).toBe("CBSE 2024 · Annual · 30/1/1 Set 1, Q1");
    expect(sources[0]?.originalQuestionNumber).toBe("1");
  });

  it("links a case study's sub-parts to the paper as well as its container", async () => {
    const caseStudy = {
      questionNumber: "36",
      chapter: CHAPTER,
      topics: [TOPIC],
      type: "CASE_BASED",
      body: "A household draws the following currents over one evening.",
      marks: 2,
      answer: null,
      subParts: [
        {
          type: "VERY_SHORT_ANSWER",
          body: "State the peak current drawn.",
          marks: 1,
          answer: { solution: "8 A." },
        },
        {
          type: "VERY_SHORT_ANSWER",
          body: "Name the quantity measured in kilowatt-hours.",
          marks: 1,
          answer: { solution: "Electrical energy." },
        },
      ],
    };

    const response = await ingest(ingestBody({ rows: [caseStudy], dryRun: false })).expect(201);
    const result = ingestPastPaperResultSchema.parse(response.body.data);

    const linked = await prisma.questionSource.count({
      where: { pastPaperId: result.pastPaperId },
    });
    expect(linked).toBe(3);

    // But the paper's own count treats the case study as one question, the way
    // a paper does.
    const paper = await request(app)
      .get(`${ADMIN}/${result.pastPaperId ?? ""}`)
      .set("authorization", adminAuth)
      .expect(200);
    expect(pastPaperSchema.parse(paper.body.data).importedQuestions).toBe(1);
  });

  it("rejects a row that carries its own source", async () => {
    const response = await ingest(
      ingestBody({
        dryRun: false,
        rows: [row("1"), row("2", { source: { sourceType: "ORIGINAL" } })],
      }),
    ).expect(200);

    const result = ingestPastPaperResultSchema.parse(response.body.data);
    expect(result.written).toBe(0);
    expect(result.errors[0]?.issues[0]?.path).toBe("source");

    // All or nothing: the good row is not written either.
    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(0);
  });

  it("rejects two rows claiming the same question number", async () => {
    const response = await ingest(
      ingestBody({ dryRun: false, rows: [row("7"), row("7", { body: "A different question." })] }),
    ).expect(200);

    const result = ingestPastPaperResultSchema.parse(response.body.data);
    expect(result.errors[0]?.issues[0]?.path).toBe("questionNumber");
    expect(result.written).toBe(0);
  });

  it("names the bad slug, and writes none of the file", async () => {
    const response = await ingest(
      ingestBody({ dryRun: false, rows: [row("1"), row("2", { chapter: "no-such-chapter" })] }),
    ).expect(200);

    const result = ingestPastPaperResultSchema.parse(response.body.data);
    expect(result.errors[0]?.issues[0]?.message).toContain("no-such-chapter");
    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(0);
  });

  it("rejects a re-run rather than importing the paper twice", async () => {
    await ingest(ingestBody({ dryRun: false })).expect(201);

    const again = await ingest(ingestBody({ dryRun: false })).expect(200);
    const result = ingestPastPaperResultSchema.parse(again.body.data);

    expect(result.written).toBe(0);
    expect(result.alreadyOnPaper).toBe(2);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]?.issues[0]?.message).toContain("already in the bank");
  });

  it("lands questions as drafts, so nothing reaches a student unreviewed", async () => {
    await ingest(ingestBody({ dryRun: false })).expect(201);

    const statuses = await prisma.question.findMany({
      where: { subjectId: SUBJECT },
      select: { status: true },
    });
    expect(statuses.every((question) => question.status === "DRAFT")).toBe(true);
  });

  it("refuses to publish straight from a file whose licensing is unreviewed", async () => {
    const response = await ingest(
      ingestBody({ dryRun: false, status: "PUBLISHED", licenceStatus: "NEEDS_REVIEW" }),
    ).expect(200);

    const result = ingestPastPaperResultSchema.parse(response.body.data);
    expect(result.written).toBe(0);
    expect(result.errors[0]?.issues[0]?.message).toContain("licensing");
  });

  it("claims an unregistered sitting's placeholder for the first real paper", async () => {
    // What the backlog seed writes: the sitting, and nothing about the paper.
    const placeholder = await registerPaper({
      paperCode: null,
      setCode: null,
      printedQuestionCount: null,
      notes: "Registered by the 2001-2026 backlog seed.",
    }).expect(201);
    const placeholderId = pastPaperSchema.parse(placeholder.body.data).id;

    const response = await ingest(ingestBody({ dryRun: false })).expect(201);
    const result = ingestPastPaperResultSchema.parse(response.body.data);

    expect(result.pastPaperId).toBe(placeholderId);
    expect(result.paperCreated).toBe(false);
    expect(await prisma.pastPaper.count({ where: { subjectId: SUBJECT } })).toBe(1);

    // The file's header fills in what the placeholder did not know.
    const claimed = await prisma.pastPaper.findUniqueOrThrow({
      where: { id: placeholderId },
      select: { paperCode: true, setCode: true, printedQuestionCount: true },
    });
    expect(claimed.paperCode).toBe("30/1/1");
    expect(claimed.printedQuestionCount).toBe(38);
  });

  it("registers the second paper of a sitting alongside the first", async () => {
    await registerPaper({ paperCode: null, setCode: null, printedQuestionCount: null }).expect(201);

    await ingest(ingestBody({ dryRun: false })).expect(201);
    await ingest(
      ingestBody({
        dryRun: false,
        paper: paperHeader({ paperCode: "30/1/2", setCode: "2" }),
        rows: [row("1", { body: "A set 2 question about resistance in series." })],
      }),
    ).expect(201);

    expect(await prisma.pastPaper.count({ where: { subjectId: SUBJECT } })).toBe(2);
  });

  it("does not overwrite a printed count a human already recorded", async () => {
    const registered = await registerPaper({ printedQuestionCount: 38 }).expect(201);
    const id = pastPaperSchema.parse(registered.body.data).id;

    await ingest(
      ingestBody({ dryRun: false, paper: paperHeader({ printedQuestionCount: 12 }) }),
    ).expect(201);

    const paper = await prisma.pastPaper.findUniqueOrThrow({
      where: { id },
      select: { printedQuestionCount: true },
    });
    expect(paper.printedQuestionCount).toBe(38);
  });
});

// ── The filters the questions become ─────────────────────────────────────────

describe("past papers — what a student can filter by", () => {
  async function ingestAndPublish(overrides: Record<string, unknown> = {}): Promise<void> {
    await ingest(ingestBody({ dryRun: false, ...overrides })).expect(201);

    await prisma.question.updateMany({
      where: { subjectId: SUBJECT, parentId: null },
      data: { status: "PUBLISHED" },
    });
  }

  it("offers only years that have published questions behind them", async () => {
    await ingestAndPublish();

    // A second year, left as drafts. A chip for it would produce an empty set,
    // which reads as a broken feature rather than as a thin year.
    await ingest(
      ingestBody({
        dryRun: false,
        paper: paperHeader({ year: 2023, paperCode: "30/1/3" }),
        rows: [row("1", { body: "A 2023 question about the heating effect of current." })],
      }),
    ).expect(201);

    const response = await request(app)
      .get(`/api/v1/past-papers/years?subjectId=${SUBJECT}`)
      .set("authorization", studentAuth)
      .expect(200);

    expect(response.body.data.years).toEqual([{ year: 2024, questionCount: 2 }]);
  });

  it("filters browsing by year and by previous-year alone", async () => {
    await ingestAndPublish();

    const byYear = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&years=2024`)
      .set("authorization", studentAuth)
      .expect(200);
    expect(byYear.body.data.items).toHaveLength(2);

    const wrongYear = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&years=2019`)
      .set("authorization", studentAuth)
      .expect(200);
    expect(wrongYear.body.data.items).toHaveLength(0);

    const boardOnly = await request(app)
      .get(`/api/v1/questions?subjectId=${SUBJECT}&previousYearOnly=true`)
      .set("authorization", studentAuth)
      .expect(200);
    expect(boardOnly.body.data.items).toHaveLength(2);
  });

  it("combines the year filter with previous-year practice rather than replacing it", async () => {
    await ingestAndPublish();

    // The year narrows the previous-year pool rather than replacing its source
    // filter. Both clauses land on the same relation filter, so the bug this
    // guards against is one silently overwriting the other — which would make
    // a 2019 set come back full of 2024 questions instead of empty.
    // An empty pool is a 404 by design: the filters are valid, the bank is thin.
    await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentAuth)
      .send({ mode: "PREVIOUS_YEAR", filters: { subjectId: SUBJECT, years: [2019] }, count: 5 })
      .expect(404);

    const found = await request(app)
      .post("/api/v1/practice-sessions")
      .set("authorization", studentAuth)
      .send({ mode: "PREVIOUS_YEAR", filters: { subjectId: SUBJECT, years: [2024] }, count: 5 })
      .expect(201);
    expect(found.body.data.items).toHaveLength(2);
  });
});

async function cleanUp(): Promise<void> {
  const owned = { subject: { slug: { startsWith: PREFIX } } };

  await prisma.question.deleteMany({ where: owned });
  await prisma.pastPaper.deleteMany({ where: owned });
  await prisma.topic.deleteMany({ where: { chapter: owned } });
  await prisma.chapter.deleteMany({ where: owned });
  await prisma.subject.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
