import { meResponseSchema, successResponseSchema } from "@samjho/contracts";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import { prisma } from "../../lib/prisma.js";
import { errorHandler } from "../../middleware/error-handler.js";
import { loadUser, requireAuth, requireRole } from "../../middleware/auth.js";
import { bearer, createTestVerifier } from "../../test/auth-fixtures.js";
import type * as ClerkUserModule from "../../lib/clerk-user.js";

/**
 * Integration tests for the whole auth chain, against a real Postgres.
 *
 * Only one thing is stubbed: `fetchClerkUser`, the single outbound HTTP call in
 * the path. Everything else — signature verification, claim checks, the lazy
 * upsert, the onboarding transaction, the enrolment reconcile — runs for real.
 *
 * That matters most for the ones that look boring. "Onboarding is idempotent"
 * cannot be established by unit-testing a service against a mock repository,
 * because idempotency is a property of the *SQL*: it lives in the upserts and
 * the unique indexes. A test that does not touch the database is not testing it.
 */

const fetchClerkUser = vi.hoisted(() => vi.fn());

vi.mock("../../lib/clerk-user.js", async (importOriginal) => ({
  // Spread the original so `ClerkUserError` stays the real class — the
  // middleware branches on `instanceof`, and a mocked-out constructor would
  // make that branch silently unreachable.
  ...(await importOriginal<typeof ClerkUserModule>()),
  fetchClerkUser,
}));

const app = createApp({ verifyToken: createTestVerifier() });

const PREFIX = "authtest";
const MATHS = `${PREFIX}-maths`;
const SCIENCE = `${PREFIX}-science`;
const PHYSICS_12 = `${PREFIX}-physics-12`;

const createdUserIds: string[] = [];

beforeAll(async () => {
  await cleanUp();

  await prisma.subject.createMany({
    data: [
      subjectFixture(MATHS, "ATMATH", "Authtest Mathematics", 10, 80),
      subjectFixture(SCIENCE, "ATSCI", "Authtest Science", 10, 80),
      subjectFixture(PHYSICS_12, "ATPHY", "Authtest Physics", 12, 70),
    ],
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  if (createdUserIds.length > 0) {
    // StudentProfile → TargetExam / SubjectEnrolment all cascade from the user.
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds.splice(0) } } });
  }
});

afterAll(async () => {
  await cleanUp();
  await prisma.$disconnect();
});

async function cleanUp(): Promise<void> {
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
  await prisma.subject.deleteMany({ where: { id: { startsWith: PREFIX } } });
}

function subjectFixture(
  id: string,
  code: string,
  name: string,
  classLevel: number,
  theoryMarks: number,
) {
  return {
    id,
    code,
    name,
    slug: id,
    board: "CBSE" as const,
    classLevel,
    theoryMarks,
    syllabusYear: "2026-27",
    isActive: true,
  };
}

let userCounter = 0;

async function createUser(
  overrides: {
    role?: "STUDENT" | "ADMIN" | "CONTENT_EDITOR";
    status?: "ACTIVE" | "SUSPENDED" | "DELETED";
  } = {},
): Promise<{ id: string; clerkId: string; email: string }> {
  userCounter += 1;
  const clerkId = `${PREFIX}_user_${String(userCounter)}_${String(Date.now())}`;

  const user = await prisma.user.create({
    data: {
      clerkId,
      email: `${clerkId}@example.test`,
      name: "Test Student",
      role: overrides.role ?? "STUDENT",
      status: overrides.status ?? "ACTIVE",
    },
    select: { id: true, clerkId: true, email: true },
  });

  createdUserIds.push(user.id);
  return user;
}

/**
 * `Record<string, unknown>` rather than `Partial<OnboardingInput>` because
 * several tests below deliberately send input the contract forbids — an
 * unticked consent box, a duplicated subject. A builder typed to only produce
 * valid bodies could not express the cases most worth testing.
 */
function onboardingBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    classLevel: 10,
    board: "CBSE",
    school: "Test Public School",
    preferredLanguage: "ENGLISH",
    subjectIds: [MATHS, SCIENCE],
    targetExam: { session: "2027", phase: "PHASE_1" },
    parentEmail: "a.parent@example.test",
    consent: { parentalConsentAcknowledged: true, termsAccepted: true },
    ...overrides,
  };
}

function parseMe(body: unknown) {
  return successResponseSchema(meResponseSchema).parse(body).data;
}

// ── Authentication ───────────────────────────────────────────────────────────

