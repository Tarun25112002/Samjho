import request from "supertest";
import { Webhook } from "svix";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { config } from "../../lib/config.js";
import { prisma } from "../../lib/prisma.js";
import { createTestVerifier } from "../../test/auth-fixtures.js";

/**
 * The Clerk webhook, signed for real.
 *
 * This endpoint is unauthenticated, publicly reachable, and writes to the users
 * table — which makes it the most attackable surface in the API. The signature
 * check is the only thing standing between it and anyone who learns the URL, so
 * the negative cases below matter more than the happy path.
 *
 * Signatures are produced by the same `svix` library that verifies them, using
 * the test secret from `test/setup.ts`. Hand-rolling the HMAC would test our
 * understanding of the algorithm rather than the endpoint.
 */

const app = createApp({ verifyToken: createTestVerifier() });
const webhook = new Webhook(config.clerk.webhookSigningSecret);

const PREFIX = "hooktest";

function clerkUserPayload(clerkId: string, overrides: Record<string, unknown> = {}) {
  return {
    id: clerkId,
    email_addresses: [
      {
        id: "idn_primary",
        email_address: `${clerkId}@example.test`,
        verification: { status: "verified" },
      },
    ],
    primary_email_address_id: "idn_primary",
    first_name: "Aarav",
    last_name: "Sharma",
    username: null,
    image_url: "https://img.clerk.com/aarav.png",
    has_image: true,
    // A field we do not model, to prove an unknown key does not break parsing.
    two_factor_enabled: false,
    ...overrides,
  };
}

