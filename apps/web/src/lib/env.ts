import { z } from "zod";

/**
 * Web app environment, validated at module load.
 *
 * The split between server-only and public variables is a security boundary,
 * not a convention. Anything prefixed `NEXT_PUBLIC_` is inlined into the
 * JavaScript bundle at build time and is therefore world-readable. An API key
 * placed there is a published API key.
 *
 * Rule for this codebase: no secret ever gets a NEXT_PUBLIC_ prefix. The AI
 * provider key (Phase 7) lives only in apps/api's environment and is never
 * referenced here at all.
 */
const serverEnvSchema = z.object({
  /** Server-to-server base URL. Inside Docker this differs from the public one. */
  API_URL: z.url().default("http://localhost:4000"),

  /**
   * Clerk's server key. The web app needs it to verify the session cookie in
   * `proxy.ts` and to mint the short-lived bearer token it forwards to the API.
   *
   * Note this is a *different* secret from the one apps/api holds, in the sense
   * that they are used for different things — the API never verifies cookies and
   * this app never calls Clerk's user API. They happen to be the same string
   * because they belong to the same Clerk instance.
   */
  CLERK_SECRET_KEY: z.string().startsWith("sk_", "must be a Clerk secret key"),
});

const publicEnvSchema = z.object({
  /** Browser-visible base URL. Public by design — it is just an address. */
  NEXT_PUBLIC_API_URL: z.url().default("http://localhost:4000"),

  /**
   * Publishable, and named so. This one is *meant* to reach the browser — it
   * identifies the Clerk instance and carries no authority. It is the clearest
   * illustration of why the NEXT_PUBLIC_ boundary is about the value's nature
   * rather than about convenience: `sk_` above would be catastrophic here, and
   * `pk_` here is entirely safe.
   */
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .startsWith("pk_", "must be a Clerk publishable key"),
});

function parseOrThrow<T extends z.ZodType>(schema: T, source: unknown, label: string): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid ${label} environment configuration:\n${issues}`);
  }
  return result.data;
}

/**
 * Server-only config. Importing this from a Client Component is a build error,
 * which is the point — it makes the boundary enforced rather than remembered.
 */
export const serverEnv = parseOrThrow(
  serverEnvSchema,
  { API_URL: process.env.API_URL, CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY },
  "server",
);

/**
 * Must reference `process.env.NEXT_PUBLIC_*` literally. Next replaces these at
 * build time by static text substitution, so a dynamic lookup like
 * `process.env[key]` yields undefined in the browser.
 */
export const publicEnv = parseOrThrow(
  publicEnvSchema,
  {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  },
  "public",
);