describe("authentication", () => {
  it("rejects a request with no Authorization header", async () => {
    const response = await request(app).get("/api/v1/me").expect(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["a bare token with no scheme", "abc.def.ghi"],
    ["the wrong scheme", "Basic abc.def.ghi"],
    ["a token that is not three segments", "Bearer nonsense"],
    ["an empty bearer", "Bearer "],
  ])("rejects %s", async (_label, header) => {
    await request(app).get("/api/v1/me").set("authorization", header).expect(401);
  });

  it("rejects an expired token", async () => {
    await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ expiresInSeconds: -60 }))
      .expect(401);
  });

  it("rejects a token minted for another origin", async () => {
    await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ azp: "https://elsewhere.example" }))
      .expect(401);
  });

  it("never explains why a token was refused", async () => {
    // The client gets one message for every failure mode. Distinguishing
    // "expired" from "bad signature" tells someone probing which half of their
    // forgery to work on.
    const expired = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ expiresInSeconds: -60 }));
    const forged = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ signWithForeignKey: true }));

    expect(expired.body.error.message).toBe(forged.body.error.message);
  });

  it("accepts a valid token and returns the user's own record", async () => {
    const user = await createUser();

    const response = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(200);

    const me = parseMe(response.body);
    expect(me.user.id).toBe(user.id);
    expect(me.user.role).toBe("STUDENT");
    expect(me.profile).toBeNull();
    expect(me.onboarded).toBe(false);
    expect(fetchClerkUser).not.toHaveBeenCalled();
  });

  it("treats an admin as onboarded, since they have no student profile to fill in", async () => {
    const user = await createUser({ role: "ADMIN" });

    const response = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(200);

    const me = parseMe(response.body);
    expect(me.profile).toBeNull();
    // Otherwise route guards would send an admin to a student wizard that has
    // nothing valid to submit — a redirect loop with no way out.
    expect(me.onboarded).toBe(true);
  });
});

// ── The lazy upsert ──────────────────────────────────────────────────────────

describe("lazy user creation", () => {
  it("creates the local row on first sight of a verified Clerk id", async () => {
    // The path that keeps signup working when the webhook is late, lost, or —
    // in local development — never configured at all.
    const clerkId = `${PREFIX}_lazy_${String(Date.now())}`;
    fetchClerkUser.mockResolvedValueOnce({
      clerkUserId: clerkId,
      email: `${clerkId}@example.test`,
      name: "Lazily Created",
      imageUrl: null,
    });

    const response = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: clerkId }))
      .expect(200);

    const me = parseMe(response.body);
    expect(me.user.name).toBe("Lazily Created");
    createdUserIds.push(me.user.id);

    const stored = await prisma.user.findUnique({ where: { clerkId } });
    expect(stored?.role).toBe("STUDENT");
  });

  it("answers 503, not 401, when Clerk cannot be reached", async () => {
    const { ClerkUserError } = await import("../../lib/clerk-user.js");
    fetchClerkUser.mockRejectedValueOnce(new ClerkUserError("Clerk API returned 500"));

    const response = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: `${PREFIX}_unreachable` }))
      .expect(503);

    // A 401 here would send the web app into a sign-in loop trying to fix a
    // problem that is not the user's.
    expect(response.body.error.code).toBe("SERVICE_UNAVAILABLE");
  });
});

// ── Account status ───────────────────────────────────────────────────────────

describe("account status", () => {
  it("refuses a suspended account", async () => {
    const user = await createUser({ status: "SUSPENDED" });

    const response = await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(403);

    expect(response.body.error.message).toMatch(/suspended/i);
  });

  it("refuses a deleted account even with a live token", async () => {
    const user = await createUser({ status: "DELETED" });

    await request(app)
      .get("/api/v1/me")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(403);
  });
});

// ── Role gating ──────────────────────────────────────────────────────────────

describe("requireRole", () => {
  /**
   * Phase 2 ships no role-gated route — the first is admin question management
   * in Phase 4. The middleware still has to be proven now, so it is mounted on
   * a route defined here rather than in the app. A test-only route inside
   * `createApp` would be a permanently deployed endpoint that exists for a test,
   * which is a worse trade than five lines of scaffolding.
   */
  const roleApp = express();
  roleApp.get(
    "/admin-only",
    requireAuth(createTestVerifier()),
    loadUser,
    requireRole("ADMIN"),
    (_req, res) => {
      res.json({ data: { ok: true } });
    },
  );
  roleApp.use(errorHandler);

  it("lets an admin through", async () => {
    const user = await createUser({ role: "ADMIN" });
    await request(roleApp)
      .get("/admin-only")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(200);
  });

  it("refuses a student with 403, not 401", async () => {
    const user = await createUser({ role: "STUDENT" });

    const response = await request(roleApp)
      .get("/admin-only")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(403);

    // The distinction matters to the client: 401 means "sign in again", 403
    // means "you will never be allowed". Conflating them produces a sign-in
    // loop that cannot succeed.
    expect(response.body.error.code).toBe("FORBIDDEN");
  });

  it("refuses a content editor on an admin route", async () => {
    const user = await createUser({ role: "CONTENT_EDITOR" });
    await request(roleApp)
      .get("/admin-only")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(403);
  });
});

