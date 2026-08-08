import {
  adminChapterListResponseSchema,
  adminChapterSchema,
  adminSubjectListResponseSchema,
  adminSubjectSchema,
  adminTopicSchema,
  successResponseSchema,
} from "@samjho/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * Admin taxonomy CRUD against real Postgres.
 *
 * Two groups of tests carry most of the weight:
 *
 *  - **Authorization.** Every write is attempted as a student, and must be
 *    refused. This is asserted per route rather than once, because the failure
 *    being guarded against is route eleven being added without the guard — and a
 *    single "the router rejects students" test passes happily while route eleven
 *    is mounted somewhere else.
 *  - **Withdrawal actually withdraws.** Deactivating a chapter has to remove its
 *    questions from the student's view too, or "withdrawn" means withdrawn from
 *    the browse list and live everywhere that matters.
 */

const app = createApp({ verifyToken: createTestVerifier() });

/**
 * Distinct from every other test file's, and so are the subject *codes* below.
 * Test files run in parallel against one database, and since the migration that
 * closed the null-variant hole, two files creating a CBSE/Class-10 subject with
 * the same code genuinely collide. Sharing a prefix used to be invisible.
 */
const PREFIX = "admintest";
const SUBJECT = `${PREFIX}-science`;
const OTHER_SUBJECT = `${PREFIX}-maths`;
const CH_ONE = `${PREFIX}-ch-one`;
const CH_TWO = `${PREFIX}-ch-two`;
const CH_THREE = `${PREFIX}-ch-three`;
const TOPIC_A = `${PREFIX}-topic-a`;
const TOPIC_B = `${PREFIX}-topic-b`;
const Q_PUBLISHED = `${PREFIX}-q-published`;
const Q_DRAFT = `${PREFIX}-q-draft`;

let adminAuth: string;
let editorAuth: string;
let studentAuth: string;