/** Sign a payload exactly as Clerk would. */
function send(body: unknown, options: { tamper?: boolean; messageId?: string } = {}) {
  const payload = JSON.stringify(body);
  const messageId = options.messageId ?? `msg_${String(Date.now())}_${String(Math.random())}`;
  const timestamp = new Date();

  const signature = webhook.sign(messageId, timestamp, payload);

  return request(app)
    .post("/webhooks/clerk")
    .set("content-type", "application/json")
    .set("svix-id", messageId)
    .set("svix-timestamp", String(Math.floor(timestamp.getTime() / 1000)))
    .set("svix-signature", options.tamper === true ? "v1,YmFkc2lnbmF0dXJl" : signature)
    .send(payload);
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { clerkId: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({
    where: { clerkId: { startsWith: `deleted_` }, email: { contains: "@samjho.invalid" } },
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /webhooks/clerk — signature", () => {
  it("refuses an unsigned request", async () => {
    await request(app)
      .post("/webhooks/clerk")
      .set("content-type", "application/json")
      .send(JSON.stringify({ type: "user.deleted", data: { id: "anything" } }))
      .expect(400);
  });

  it("refuses a request whose signature does not match", async () => {
    const clerkId = `${PREFIX}_forged`;

    await send({ type: "user.created", data: clerkUserPayload(clerkId) }, { tamper: true }).expect(
      400,
    );

    // The important half of the assertion: nothing was written.
    expect(await prisma.user.count({ where: { clerkId } })).toBe(0);
  });

  it("refuses a body that was altered after signing", async () => {
    // The realistic attack: intercept a legitimate event, swap the id, replay.
    const payload = JSON.stringify({
      type: "user.deleted",
      data: { id: `${PREFIX}_victim` },
    });
    const messageId = "msg_replay";
    const timestamp = new Date();
    const signature = webhook.sign(messageId, timestamp, payload);

    await request(app)
      .post("/webhooks/clerk")
      .set("content-type", "application/json")
      .set("svix-id", messageId)
      .set("svix-timestamp", String(Math.floor(timestamp.getTime() / 1000)))
      .set("svix-signature", signature)
      .send(JSON.stringify({ type: "user.deleted", data: { id: "someone-else" } }))
      .expect(400);
  });

  it("refuses a correctly signed but stale request", async () => {
    // Svix embeds the timestamp in the signed content and enforces a five-minute
    // window, which is what stops a captured request being replayed tomorrow.
    const payload = JSON.stringify({ type: "user.created", data: clerkUserPayload(PREFIX) });
    const messageId = "msg_stale";
    const oldTimestamp = new Date(Date.now() - 60 * 60 * 1000);

    await request(app)
      .post("/webhooks/clerk")
      .set("content-type", "application/json")
      .set("svix-id", messageId)
      .set("svix-timestamp", String(Math.floor(oldTimestamp.getTime() / 1000)))
      .set("svix-signature", webhook.sign(messageId, oldTimestamp, payload))
      .send(payload)
      .expect(400);
  });
});

describe("POST /webhooks/clerk — user lifecycle", () => {
  it("creates a user on user.created", async () => {
    const clerkId = `${PREFIX}_created`;

    await send({ type: "user.created", data: clerkUserPayload(clerkId) }).expect(200);

    const user = await prisma.user.findUnique({ where: { clerkId } });
    expect(user).toMatchObject({
      email: `${clerkId}@example.test`,
      name: "Aarav Sharma",
      imageUrl: "https://img.clerk.com/aarav.png",
      role: "STUDENT",
      status: "ACTIVE",
    });
  });

  it("is idempotent, because Clerk retries", async () => {
    const clerkId = `${PREFIX}_retried`;
    const body = { type: "user.created", data: clerkUserPayload(clerkId) };

    await send(body).expect(200);
    await send(body).expect(200);

    expect(await prisma.user.count({ where: { clerkId } })).toBe(1);
  });

  it("updates the fields Clerk owns on user.updated", async () => {
    const clerkId = `${PREFIX}_updated`;
    await send({ type: "user.created", data: clerkUserPayload(clerkId) }).expect(200);

    await send({
      type: "user.updated",
      data: clerkUserPayload(clerkId, { first_name: "Diya", last_name: "Verma" }),
    }).expect(200);

    expect(await prisma.user.findUnique({ where: { clerkId } })).toMatchObject({
      name: "Diya Verma",
    });
  });

  it("never lets a webhook change our own authorization fields", async () => {
    // The one thing an identity provider must not be able to do. Even a
    // perfectly signed event from Clerk cannot promote an account.
    const clerkId = `${PREFIX}_privesc`;
    await send({ type: "user.created", data: clerkUserPayload(clerkId) }).expect(200);
    await prisma.user.update({ where: { clerkId }, data: { role: "ADMIN" } });

    await send({
      type: "user.updated",
      data: clerkUserPayload(clerkId, { public_metadata: { role: "STUDENT" } }),
    }).expect(200);

    // Role survived the update, because `upsertFromClerk` does not write it.
    expect(await prisma.user.findUnique({ where: { clerkId } })).toMatchObject({ role: "ADMIN" });
  });

  it("stores no image when the user has not set one", async () => {
    // Clerk serves a generated initials avatar; storing it would make "no
    // picture" indistinguishable from "chose this picture".
    const clerkId = `${PREFIX}_noimage`;

    await send({
      type: "user.created",
      data: clerkUserPayload(clerkId, { has_image: false }),
    }).expect(200);

    expect(await prisma.user.findUnique({ where: { clerkId } })).toMatchObject({ imageUrl: null });
  });

  it("anonymises rather than deletes on user.deleted", async () => {
    const clerkId = `${PREFIX}_deleted`;
    await send({ type: "user.created", data: clerkUserPayload(clerkId) }).expect(200);

    const before = await prisma.user.findUniqueOrThrow({ where: { clerkId } });
    await prisma.studentProfile.create({
      data: {
        userId: before.id,
        classLevel: 10,
        school: "Some School",
        parentEmail: "parent@example.test",
        onboardedAt: new Date(),
      },
    });

    await send({ type: "user.deleted", data: { id: clerkId } }).expect(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: before.id } });
    expect(after.status).toBe("DELETED");
    expect(after.name).toBeNull();
    expect(after.email).not.toBe(before.email);
    expect(after.clerkId).not.toBe(clerkId);

    // Personal data gone; the row — and everything that references it — intact.
    const profile = await prisma.studentProfile.findUniqueOrThrow({
      where: { userId: before.id },
    });
    expect(profile.school).toBeNull();
    expect(profile.parentEmail).toBeNull();
    expect(profile.classLevel).toBe(10);

    await prisma.user.delete({ where: { id: before.id } });
  });

  it("accepts a delete for a user it has never seen", async () => {
    // Clerk retries, and the second delivery finds the work already done. That
    // is normal, not an error — a 500 here would make Svix retry forever.
    await send({ type: "user.deleted", data: { id: `${PREFIX}_never_existed` } }).expect(200);
  });

  it("acknowledges event types it does not handle", async () => {
    // Clerk emits dozens (sessions, organisations, emails). Anything other than
    // 2xx makes Svix retry them all, indefinitely.
    await send({ type: "session.created", data: { id: "sess_123" } }).expect(200);
  });
});