// ── Onboarding ───────────────────────────────────────────────────────────────

describe("POST /me/onboarding", () => {
  it("creates the profile, target exam and enrolments in one go", async () => {
    const user = await createUser();
    const auth = await bearer({ subject: user.clerkId });

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);

    const me = parseMe(response.body);
    expect(me.onboarded).toBe(true);
    expect(me.profile?.classLevel).toBe(10);
    expect(me.profile?.school).toBe("Test Public School");
    expect(me.profile?.targetExam).toEqual({
      session: "2027",
      phase: "PHASE_1",
      examDate: null,
    });
    expect(me.profile?.subjects.map((subject) => subject.id).sort()).toEqual(
      [MATHS, SCIENCE].sort(),
    );
  });

  it("records an acknowledgement without claiming the parent consented", async () => {
    // The DPDP distinction the schema exists to preserve. A student ticking a
    // box is not a guardian acting, and the two must not be the same column.
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(onboardingBody())
      .expect(200);

    const profile = parseMe(response.body).profile;
    expect(profile?.parentEmail).toBe("a.parent@example.test");
    expect(profile?.guardianDeclaredAt).not.toBeNull();
    expect(profile?.termsAcceptedAt).not.toBeNull();
    expect(profile?.termsAcceptedVersion).toBeTruthy();
    expect(profile?.parentConsentAt).toBeNull();
  });

  it("mints a consent token but never returns it", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(onboardingBody())
      .expect(200);

    const stored = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { parentConsentToken: true },
    });

    expect(stored?.parentConsentToken).toMatch(/^[\w-]{40,}$/);
    // It is a bearer credential for a consent decision; it belongs in an email
    // link, never in a response body.
    expect(JSON.stringify(response.body)).not.toContain(stored?.parentConsentToken);
  });

  it("is idempotent — a double-submitted wizard changes nothing", async () => {
    const user = await createUser();
    const auth = await bearer({ subject: user.clerkId });

    const first = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);

    const second = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);

    // Not merely "both succeeded": the onboarding timestamp must be the
    // original one. "When did this student join" has one true answer.
    expect(parseMe(second.body).profile?.onboardedAt).toBe(
      parseMe(first.body).profile?.onboardedAt,
    );

    const counts = await prisma.studentProfile.findUnique({
      where: { userId: user.id },
      select: { _count: { select: { targetExams: true, enrolments: true } } },
    });
    expect(counts?._count).toEqual({ targetExams: 1, enrolments: 2 });
  });

  it("replaces the target exam rather than accumulating one per submission", async () => {
    const user = await createUser();
    const auth = await bearer({ subject: user.clerkId });

    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody({ targetExam: { session: "2027", phase: "PHASE_2" } }))
      .expect(200);

    expect(parseMe(response.body).profile?.targetExam?.phase).toBe("PHASE_2");
    expect(await prisma.targetExam.count({ where: { profile: { userId: user.id } } })).toBe(1);
  });

  it("rejects a parent email that is the student's own", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      // Upper-cased to prove the comparison is not case-sensitive — the first
      // thing a fourteen-year-old will try.
      .send(onboardingBody({ parentEmail: user.email.toUpperCase() }))
      .expect(400);

    expect(response.body.error.details).toContainEqual({
      path: "body.parentEmail",
      message: expect.stringContaining("not your own"),
    });
  });

  it("rejects a subject from a different class level, naming it", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(onboardingBody({ subjectIds: [MATHS, PHYSICS_12] }))
      .expect(400);

    expect(response.body.error.details[0].message).toContain(PHYSICS_12);
    // Nothing may be written when part of the input is bad.
    expect(await prisma.studentProfile.count({ where: { userId: user.id } })).toBe(0);
  });

  it("rejects an unticked consent box", async () => {
    const user = await createUser();

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(
        onboardingBody({ consent: { parentalConsentAcknowledged: false, termsAccepted: true } }),
      )
      .expect(400);

    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ path: "body.consent.parentalConsentAcknowledged" }),
    );
  });

  it("rejects an omitted consent block outright", async () => {
    const user = await createUser();
    const body = onboardingBody();
    delete body["consent"];

    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(body)
      .expect(400);
  });

  it("rejects the same subject listed twice", async () => {
    const user = await createUser();

    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(onboardingBody({ subjectIds: [MATHS, MATHS] }))
      .expect(400);
  });

  it("refuses to change class level once onboarded", async () => {
    const user = await createUser();
    const auth = await bearer({ subject: user.clerkId });

    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);

    const response = await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody({ classLevel: 12, subjectIds: [PHYSICS_12] }))
      .expect(409);

    expect(response.body.error.message).toMatch(/Class 10/);
  });

  it("refuses to give an admin a student profile", async () => {
    const user = await createUser({ role: "ADMIN" });

    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send(onboardingBody())
      .expect(403);
  });
});

