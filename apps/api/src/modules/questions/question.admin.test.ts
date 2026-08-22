import { adminQuestionSchema, importResultSchema, questionRevisionSchema } from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Question authoring against real Postgres.
 *
 * The tests that carry the weight here are not the CRUD ones. They are:
 *
 *  - **The answer key never crosses to the student route.** An admin-created,
 *    admin-visible answer must be absent from `/questions/:id` — asserted by
 *    searching the raw response body for the solution text, because the failure
 *    mode is a field nobody thought to assert on.
 *  - **A version only moves when the content does.** From Phase 5 every attempt
 *    records the version it saw; a version that changes because someone re-saved
 *    a form makes that record meaningless.
 *  - **Publication is gated on the licensing decision.** docs/07 R2's mitigation
 *    is only real if the code refuses.
 *  - **Import writes all of a file or none of it**, and says which row is wrong.
 */

const app = createApp({ verifyToken: createTestVerifier() });

/** Distinct from every other test file's prefix *and* subject code — see catalog.admin.test.ts. */
const PREFIX = "qadmintest";
const SUBJECT = `${PREFIX}-science`;
const CH_ONE = `${PREFIX}-ch-electricity`;
const CH_TWO = `${PREFIX}-ch-acids`;
const TOPIC_OHM = `${PREFIX}-topic-ohm`;
const TOPIC_RESISTOR = `${PREFIX}-topic-resistor`;
const TOPIC_ACID = `${PREFIX}-topic-acid`;

const ADMIN = "/api/v1/admin/questions";

let adminAuth: string;
let editorAuth: string;
let studentAuth: string;

// ── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Overrides are typed as raw JSON rather than `Partial<WriteQuestionInput>`,
 * because these objects are what goes *on the wire* — before Zod fills in the
 * dozen defaults that make up the parsed type. Typing them as the output would
 * force every fixture to spell out `paperCode: null` to say nothing.
 */
function shortAnswer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chapterId: CH_ONE,
    topicIds: [TOPIC_OHM],
    type: "SHORT_ANSWER",
    body: "State Ohm's law and draw the V–I graph for a metallic conductor.",
    marks: 2,
    source: { sourceType: "ORIGINAL", licenceStatus: "CLEARED" },
    answer: {
      solution: "V = IR at constant temperature; the V–I graph is a straight line through 0.",
    },
    ...overrides,
  };
}

function mcq(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chapterId: CH_ONE,
    topicIds: [TOPIC_OHM],
    type: "MCQ",
    marks: 1,
    body: "The SI unit of electrical resistance is:",
    options: [
      { label: "A", body: "volt" },
      { label: "B", body: "ampere" },
      { label: "C", body: "ohm", isCorrect: true },
      { label: "D", body: "watt" },
    ],
    source: { sourceType: "ORIGINAL", licenceStatus: "CLEARED" },
    answer: { solution: "Resistance is measured in ohms ($\\Omega$)." },
    ...overrides,
  };
}

function caseStudy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chapterId: CH_ONE,
    topicIds: [TOPIC_OHM],
    type: "CASE_BASED",
    marks: 4,
    body: "A household draws the following currents over one evening. Study the readings and answer the questions that follow.",
    answer: null,
    source: { sourceType: "ORIGINAL", licenceStatus: "CLEARED" },
    subParts: [
      {
        type: "VERY_SHORT_ANSWER",
        body: "State the peak current drawn during the evening.",
        marks: 1,
        answer: { solution: "8 A, at 7 pm." },
      },
      {
        type: "VERY_SHORT_ANSWER",
        body: "Name the quantity measured in kilowatt-hours.",
        marks: 1,
        answer: { solution: "Electrical energy consumed." },
      },
      {
        type: "SHORT_ANSWER",
        body: "Calculate the total energy consumed between 6 pm and 8 pm.",
        marks: 2,
        topicIds: [TOPIC_RESISTOR],
        answer: { solution: "Sum of P×t over the interval, in kWh." },
      },
    ],
    ...overrides,
  };
}

/** Not `async`: returning the supertest chain keeps `.expect(201)` available. */
function create(body: Record<string, unknown>, auth = adminAuth) {
  return request(app).post(ADMIN).set("authorization", auth).send(body);
}

