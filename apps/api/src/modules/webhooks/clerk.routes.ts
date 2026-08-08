import express, { Router } from "express";
import { Webhook, WebhookVerificationError } from "svix";
import { z } from "zod";

import { config } from "../../lib/config.js";
import { clerkUserJsonSchema } from "../../lib/clerk-user.js";
import { logger } from "../../lib/logger.js";
import { authService } from "../auth/auth.service.js";

/**
 * `POST /webhooks/clerk` — identity changes pushed from Clerk.
 *
 * ## Why this endpoint exists at all
 *
 * The lazy upsert in `loadUser` already creates a user on their first
 * authenticated request, so signup works without any webhook. What it cannot do
 * is notice things that happen while the user is *not* making requests: an email
 * changed in Clerk's dashboard, a name updated, an account deleted. Those only
 * arrive here.
 *
 * ## Why the signature check is not optional
 *
 * This is an unauthenticated, publicly reachable endpoint that writes to the
 * users table. Without verification, anyone who learns the URL can delete
 * accounts by POSTing `{"type":"user.deleted"}`. Svix's `verify` checks an HMAC
 * over the raw body *and* rejects timestamps outside a five-minute window, which
 * closes the replay hole a naive HMAC check would leave open.
 *
 * The raw body is what gets signed, so this router is mounted **before**
 * `express.json()` in app.ts and parses the body itself as a Buffer. Signature
 * verification against a re-serialised object silently fails the first time
 * Clerk emits a field in a different order.
 */

/** Envelope shapes we act on. Anything else is acknowledged and ignored. */
const clerkEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("user.created"), data: clerkUserJsonSchema }),
  z.object({ type: z.literal("user.updated"), data: clerkUserJsonSchema }),
  z.object({ type: z.literal("user.deleted"), data: z.object({ id: z.string().min(1) }) }),
]);

export function buildClerkWebhookRouter(): Router {
  const router = Router();
  const webhook = new Webhook(config.clerk.webhookSigningSecret);

  router.post(
    "/clerk",
    express.raw({ type: "application/json", limit: "512kb" }),
    async (req, res) => {
      const payload = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;

      if (payload === null) {
        // Means the JSON parser got here first — a mounting-order regression,
        // not a bad request. Loud, because every webhook would silently fail.
        logger.error("Clerk webhook received a parsed body; the raw parser is not mounted first");
        res
          .status(500)
          .json({ error: { code: "INTERNAL_ERROR", message: "Misconfigured webhook" } });
        return;
      }

      let event: unknown;
      try {
        event = webhook.verify(payload, {
          "svix-id": headerValue(req.headers["svix-id"]),
          "svix-timestamp": headerValue(req.headers["svix-timestamp"]),
          "svix-signature": headerValue(req.headers["svix-signature"]),
        });
      } catch (error) {
        if (error instanceof WebhookVerificationError) {
          logger.warn({ err: error }, "Rejected an unverified Clerk webhook");
          res
            .status(400)
            .json({ error: { code: "UNAUTHENTICATED", message: "Invalid signature" } });
          return;
        }
        throw error;
      }

      // Processed before responding, deliberately.
      //
      // The tempting alternative is to acknowledge with 202 and handle the event
      // in the background. That looks resilient and is the opposite: if the
      // database write then fails, we have already told Svix the event was
      // delivered, and it is gone for good — there is no second copy anywhere.
      //
      // Awaiting means a failure surfaces as a 500, Svix retries, and because
      // every handler here is an upsert, the retry converges rather than
      // duplicating. Idempotency is what makes "let it retry" the safe answer;
      // without it this reasoning would run the other way.
      await handleEvent(event);

      res.status(200).json({ data: { received: true } });
    },
  );

  return router;
}

async function handleEvent(event: unknown): Promise<void> {
  const parsed = clerkEventSchema.safeParse(event);

  if (!parsed.success) {
    // Clerk sends dozens of event types (sessions, organisations, emails). Only
    // three are ours. Anything else reaching here is expected, not an error.
    const type = getEventType(event);
    logger.debug({ type }, "Ignoring unhandled Clerk webhook event");
    return;
  }

  switch (parsed.data.type) {
    case "user.created":
    case "user.updated": {
      await authService.syncFromClerk(parsed.data.data);
      logger.info(
        { type: parsed.data.type, clerkUserId: parsed.data.data.id },
        "Synced Clerk user",
      );
      return;
    }
    case "user.deleted": {
      const { anonymised } = await authService.deleteFromClerk(parsed.data.data.id);
      logger.info(
        { clerkUserId: parsed.data.data.id, anonymised },
        anonymised ? "Anonymised deleted Clerk user" : "Delete event for an unknown user",
      );
      return;
    }
  }
}

function getEventType(event: unknown): string {
  const shape = z.object({ type: z.string() }).safeParse(event);
  return shape.success ? shape.data.type : "unknown";
}

/** Svix requires strings; Node gives `string | string[] | undefined`. */
function headerValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