// ── Profile editing ──────────────────────────────────────────────────────────

describe("PATCH /me/profile", () => {
  async function onboardedUser() {
    const user = await createUser();
    const auth = await bearer({ subject: user.clerkId });
    await request(app)
      .post("/api/v1/me/onboarding")
      .set("authorization", auth)
      .send(onboardingBody())
      .expect(200);
    return { user, auth };
  }

  it("refuses before onboarding is finished", async () => {
    const user = await createUser();

    await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .send({ school: "Somewhere Else" })
      .expect(409);
  });

  it("rejects an empty patch", async () => {
    const { auth } = await onboardedUser();

    await request(app).patch("/api/v1/me/profile").set("authorization", auth).send({}).expect(400);
  });

  it("updates only the fields sent", async () => {
    const { auth } = await onboardedUser();

    const response = await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ school: "New School", preferredLanguage: "HINDI" })
      .expect(200);

    const profile = parseMe(response.body).profile;
    expect(profile?.school).toBe("New School");
    expect(profile?.preferredLanguage).toBe("HINDI");
    // Untouched.
    expect(profile?.subjects).toHaveLength(2);
  });

  it("deactivates a dropped subject instead of deleting the enrolment", async () => {
    const { user, auth } = await onboardedUser();

    const response = await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ subjectIds: [MATHS] })
      .expect(200);

    expect(parseMe(response.body).profile?.subjects.map((s) => s.id)).toEqual([MATHS]);

    // The row survives, deactivated, so a student who drops Science in
    // September and returns in December still has their history.
    const dropped = await prisma.subjectEnrolment.findFirst({
      where: { profile: { userId: user.id }, subjectId: SCIENCE },
    });
    expect(dropped?.isActive).toBe(false);
  });

  it("re-activates a subject that is selected again", async () => {
    const { auth } = await onboardedUser();

    await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ subjectIds: [MATHS] })
      .expect(200);

    const response = await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ subjectIds: [MATHS, SCIENCE] })
      .expect(200);

    expect(parseMe(response.body).profile?.subjects).toHaveLength(2);
  });

  it("clears recorded consent when the parent's email changes", async () => {
    const { user, auth } = await onboardedUser();

    // Simulate a parent having actually verified, which the closed pilot does
    // not yet do — the point is that the consent must not survive the change.
    await prisma.studentProfile.update({
      where: { userId: user.id },
      data: { parentConsentAt: new Date() },
    });

    const response = await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ parentEmail: "different.parent@example.test" })
      .expect(200);

    const profile = parseMe(response.body).profile;
    expect(profile?.parentEmail).toBe("different.parent@example.test");
    // Otherwise "change the parent's email" is a way to launder an unconsented
    // account into a consented one.
    expect(profile?.parentConsentAt).toBeNull();
  });

  it("keeps consent intact when the email is resubmitted unchanged", async () => {
    const { user, auth } = await onboardedUser();
    await prisma.studentProfile.update({
      where: { userId: user.id },
      data: { parentConsentAt: new Date() },
    });

    const response = await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ parentEmail: "a.parent@example.test" })
      .expect(200);

    expect(parseMe(response.body).profile?.parentConsentAt).not.toBeNull();
  });

  it("refuses a parent email equal to the student's own", async () => {
    const { user, auth } = await onboardedUser();

    await request(app)
      .patch("/api/v1/me/profile")
      .set("authorization", auth)
      .send({ parentEmail: user.email })
      .expect(400);
  });
});

// ── Catalog ──────────────────────────────────────────────────────────────────

describe("GET /catalog/subjects", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/v1/catalog/subjects?classLevel=10").expect(401);
  });

  it("returns only the requested class level", async () => {
    const user = await createUser();

    const response = await request(app)
      .get("/api/v1/catalog/subjects?classLevel=10&board=CBSE")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(200);

    const ids = (response.body.data.subjects as { id: string }[]).map((s) => s.id);
    expect(ids).toContain(MATHS);
    expect(ids).not.toContain(PHYSICS_12);
  });

  it("rejects a class level that does not sit board exams", async () => {
    const user = await createUser();

    await request(app)
      .get("/api/v1/catalog/subjects?classLevel=11")
      .set("authorization", await bearer({ subject: user.clerkId }))
      .expect(400);
  });
});