async function createPublished(body: Record<string, unknown>): Promise<string> {
  const created = await create(body).expect(201);
  const id = adminQuestionSchema.parse(created.body.data).id;

  await request(app)
    .put(`${ADMIN}/${id}/status`)
    .set("authorization", adminAuth)
    .send({ status: "PUBLISHED" })
    .expect(200);

  return id;
}

// ── Setup ────────────────────────────────────────────────────────────────────

beforeAll(async () => {
  await cleanUp();

  const [admin, editor, student] = await Promise.all([
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_admin`,
        email: `${PREFIX}-admin@example.test`,
        name: "Question Admin",
        role: "ADMIN",
      },
      select: { clerkId: true },
    }),
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_editor`,
        email: `${PREFIX}-editor@example.test`,
        name: "Question Editor",
        role: "CONTENT_EDITOR",
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

  [adminAuth, editorAuth, studentAuth] = await Promise.all([
    bearer({ subject: admin.clerkId }),
    bearer({ subject: editor.clerkId }),
    bearer({ subject: student.clerkId }),
  ]);

  await prisma.subject.create({
    data: {
      id: SUBJECT,
      board: "CBSE",
      classLevel: 10,
      code: "QADSCI",
      name: "Qadmintest Science",
      slug: SUBJECT,
      theoryMarks: 80,
      syllabusYear: "2026-27",
      orderIndex: 90,
    },
  });

  await prisma.chapter.createMany({
    data: [
      {
        id: CH_ONE,
        subjectId: SUBJECT,
        name: "Electricity",
        slug: CH_ONE,
        orderIndex: 0,
        domain: "Physics",
      },
      {
        id: CH_TWO,
        subjectId: SUBJECT,
        name: "Acids, Bases and Salts",
        slug: CH_TWO,
        orderIndex: 1,
        domain: "Chemistry",
      },
    ],
  });

  await prisma.topic.createMany({
    data: [
      { id: TOPIC_OHM, chapterId: CH_ONE, name: "Ohm's law", slug: TOPIC_OHM, orderIndex: 0 },
      {
        id: TOPIC_RESISTOR,
        chapterId: CH_ONE,
        name: "Resistors in series",
        slug: TOPIC_RESISTOR,
        orderIndex: 1,
      },
      { id: TOPIC_ACID, chapterId: CH_TWO, name: "pH scale", slug: TOPIC_ACID, orderIndex: 0 },
    ],
  });
});

beforeEach(async () => {
  await prisma.question.deleteMany({ where: { subjectId: SUBJECT } });
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

// ── Authorization ────────────────────────────────────────────────────────────

describe("admin questions — authorization", () => {
  const writes: [string, string, Record<string, unknown>][] = [
    ["post", ADMIN, {}],
    ["put", `${ADMIN}/anything`, {}],
    ["put", `${ADMIN}/anything/status`, { status: "PUBLISHED" }],
    ["post", `${ADMIN}/import`, { subjectId: SUBJECT, rows: [] }],
  ];

  it.each(writes)("refuses %s %s to a student", async (method, path, body) => {
    // Asserted per route rather than once: the failure being guarded against is
    // route six being added without the guard, and a single "the router refuses
    // students" test passes happily while route six is mounted elsewhere.
    await request(app)
      [method as "post"](path)
      .set("authorization", studentAuth)
      .send(body)
      .expect(403);
  });

  it("refuses reads to a student, drafts included", async () => {
    await request(app).get(ADMIN).set("authorization", studentAuth).expect(403);
    await request(app)
      .get("/api/v1/admin/dashboard/content")
      .set("authorization", studentAuth)
      .expect(403);
  });

  it("answers 401, not 403, without a token", async () => {
    await request(app).get(ADMIN).expect(401);
    await request(app).post(ADMIN).send({}).expect(401);
  });

  it("allows a content editor — writing questions is the job", async () => {
    await create(shortAnswer(), editorAuth).expect(201);
  });
});

// ── Creating ─────────────────────────────────────────────────────────────────

describe("admin questions — creating", () => {
  it("stores the whole tree in one request and lands in DRAFT", async () => {
    const response = await create(shortAnswer()).expect(201);
    const question = adminQuestionSchema.parse(response.body.data);

    expect(question.status).toBe("DRAFT");
    expect(question.version).toBe(1);
    expect(question.answer?.solution).toContain("V = IR");
    expect(question.source?.licenceStatus).toBe("CLEARED");
    expect(question.topics).toHaveLength(1);
    expect(question.topics[0]?.isPrimary).toBe(true);
    // Null in the request; a minute a mark is what the API and the form agree on.
    expect(question.expectedTimeSeconds).toBe(120);
  });

  it("marks the first topic as primary and the rest as secondary", async () => {
    const response = await create(shortAnswer({ topicIds: [TOPIC_RESISTOR, TOPIC_OHM] })).expect(
      201,
    );

    const question = adminQuestionSchema.parse(response.body.data);
    const primary = question.topics.filter((topic) => topic.isPrimary);

    expect(primary).toHaveLength(1);
    expect(primary[0]?.id).toBe(TOPIC_RESISTOR);
  });

  it("rejects a topic that belongs to another chapter", async () => {
    // The foreign key permits it; nothing else would notice until mastery was
    // attributed to a topic the student has never opened.
    const response = await create(shortAnswer({ topicIds: [TOPIC_ACID] })).expect(400);

    expect(JSON.stringify(response.body)).toContain(TOPIC_ACID);
  });

  it("rejects an unknown chapter with a field error, not a 500", async () => {
    const response = await create(shortAnswer({ chapterId: "no-such-chapter" })).expect(400);
    expect(JSON.stringify(response.body)).toContain("chapterId");
  });

  it("enforces the per-type rules over HTTP, not only in the schema tests", async () => {
    const noCorrectOption = mcq({
      options: [
        { label: "A", body: "volt" },
        { label: "B", body: "ohm" },
      ],
    });

    const response = await create(noCorrectOption).expect(400);
    expect(JSON.stringify(response.body.error.details)).toContain("body.options");
  });

  it("stores a case study with its sub-parts and their own topics", async () => {
    const response = await create(caseStudy()).expect(201);
    const question = adminQuestionSchema.parse(response.body.data);

    expect(question.isContainer).toBe(true);
    expect(question.subParts).toHaveLength(3);
    expect(question.subParts.map((part) => part.subPartIndex)).toEqual([0, 1, 2]);
    expect(question.subParts.map((part) => part.marks)).toEqual([1, 1, 2]);

    // The third declares its own topic; the first two inherit the container's.
    expect(question.subParts[2]?.topics[0]?.id).toBe(TOPIC_RESISTOR);
    expect(question.subParts[0]?.topics[0]?.id).toBe(TOPIC_OHM);
  });
});

// ── The answer key ───────────────────────────────────────────────────────────

describe("admin questions — the answer key stays on the admin side", () => {
  it("is absent from the student route even for a question an admin just wrote", async () => {
    const secret = "the solution text that must never reach a student";
    const id = await createPublished(
      shortAnswer({ answer: { solution: secret, acceptedValues: [], markingScheme: null } }),
    );

    const student = await request(app)
      .get(`/api/v1/questions/${id}`)
      .set("authorization", studentAuth)
      .expect(200);

    // Searched in the raw body rather than checked field by field: the bug this
    // guards against is a field nobody thought to assert on.
    expect(JSON.stringify(student.body)).not.toContain(secret);
    expect(JSON.stringify(student.body)).not.toContain("isCorrect");
  });

  it("hides which option is correct from the student route", async () => {
    const id = await createPublished(mcq());

    const student = await request(app)
      .get(`/api/v1/questions/${id}`)
      .set("authorization", studentAuth)
      .expect(200);

    const admin = await request(app)
      .get(`${ADMIN}/${id}`)
      .set("authorization", adminAuth)
      .expect(200);

    expect(JSON.stringify(student.body)).not.toContain("isCorrect");
    expect(adminQuestionSchema.parse(admin.body.data).options.some((o) => o.isCorrect)).toBe(true);
  });
});

// ── Versioning ───────────────────────────────────────────────────────────────

describe("admin questions — versioning and the revision log", () => {
  it("does not bump the version when nothing changed", async () => {
    const created = await create(shortAnswer()).expect(201);
    const id = adminQuestionSchema.parse(created.body.data).id;

    const resaved = await request(app)
      .put(`${ADMIN}/${id}`)
      .set("authorization", adminAuth)
      .send(shortAnswer())
      .expect(200);

    expect(adminQuestionSchema.parse(resaved.body.data).version).toBe(1);

    const revisions = await request(app)
      .get(`${ADMIN}/${id}/revisions`)
      .set("authorization", adminAuth)
      .expect(200);

    expect(revisions.body.data.revisions).toHaveLength(0);
  });

  it("does not bump the version for editorial metadata alone", async () => {
    // Retagging a question as HARD does not change what it asks or what counts
    // as right, so an attempt pinned to version 1 is still pinned to the truth.
    const created = await create(shortAnswer()).expect(201);
    const id = adminQuestionSchema.parse(created.body.data).id;

    const updated = await request(app)
      .put(`${ADMIN}/${id}`)
      .set("authorization", adminAuth)
      .send(shortAnswer({ difficulty: "HARD", bloomLevel: "ANALYSE" }))
      .expect(200);

    const question = adminQuestionSchema.parse(updated.body.data);
    expect(question.version).toBe(1);
    expect(question.difficulty).toBe("HARD");

    // It still records *that* someone changed the tagging — the version is about
    // what a student saw, the audit trail is about what a person did.
    const revisions = await request(app)
      .get(`${ADMIN}/${id}/revisions`)
      .set("authorization", adminAuth)
      .expect(200);

    expect(revisions.body.data.revisions).toHaveLength(1);
  });

  it("bumps the version and records the fields when the content changes", async () => {
    const created = await create(shortAnswer()).expect(201);
    const id = adminQuestionSchema.parse(created.body.data).id;

    const updated = await request(app)
      .put(`${ADMIN}/${id}`)
      .set("authorization", adminAuth)
      .send(
        shortAnswer({
          body: "State Ohm's law and state the two conditions under which it holds.",
        }),
      )
      .expect(200);

    expect(adminQuestionSchema.parse(updated.body.data).version).toBe(2);

    const response = await request(app)
      .get(`${ADMIN}/${id}/revisions`)
      .set("authorization", adminAuth)
      .expect(200);

    const revisions = response.body.data.revisions.map((row: unknown) =>
      questionRevisionSchema.parse(row),
    );

    expect(revisions).toHaveLength(1);
    const fields = revisions[0].changes.map((change: { field: string }) => change.field);
    expect(fields).toContain("body");
    expect(fields).toContain("version");
    expect(revisions[0].editedByName).toBe("Question Admin");
  });

  it("refuses to edit a sub-part as if it were a question in its own right", async () => {
    const created = await create(caseStudy()).expect(201);
    const question = adminQuestionSchema.parse(created.body.data);
    const subPartId = question.subParts[0]?.id ?? "";

    // Left unguarded this would build a second, parentless copy of the tree.
    await request(app)
      .put(`${ADMIN}/${subPartId}`)
      .set("authorization", adminAuth)
      .send(shortAnswer())
      .expect(400);
  });

  it("removes a sub-part the editor deleted, and keeps the ids of the ones kept", async () => {
    const created = await create(caseStudy()).expect(201);
    const before = adminQuestionSchema.parse(created.body.data);
    const keptId = before.subParts[0]?.id;

    const trimmed = caseStudy({
      marks: 2,
      subParts: [
        {
          type: "VERY_SHORT_ANSWER",
          body: "State the peak current drawn during the evening.",
          marks: 1,
          answer: { solution: "8 A, at 7 pm." },
        },
        {
          type: "VERY_SHORT_ANSWER",
          body: "Name the quantity measured in kilowatt-hours.",
          marks: 1,
          answer: { solution: "Electrical energy consumed." },
        },
      ],
    });

    const updated = await request(app)
      .put(`${ADMIN}/${before.id}`)
      .set("authorization", adminAuth)
      .send(trimmed)
      .expect(200);

    const after = adminQuestionSchema.parse(updated.body.data);
    expect(after.subParts).toHaveLength(2);
    // Matched by position rather than rebuilt, so an attempt that referenced
    // this sub-part still points at a row that exists.
    expect(after.subParts[0]?.id).toBe(keptId);

    const orphans = await prisma.question.count({ where: { parentId: before.id } });
    expect(orphans).toBe(2);
  });

  it("keeps the id of an option whose text was merely corrected", async () => {
    const created = await create(mcq()).expect(201);
    const before = adminQuestionSchema.parse(created.body.data);
    const optionC = before.options.find((option) => option.label === "C");

    const updated = await request(app)
      .put(`${ADMIN}/${before.id}`)
      .set("authorization", adminAuth)
      .send(
        mcq({
          options: [
            { label: "A", body: "volt" },
            { label: "B", body: "ampere" },
            { label: "C", body: "ohm ($\\Omega$)", isCorrect: true },
            { label: "D", body: "watt" },
          ],
        }),
      )
      .expect(200);

    const after = adminQuestionSchema.parse(updated.body.data);
    expect(after.options.find((option) => option.label === "C")?.id).toBe(optionC?.id);
    expect(after.version).toBe(2);
  });
});

// ── Publication ──────────────────────────────────────────────────────────────

describe("admin questions — publication", () => {
  it("refuses to publish while nobody has decided the licensing", async () => {
    // docs/07 R2's mitigation, made into a refusal rather than a policy.
    const created = await create(shortAnswer({ source: { sourceType: "ORIGINAL" } })).expect(201);
    const question = adminQuestionSchema.parse(created.body.data);

    expect(question.source?.licenceStatus).toBe("NEEDS_REVIEW");
    expect(question.publicationBlockers).toHaveLength(1);

    const response = await request(app)
      .put(`${ADMIN}/${question.id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "PUBLISHED" })
      .expect(400);

    expect(JSON.stringify(response.body)).toContain("licensing");
  });

  it("refuses to publish a question marked restricted", async () => {
    const created = await create(
      shortAnswer({
        source: {
          sourceType: "THIRD_PARTY",
          licenceStatus: "RESTRICTED",
          attributionText: "From a publisher's workbook",
        },
      }),
    ).expect(201);

    await request(app)
      .put(`${ADMIN}/${adminQuestionSchema.parse(created.body.data).id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "PUBLISHED" })
      .expect(400);
  });

  it("publishes a cleared question and makes it visible to students", async () => {
    const id = await createPublished(shortAnswer());

    const admin = await request(app)
      .get(`${ADMIN}/${id}`)
      .set("authorization", adminAuth)
      .expect(200);

    const question = adminQuestionSchema.parse(admin.body.data);
    expect(question.status).toBe("PUBLISHED");
    expect(question.publishedAt).not.toBeNull();

    await request(app).get(`/api/v1/questions/${id}`).set("authorization", studentAuth).expect(200);
  });

  it("withdraws a case study together with its sub-parts", async () => {
    // Sub-part rows are read directly by practice selection and the exam slot
    // resolver, so leaving them PUBLISHED would withdraw the case study from the
    // one place a human looks and leave its parts live everywhere else.
    const id = await createPublished(caseStudy());

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "ARCHIVED", reason: "Wrong reading in the table" })
      .expect(200);

    const parts = await prisma.question.findMany({
      where: { parentId: id },
      select: { status: true },
    });

    expect(parts).toHaveLength(3);
    expect(parts.every((part) => part.status === "ARCHIVED")).toBe(true);

    await request(app).get(`/api/v1/questions/${id}`).set("authorization", studentAuth).expect(404);
  });

  it("does not let an archived question go straight back to students", async () => {
    const id = await createPublished(shortAnswer());

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "ARCHIVED" })
      .expect(200);

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "PUBLISHED" })
      .expect(409);

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "DRAFT" })
      .expect(200);
  });

  it("keeps the first publication date across a withdrawal and a re-publication", async () => {
    const id = await createPublished(shortAnswer());
    const first = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { publishedAt: true },
    });

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "IN_REVIEW" })
      .expect(200);
    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "PUBLISHED" })
      .expect(200);

    const second = await prisma.question.findUniqueOrThrow({
      where: { id },
      select: { publishedAt: true },
    });

    expect(second.publishedAt?.toISOString()).toBe(first.publishedAt?.toISOString());
  });

  it("records the reason on the revision log", async () => {
    const id = await createPublished(shortAnswer());

    await request(app)
      .put(`${ADMIN}/${id}/status`)
      .set("authorization", adminAuth)
      .send({ status: "IN_REVIEW", reason: "Student reported the answer key is wrong" })
      .expect(200);

    const response = await request(app)
      .get(`${ADMIN}/${id}/revisions`)
      .set("authorization", adminAuth)
      .expect(200);

    const latest = questionRevisionSchema.parse(response.body.data.revisions[0]);
    expect(latest.reason).toContain("answer key is wrong");
    expect(latest.changes[0]).toEqual({ field: "status", from: "PUBLISHED", to: "IN_REVIEW" });
  });
});

