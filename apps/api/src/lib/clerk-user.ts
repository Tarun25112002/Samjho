import { z } from "zod";

import { config } from "./config.js";

/**
 * Everything this service knows about Clerk's representation of a user.
 *
 * Two code paths need to turn a Clerk user into one of our `User` rows — the
 * webhook, and the lazy upsert that covers a webhook being late or lost. They
 * must produce *identical* rows, or the same person gets a different name
 * depending on which path happened to run first. So the shape is parsed once,
 * here, and normalised once, here.
 *
 * The payload is snake_case because it comes from Clerk's REST API and its
 * webhooks unchanged. Renaming it at the boundary rather than throughout the
 * codebase is the trade: one awkward file, and nothing downstream knows Clerk's
 * field names.
 */

const emailAddressSchema = z.object({
  id: z.string(),
  email_address: z.string(),
  verification: z.object({ status: z.string().nullable() }).nullish(),
});

/**
 * `.loose()` — unknown keys are kept rather than rejected.
 *
 * Deliberate: Clerk adds fields to this payload over time, and a strict schema
 * would turn "Clerk shipped a feature" into "every signup 500s". We validate
 * what we read and ignore the rest, which is the right strictness for input we
 * do not control.
 */
export const clerkUserJsonSchema = z.looseObject({
  id: z.string().min(1),
  email_addresses: z.array(emailAddressSchema).default([]),
  primary_email_address_id: z.string().nullish(),
  first_name: z.string().nullish(),
  last_name: z.string().nullish(),
  username: z.string().nullish(),
  image_url: z.string().nullish(),
  has_image: z.boolean().nullish(),
});

export type ClerkUserJson = z.infer<typeof clerkUserJsonSchema>;

/** The normalised form — exactly the columns our `User` row cares about. */
export interface ClerkUserSnapshot {
  clerkUserId: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
}

export class ClerkUserError extends Error {}

export function toUserSnapshot(user: ClerkUserJson): ClerkUserSnapshot {
  const email = pickEmail(user);
  if (email === null) {
    // Reachable only if Clerk is configured to allow a sign-in method with no
    // email — phone/OTP, say. `User.email` is unique and NOT NULL, so there is
    // no honest row to write; failing here beats inventing a placeholder that
    // collides with a real address later. Adding phone auth means revisiting
    // this and the schema together, which is the point of failing loudly.
    throw new ClerkUserError(`Clerk user ${user.id} has no email address`);
  }

  return {
    clerkUserId: user.id,
    email: email.toLowerCase(),
    name: pickName(user),
    // Clerk serves a generated initials avatar when the user has none. Storing
    // that would make "has no picture" indistinguishable from "chose one".
    imageUrl: user.has_image === true ? (user.image_url ?? null) : null,
  };
}

function pickEmail(user: ClerkUserJson): string | null {
  const addresses = user.email_addresses;

  const primary = user.primary_email_address_id
    ? addresses.find((address) => address.id === user.primary_email_address_id)
    : undefined;

  const verified = addresses.find((address) => address.verification?.status === "verified");

  return (primary ?? verified ?? addresses[0])?.email_address ?? null;
}

function pickName(user: ClerkUserJson): string | null {
  const full = [user.first_name, user.last_name]
    .filter((part) => Boolean(part))
    .join(" ")
    .trim();
  if (full.length > 0) return full;
  return user.username ?? null;
}

/**
 * Fetch a user from Clerk's Backend API.
 *
 * Called on exactly one path: an authenticated request arrives bearing a Clerk
 * id we have no local row for. In production that is rare — the `user.created`
 * webhook normally wins the race. In local development it is the *usual* path,
 * because webhooks need a public tunnel that most developers have not set up.
 * Making the lazy path fully capable rather than a stub is what keeps
 * `pnpm dev` working without one.
 *
 * A plain `fetch` rather than `@clerk/backend`: this is one GET, and a typed
 * 30-line function beats a dependency whose surface we would use 1% of.
 */
export async function fetchClerkUser(clerkUserId: string): Promise<ClerkUserSnapshot> {
  const response = await fetch(
    `https://api.clerk.com/v1/users/${encodeURIComponent(clerkUserId)}`,
    {
      headers: {
        authorization: `Bearer ${config.clerk.secretKey}`,
        accept: "application/json",
      },
      signal: AbortSignal.timeout(5_000),
    },
  );

  if (!response.ok) {
    throw new ClerkUserError(
      `Clerk API returned ${String(response.status)} for user ${clerkUserId}`,
    );
  }

  const parsed = clerkUserJsonSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new ClerkUserError(`Clerk API returned an unexpected shape for user ${clerkUserId}`);
  }

  return toUserSnapshot(parsed.data);
}