beforeAll(async () => {
  await cleanUp();

  const [admin, editor, student] = await Promise.all([
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_admin`,
        email: `${PREFIX}-admin@example.test`,
        name: "Taxonomy Admin",
        role: "ADMIN",
      },
      select: { clerkId: true },
    }),
    prisma.user.create({
      data: {
        clerkId: `${PREFIX}_editor`,
        email: `${PREFIX}-editor@example.test`,
        name: "Content Editor",
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
});

beforeEach(async () => {
  await resetTaxonomy();
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

const ADMIN = "/api/v1/admin/catalog";

describe("admin taxonomy — authorization", () => {
  const writes: [string, string, Record<string, unknown>][] = [
    ["post", `${ADMIN}/subjects`, { classLevel: 10, code: "X", name: "X", slug: "x" }],
    ["patch", `${ADMIN}/subjects/${SUBJECT}`, { name: "Renamed" }],
    ["post", `${ADMIN}/subjects/${SUBJECT}/chapters`, { name: "New", slug: "new" }],
    ["put", `${ADMIN}/subjects/${SUBJECT}/chapters/order`, { orderedIds: [CH_ONE] }],
    ["patch", `${ADMIN}/chapters/${CH_ONE}`, { name: "Renamed" }],
    ["post", `${ADMIN}/chapters/${CH_ONE}/topics`, { name: "New", slug: "new" }],
    ["put", `${ADMIN}/chapters/${CH_ONE}/topics/order`, { orderedIds: [TOPIC_A] }],
    ["patch", `${ADMIN}/topics/${TOPIC_A}`, { name: "Renamed" }],
  ];

  it.each(writes)("refuses %s %s to a student", async (method, path, body) => {
    // 403, not 404. Hiding the route's existence from a signed-in student buys
    // nothing — they can read the client bundle — and a 404 here would be
    // indistinguishable from a genuine typo in the path during development.
    await request(app)
      [method as "post"](path)
      .set("authorization", studentAuth)
      .send(body)
      .expect(403);
  });

  it("refuses reads to a student too", async () => {
    await request(app).get(`${ADMIN}/subjects`).set("authorization", studentAuth).expect(403);
    await request(app)
      .get(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", studentAuth)
      .expect(403);
  });

  it("answers 401, not 403, without a token", async () => {
    // The distinction matters to the client: 401 means "sign in again" and 403
    // means "you will never be allowed". Collapsing them sends an expired
    // session into a dead end instead of a refresh.
    await request(app).get(`${ADMIN}/subjects`).expect(401);
    await request(app).post(`${ADMIN}/subjects`).send({}).expect(401);
  });

  it("allows a content editor, because taxonomy is their job", async () => {
    await request(app).get(`${ADMIN}/subjects`).set("authorization", editorAuth).expect(200);
  });

  it("does not leak the admin view through the student catalog routes", async () => {
    // The student route must not grow an includeInactive escape hatch.
    const response = await request(app)
      .get("/api/v1/catalog/subjects?board=CBSE&classLevel=10&includeInactive=true")
      .set("authorization", studentAuth)
      .expect(200);

    expect(JSON.stringify(response.body)).not.toContain("isActive");
  });
});

describe("admin taxonomy — subjects", () => {
  it("lists subjects with counts that include drafts", async () => {
    const response = await request(app)
      .get(`${ADMIN}/subjects`)
      .set("authorization", adminAuth)
      .expect(200);

    const { subjects } = adminSubjectListResponseSchema.parse(
      successResponseSchema(adminSubjectListResponseSchema).parse(response.body).data,
    );

    const subject = subjects.find((row) => row.id === SUBJECT);
    expect(subject).toBeDefined();
    // One published, one draft. The student-facing count would say 1; an editor
    // deciding whether to withdraw this subject needs to know about both.
    expect(subject?.questionCount).toBe(2);
    expect(subject?.chapterCount).toBe(3);
  });

  it("creates a subject and appends it to the end of its class", async () => {
    const response = await request(app)
      .post(`${ADMIN}/subjects`)
      .set("authorization", adminAuth)
      .send({
        classLevel: 10,
        code: "ADMNEW",
        name: "Admintest Social Science",
        slug: `${PREFIX}-social-science`,
        theoryMarks: 80,
        syllabusYear: "2026-27",
      })
      .expect(201);

    const created = adminSubjectSchema.parse(response.body.data);
    expect(created.board).toBe("CBSE");
    expect(created.isActive).toBe(true);
    expect(created.variant).toBeNull();
    expect(created.questionCount).toBe(0);
  });

  it("rejects a duplicate slug with 409 and names the field", async () => {
    const response = await request(app)
      .post(`${ADMIN}/subjects`)
      .set("authorization", adminAuth)
      .send({
        classLevel: 12,
        code: "ADMDIFF",
        name: "Different subject, same slug",
        slug: SUBJECT,
        theoryMarks: 70,
        syllabusYear: "2026-27",
      })
      .expect(409);

    expect(response.body.error.message).toMatch(/slug/i);
  });

  it("rejects a duplicate board/class/code/variant with 409", async () => {
    const response = await request(app)
      .post(`${ADMIN}/subjects`)
      .set("authorization", adminAuth)
      .send({
        classLevel: 10,
        code: "ADMSCI",
        name: "Same identity, different slug",
        slug: `${PREFIX}-science-again`,
        theoryMarks: 80,
        syllabusYear: "2026-27",
      })
      .expect(409);

    expect(response.body.error.message).toMatch(/already exists/i);
  });

  it("rejects a slug that is not URL-shaped", async () => {
    for (const slug of ["Class 10 Science", "UPPER", "trailing-", "double--hyphen", "a"]) {
      await request(app)
        .post(`${ADMIN}/subjects`)
        .set("authorization", adminAuth)
        .send({
          classLevel: 10,
          code: "ADMBAD",
          name: "Bad slug",
          slug,
          theoryMarks: 80,
          syllabusYear: "2026-27",
        })
        .expect(400);
    }
  });

  it("rejects a syllabus year that is not an academic year", async () => {
    await request(app)
      .post(`${ADMIN}/subjects`)
      .set("authorization", adminAuth)
      .send({
        classLevel: 10,
        code: "ADMYR",
        name: "Bad year",
        slug: `${PREFIX}-bad-year`,
        theoryMarks: 80,
        syllabusYear: "2026",
      })
      .expect(400);
  });

  it("renames a subject without touching its slug", async () => {
    // The rule this protects: a slug is a URL. Auto-slugging a rename silently
    // 404s every link anyone has already shared.
    const response = await request(app)
      .patch(`${ADMIN}/subjects/${SUBJECT}`)
      .set("authorization", adminAuth)
      .send({ name: "Admintest Science (revised)" })
      .expect(200);

    const updated = adminSubjectSchema.parse(response.body.data);
    expect(updated.name).toBe("Admintest Science (revised)");
    expect(updated.slug).toBe(SUBJECT);
  });

  it("ignores an attempt to move a subject to another class or board", async () => {
    await request(app)
      .patch(`${ADMIN}/subjects/${SUBJECT}`)
      .set("authorization", adminAuth)
      .send({ name: "Still Class 10", classLevel: 12, board: "ICSE" })
      .expect(200);

    // Stripped by the schema rather than rejected, because these are the four
    // columns thousands of chapters, questions and enrolments were written
    // against. Reclassifying a subject is a migration, not a PATCH.
    const row = await prisma.subject.findUniqueOrThrow({
      where: { id: SUBJECT },
      select: { classLevel: true, board: true },
    });
    expect(row.classLevel).toBe(10);
    expect(row.board).toBe("CBSE");
  });

  it("rejects an empty patch rather than pretending to succeed", async () => {
    await request(app)
      .patch(`${ADMIN}/subjects/${SUBJECT}`)
      .set("authorization", adminAuth)
      .send({})
      .expect(400);
  });

  it("404s on a subject that does not exist", async () => {
    await request(app)
      .patch(`${ADMIN}/subjects/${PREFIX}-nope`)
      .set("authorization", adminAuth)
      .send({ name: "Ghost" })
      .expect(404);
  });

  it("offers no DELETE, because withdrawal is a PATCH", async () => {
    await request(app)
      .delete(`${ADMIN}/subjects/${SUBJECT}`)
      .set("authorization", adminAuth)
      .expect(404);
  });
});

describe("admin taxonomy — chapters", () => {
  it("lists chapters including inactive ones, with draft-inclusive counts", async () => {
    await prisma.chapter.update({ where: { id: CH_THREE }, data: { isActive: false } });

    const response = await request(app)
      .get(`${ADMIN}/subjects/${SUBJECT}/chapters`)
      .set("authorization", adminAuth)
      .expect(200);

    const { chapters } = adminChapterListResponseSchema.parse(response.body.data);
    expect(chapters.map((c) => c.id)).toContain(CH_THREE);

    const first = chapters.find((c) => c.id === CH_ONE);
    expect(first?.questionCount).toBe(2);
    expect(first?.publishedQuestionCount).toBe(1);
  });

  it("hides inactive chapters when asked to", async () => {
    await prisma.chapter.update({ where: { id: CH_THREE }, data: { isActive: false } });

    const response = await request(app)
      .get(`${ADMIN}/subjects/${SUBJECT}/chapters?includeInactive=false`)
      .set("authorization", adminAuth)
      .expect(200);

    const { chapters } = adminChapterListResponseSchema.parse(response.body.data);
    expect(chapters.map((c) => c.id)).not.toContain(CH_THREE);
  });

  it("appends a new chapter after the last one", async () => {
    const response = await request(app)
      .post(`${ADMIN}/subjects/${SUBJECT}/chapters`)
      .set("authorization", adminAuth)
      .send({ name: "Magnetic Effects", slug: `${PREFIX}-magnetic`, ncertChapterNo: 12 })
      .expect(201);

    const created = adminChapterSchema.parse(response.body.data);
    expect(created.orderIndex).toBe(3);
    expect(created.domain).toBeNull();
    expect(created.topics).toEqual([]);
  });

  it("rejects a duplicate slug within the same subject", async () => {
    const response = await request(app)
      .post(`${ADMIN}/subjects/${SUBJECT}/chapters`)
      .set("authorization", adminAuth)
      .send({ name: "Clashing", slug: CH_ONE })
      .expect(409);

    expect(response.body.error.message).toMatch(/slug/i);
  });

  it("allows the same chapter slug under a different subject", async () => {
    // `@@unique([subjectId, slug])`, not a global slug. "Real Numbers" exists in
    // both Class 10 and Class 12 Maths and neither should have to be renamed.
    await request(app)
      .post(`${ADMIN}/subjects/${OTHER_SUBJECT}/chapters`)
      .set("authorization", adminAuth)
      .send({ name: "Same slug, other subject", slug: CH_ONE })
      .expect(201);
  });

  it("404s when creating a chapter under a subject that does not exist", async () => {
    await request(app)
      .post(`${ADMIN}/subjects/${PREFIX}-nope/chapters`)
      .set("authorization", adminAuth)
      .send({ name: "Orphan", slug: `${PREFIX}-orphan` })
      .expect(404);
  });

  it("accepts null to clear a chapter's domain", async () => {
    const response = await request(app)
      .patch(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .send({ domain: null })
      .expect(200);

    expect(adminChapterSchema.parse(response.body.data).domain).toBeNull();
  });
});

describe("admin taxonomy — reordering", () => {
  it("rewrites the whole order in one go", async () => {
    const response = await request(app)
      .put(`${ADMIN}/subjects/${SUBJECT}/chapters/order`)
      .set("authorization", adminAuth)
      .send({ orderedIds: [CH_THREE, CH_ONE, CH_TWO] })
      .expect(200);

    const { chapters } = adminChapterListResponseSchema.parse(response.body.data);
    expect(chapters.map((c) => c.id)).toEqual([CH_THREE, CH_ONE, CH_TWO]);
    expect(chapters.map((c) => c.orderIndex)).toEqual([0, 1, 2]);
  });

  it("rejects a partial order rather than appending the rest", async () => {
    const response = await request(app)
      .put(`${ADMIN}/subjects/${SUBJECT}/chapters/order`)
      .set("authorization", adminAuth)
      .send({ orderedIds: [CH_TWO, CH_ONE] })
      .expect(400);

    expect(response.body.error.message).toMatch(/every chapter/i);
  });

  it("rejects a duplicated id", async () => {
    await request(app)
      .put(`${ADMIN}/subjects/${SUBJECT}/chapters/order`)
      .set("authorization", adminAuth)
      .send({ orderedIds: [CH_ONE, CH_ONE, CH_TWO] })
      .expect(400);
  });

  it("rejects an id belonging to another subject, and changes nothing", async () => {
    const foreign = await prisma.chapter.create({
      data: {
        id: `${PREFIX}-ch-foreign`,
        subjectId: OTHER_SUBJECT,
        name: "Foreign",
        slug: `${PREFIX}-foreign`,
        orderIndex: 0,
      },
      select: { id: true, orderIndex: true },
    });

    const response = await request(app)
      .put(`${ADMIN}/subjects/${SUBJECT}/chapters/order`)
      .set("authorization", adminAuth)
      .send({ orderedIds: [CH_ONE, CH_TWO, foreign.id] })
      .expect(400);

    expect(response.body.error.message).toMatch(/do not belong/i);

    // The whole point of doing this in a transaction: a rejected reorder leaves
    // the list exactly as it was, rather than half-applied with nothing saying so.
    const after = await prisma.chapter.findMany({
      where: { subjectId: SUBJECT },
      select: { id: true, orderIndex: true },
      orderBy: { orderIndex: "asc" },
    });
    expect(after.map((c) => c.id)).toEqual([CH_ONE, CH_TWO, CH_THREE]);
  });

  it("reorders topics within a chapter", async () => {
    const response = await request(app)
      .put(`${ADMIN}/chapters/${CH_ONE}/topics/order`)
      .set("authorization", adminAuth)
      .send({ orderedIds: [TOPIC_B, TOPIC_A] })
      .expect(200);

    const chapter = adminChapterSchema.parse(response.body.data);
    expect(chapter.topics.map((t) => t.id)).toEqual([TOPIC_B, TOPIC_A]);
  });
});

describe("admin taxonomy — topics", () => {
  it("creates a topic at the end of its chapter", async () => {
    const response = await request(app)
      .post(`${ADMIN}/chapters/${CH_ONE}/topics`)
      .set("authorization", adminAuth)
      .send({ name: "Joule heating", slug: `${PREFIX}-joule` })
      .expect(201);

    const created = adminTopicSchema.parse(response.body.data);
    expect(created.orderIndex).toBe(2);
    expect(created.questionCount).toBe(0);
  });

  it("rejects a duplicate topic slug within a chapter", async () => {
    await request(app)
      .post(`${ADMIN}/chapters/${CH_ONE}/topics`)
      .set("authorization", adminAuth)
      .send({ name: "Clash", slug: TOPIC_A })
      .expect(409);
  });

  it("renames a topic", async () => {
    const response = await request(app)
      .patch(`${ADMIN}/topics/${TOPIC_A}`)
      .set("authorization", adminAuth)
      .send({ name: "Ohm's law (revised)" })
      .expect(200);

    expect(adminTopicSchema.parse(response.body.data).name).toBe("Ohm's law (revised)");
  });
});

describe("withdrawal actually withdraws", () => {
  it("removes a deactivated chapter's questions from the student view", async () => {
    // Before: the student can see the published question.
    const before = await request(app)
      .get(`/api/v1/questions/${Q_PUBLISHED}`)
      .set("authorization", studentAuth)
      .expect(200);
    expect(before.body.data.id).toBe(Q_PUBLISHED);

    await request(app)
      .patch(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .send({ isActive: false })
      .expect(200);

    // After: gone. Without the chapter clause in STUDENT_VISIBLE_QUESTION this
    // still returns 200 — withdrawn from the browse list, live on the endpoint
    // practice selection actually uses.
    await request(app)
      .get(`/api/v1/questions/${Q_PUBLISHED}`)
      .set("authorization", studentAuth)
      .expect(404);

    const list = await request(app)
      .get(`/api/v1/questions?chapterId=${CH_ONE}`)
      .set("authorization", studentAuth)
      .expect(200);
    expect(list.body.data.items).toEqual([]);
  });

  it("removes a deactivated subject's questions too", async () => {
    await request(app)
      .patch(`${ADMIN}/subjects/${SUBJECT}`)
      .set("authorization", adminAuth)
      .send({ isActive: false })
      .expect(200);

    await request(app)
      .get(`/api/v1/questions/${Q_PUBLISHED}`)
      .set("authorization", studentAuth)
      .expect(404);
  });

  it("is reversible, which a DELETE would not be", async () => {
    await request(app)
      .patch(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .send({ isActive: false })
      .expect(200);

    await request(app)
      .patch(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .send({ isActive: true })
      .expect(200);

    await request(app)
      .get(`/api/v1/questions/${Q_PUBLISHED}`)
      .set("authorization", studentAuth)
      .expect(200);
  });

  it("still counts a withdrawn chapter's questions for the editor", async () => {
    await request(app)
      .patch(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .send({ isActive: false })
      .expect(200);

    const response = await request(app)
      .get(`${ADMIN}/chapters/${CH_ONE}`)
      .set("authorization", adminAuth)
      .expect(200);

    const chapter = adminChapterSchema.parse(response.body.data);
    expect(chapter.isActive).toBe(false);
    // The editor must still be able to see that withdrawing this hid two
    // questions — otherwise the consequence of the action is invisible.
    expect(chapter.questionCount).toBe(2);
  });
});

/** Rebuild the taxonomy so each test starts from a known shape. */
async function resetTaxonomy(): Promise<void> {
  // Matched through the relation rather than by id prefix: these tests *create*
  // rows, and a created row gets a cuid, not a prefixed id. Deleting by id
  // prefix leaves those behind, and the next `deleteMany` on subjects then trips
  // the `onDelete: Restrict` foreign key — which is the constraint working, but
  // it fails the test rather than the code. Every row these tests own hangs off
  // a subject whose slug carries the prefix.
  const owned = { subject: { slug: { startsWith: PREFIX } } };

  await prisma.question.deleteMany({ where: owned });
  await prisma.topic.deleteMany({ where: { chapter: owned } });
  await prisma.chapter.deleteMany({ where: owned });
  await prisma.subject.deleteMany({ where: { slug: { startsWith: PREFIX } } });

  await prisma.subject.createMany({
    data: [
      {
        id: SUBJECT,
        code: "ADMSCI",
        name: "Admintest Science",
        slug: SUBJECT,
        board: "CBSE",
        classLevel: 10,
        theoryMarks: 80,
        syllabusYear: "2026-27",
        orderIndex: 0,
      },
      {
        id: OTHER_SUBJECT,
        code: "ADMMATH",
        name: "Admintest Maths",
        slug: OTHER_SUBJECT,
        board: "CBSE",
        classLevel: 10,
        theoryMarks: 80,
        syllabusYear: "2026-27",
        orderIndex: 1,
      },
    ],
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
        name: "Acids and Bases",
        slug: CH_TWO,
        orderIndex: 1,
        domain: "Chemistry",
      },
      {
        id: CH_THREE,
        subjectId: SUBJECT,
        name: "Life Processes",
        slug: CH_THREE,
        orderIndex: 2,
        domain: "Biology",
      },
    ],
  });

  await prisma.topic.createMany({
    data: [
      { id: TOPIC_A, chapterId: CH_ONE, name: "Ohm's law", slug: TOPIC_A, orderIndex: 0 },
      { id: TOPIC_B, chapterId: CH_ONE, name: "Resistors in series", slug: TOPIC_B, orderIndex: 1 },
    ],
  });

  await prisma.question.createMany({
    data: [
      {
        id: Q_PUBLISHED,
        subjectId: SUBJECT,
        chapterId: CH_ONE,
        type: "SHORT_ANSWER",
        body: "State Ohm's law and draw its V-I graph.",
        marks: 3,
        expectedTimeSeconds: 180,
        status: "PUBLISHED",
      },
      {
        id: Q_DRAFT,
        subjectId: SUBJECT,
        chapterId: CH_ONE,
        type: "SHORT_ANSWER",
        body: "A draft nobody has reviewed.",
        marks: 3,
        expectedTimeSeconds: 180,
        status: "DRAFT",
      },
    ],
  });
}

async function cleanUp(): Promise<void> {
  // Matched through the relation rather than by id prefix: these tests *create*
  // rows, and a created row gets a cuid, not a prefixed id. Deleting by id
  // prefix leaves those behind, and the next `deleteMany` on subjects then trips
  // the `onDelete: Restrict` foreign key — which is the constraint working, but
  // it fails the test rather than the code. Every row these tests own hangs off
  // a subject whose slug carries the prefix.
  const owned = { subject: { slug: { startsWith: PREFIX } } };

  await prisma.question.deleteMany({ where: owned });
  await prisma.topic.deleteMany({ where: { chapter: owned } });
  await prisma.chapter.deleteMany({ where: owned });
  await prisma.subject.deleteMany({ where: { slug: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
}