// ── Listing ──────────────────────────────────────────────────────────────────

describe("admin questions — listing", () => {
  it("shows drafts, and counts a case study as one question", async () => {
    await create(shortAnswer()).expect(201);
    await create(caseStudy()).expect(201);

    const response = await request(app)
      .get(`${ADMIN}?subjectId=${SUBJECT}`)
      .set("authorization", adminAuth)
      .expect(200);

    const items = response.body.data.items as { id: string; subPartCount: number }[];
    expect(items).toHaveLength(2);
    expect(items.some((item) => item.subPartCount === 3)).toBe(true);
  });

  it("filters by the two work queues an editor actually has", async () => {
    await create(shortAnswer()).expect(201);
    await create(mcq({ source: { sourceType: "ORIGINAL" } })).expect(201);

    const needsReview = await request(app)
      .get(`${ADMIN}?subjectId=${SUBJECT}&licenceStatus=NEEDS_REVIEW`)
      .set("authorization", adminAuth)
      .expect(200);

    expect(needsReview.body.data.items).toHaveLength(1);

    const drafts = await request(app)
      .get(`${ADMIN}?subjectId=${SUBJECT}&status=DRAFT,IN_REVIEW`)
      .set("authorization", adminAuth)
      .expect(200);

    expect(drafts.body.data.items).toHaveLength(2);
  });
});

// ── Import ───────────────────────────────────────────────────────────────────

describe("admin questions — bulk import", () => {
  function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      ref: "sheet-row-2",
      chapter: CH_ONE,
      topics: [TOPIC_OHM],
      type: "SHORT_ANSWER",
      body: "Define resistivity and state its SI unit.",
      marks: 2,
      source: { sourceType: "ORIGINAL", licenceStatus: "CLEARED" },
      answer: { solution: "Resistivity is R·A/L, measured in ohm-metres." },
      ...overrides,
    };
  }

  it("writes nothing on a dry run, however good the file is", async () => {
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({ subjectId: SUBJECT, rows: [row()] })
      .expect(200);

    const result = importResultSchema.parse(response.body.data);
    expect(result).toMatchObject({ dryRun: true, total: 1, valid: 1, written: 0 });
    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(0);
  });

  it("defaults to a dry run when the flag is left off", async () => {
    // Import is exactly the operation people run half-attentively at the end of
    // a long day, so the safe thing is the default and writing is the opt-in.
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({ subjectId: SUBJECT, rows: [row()] })
      .expect(200);

    expect(importResultSchema.parse(response.body.data).dryRun).toBe(true);
  });

  it("reports every bad row at once, with its index and its own reference", async () => {
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({
        subjectId: SUBJECT,
        dryRun: false,
        rows: [
          row(),
          row({ ref: "sheet-row-3", chapter: "no-such-chapter" }),
          row({ ref: "sheet-row-4", topics: [TOPIC_ACID] }),
          row({ ref: "sheet-row-5", marks: 5, answer: { solution: "Too short a scheme." } }),
        ],
      })
      .expect(200);

    const result = importResultSchema.parse(response.body.data);

    expect(result.errors).toHaveLength(3);
    expect(result.errors.map((error) => error.row)).toEqual([1, 2, 3]);
    expect(result.errors.map((error) => error.ref)).toEqual([
      "sheet-row-3",
      "sheet-row-4",
      "sheet-row-5",
    ]);

    expect(result.errors[0]?.issues[0]?.message).toContain("no-such-chapter");
    expect(result.errors[1]?.issues[0]?.message).toContain(TOPIC_ACID);
    expect(JSON.stringify(result.errors[2])).toContain("markingScheme");
  });

  it("writes none of the file when one row is wrong", async () => {
    await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({
        subjectId: SUBJECT,
        dryRun: false,
        rows: [row(), row({ ref: "bad", chapter: "no-such-chapter" })],
      })
      .expect(200);

    // The good row is not a consolation prize. Leaving it behind means an editor
    // holding a file with no way to tell which half landed.
    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(0);
  });

  it("writes the whole file when every row is valid", async () => {
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({
        subjectId: SUBJECT,
        dryRun: false,
        rows: [row(), row({ ref: "b", body: "Explain why a fuse is connected in the live wire." })],
      })
      .expect(200);

    const result = importResultSchema.parse(response.body.data);
    expect(result).toMatchObject({ dryRun: false, total: 2, valid: 2, written: 2 });

    const stored = await prisma.question.findMany({
      where: { subjectId: SUBJECT },
      select: { status: true, topics: { select: { isPrimary: true } } },
    });

    expect(stored).toHaveLength(2);
    expect(stored.every((question) => question.status === "DRAFT")).toBe(true);
    expect(stored.every((question) => question.topics[0]?.isPrimary)).toBe(true);
  });

  it("catches a row duplicated inside the file", async () => {
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({ subjectId: SUBJECT, dryRun: false, rows: [row(), row({ ref: "again" })] })
      .expect(200);

    const result = importResultSchema.parse(response.body.data);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.issues[0]?.message).toContain("row 0");
  });

  it("catches a re-run of a file that has already been imported", async () => {
    const body = { subjectId: SUBJECT, dryRun: false, rows: [row()] };

    await request(app).post(`${ADMIN}/import`).set("authorization", adminAuth).send(body);
    const second = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send(body)
      .expect(200);

    const result = importResultSchema.parse(second.body.data);
    expect(result.written).toBe(0);
    expect(result.errors[0]?.issues[0]?.message).toContain("already in the bank");
    expect(await prisma.question.count({ where: { subjectId: SUBJECT } })).toBe(1);
  });

  it("applies the licence gate to a file asking to be published", async () => {
    const response = await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({
        subjectId: SUBJECT,
        dryRun: false,
        status: "PUBLISHED",
        rows: [row({ source: { sourceType: "ORIGINAL" } })],
      })
      .expect(200);

    const result = importResultSchema.parse(response.body.data);
    expect(result.written).toBe(0);
    expect(JSON.stringify(result.errors)).toContain("licensing");
  });

  it("publishes a file that asks for it and clears the gate", async () => {
    await request(app)
      .post(`${ADMIN}/import`)
      .set("authorization", adminAuth)
      .send({ subjectId: SUBJECT, dryRun: false, status: "PUBLISHED", rows: [row()] })
      .expect(200);

    const stored = await prisma.question.findFirstOrThrow({
      where: { subjectId: SUBJECT },
      select: { status: true, publishedAt: true },
    });

    expect(stored.status).toBe("PUBLISHED");
    expect(stored.publishedAt).not.toBeNull();
  });
});

// ── Dashboard ────────────────────────────────────────────────────────────────

describe("admin dashboard", () => {
  it("counts by status and names the chapters with nothing in them", async () => {
    await create(shortAnswer()).expect(201);
    await createPublished(mcq());

    const response = await request(app)
      .get("/api/v1/admin/dashboard/content")
      .set("authorization", editorAuth)
      .expect(200);

    const subject = (
      response.body.data.subjects as {
        subjectId: string;
        total: number;
        byStatus: Record<string, number>;
        chaptersWithNoQuestions: number;
      }[]
    ).find((row) => row.subjectId === SUBJECT);

    expect(subject?.total).toBe(2);
    expect(subject?.byStatus.DRAFT).toBe(1);
    expect(subject?.byStatus.PUBLISHED).toBe(1);
    // A bank concentrated in one chapter is not a usable product, and a total
    // count hides that completely.
    expect(subject?.chaptersWithNoQuestions).toBe(1);
  });
});

async function cleanUp(): Promise<void> {
  const owned = { subject: { slug: { startsWith: PREFIX } } };

  await prisma.question.deleteMany({ where: owned });
  await prisma.topic.deleteMany({ where: { chapter: owned } });
  await prisma.chapter.deleteMany({ where: owned });
  await prisma.subject.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
