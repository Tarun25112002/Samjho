import { z } from "zod";

/**
 * Load `.env` from this app's directory, if present.
 *
 * Node 22+ can do this natively, so no `dotenv` dependency. It lives here
 * rather than in server.ts so that *every* entry point — the server, tests,
 * scripts, jobs — gets the same environment without having to remember to load
 * it first.
 *
 * Missing file is fine and expected: in production the platform injects real
 * environment variables and there is no `.env` on disk.
 */
try {
  process.loadEnvFile();
} catch {
  // No .env file — rely on the ambient environment.
}

/**
 * Environment configuration, validated once at boot.
 *
 * Why validate instead of reading `process.env.FOO` where it's needed:
 *
 *  1. A missing or malformed variable crashes the process *at startup* with a
 *     precise message, rather than throwing `undefined is not a string` at 2am
 *     on whichever code path happened to need it first.
 *  2. Everything downstream gets a fully-typed object. `config.port` is a
 *     `number`, not `string | undefined`.
 *  3. There is exactly one place to look to learn what this service needs.
 *
 * The corollary: nothing outside this file reads `process.env`.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  /** Origins allowed to call this API. Comma-separated. */
  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  // ── Clerk ─────────────────────────────────────────────────────────────────
  // Every one of these is required. Auth is not an optional subsystem: an API
  // that boots without the ability to verify a token is an API that will answer
  // some request it should have refused. Better to refuse to start.

  /**
   * Clerk's Frontend API origin, e.g. `https://your-app-42.clerk.accounts.dev`.
   * This is the `iss` claim every session token carries, and the base for the
   * JWKS endpoint. Found in the Clerk dashboard under API Keys → Show JWT
   * public key → Issuer, or as the `iss` of any token from your instance.
   */
  CLERK_ISSUER_URL: z.url(),

  /**
   * Server-side Clerk key. Used for exactly one thing here: fetching a user's
   * email and name when we meet a Clerk id we have no local row for. Never
   * leaves this process, never reaches the browser.
   */
  CLERK_SECRET_KEY: z.string().min(1),

  /** Svix signing secret for the `/webhooks/clerk` endpoint (`whsec_…`). */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().min(1),

  /**
   * Origins permitted to have obtained a token (the `azp` claim). Defaults to
   * WEB_ORIGIN. Set separately only if the browser origin and the API's idea of
   * it legitimately differ — behind a proxy with a rewritten Host, say.
   */
  CLERK_AUTHORIZED_PARTIES: z.string().optional(),

  /**
   * Override the JWKS location. Derived from CLERK_ISSUER_URL when unset; the
   * override exists so tests can point at a locally generated key set, and so
   * an air-gapped deployment can serve its own mirror.
   */
  CLERK_JWKS_URL: z.url().optional(),

  // "silent" is a real Pino level, used to keep test output readable.
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    // Deliberately console.error + exit rather than throw: this happens before
    // the logger exists, and a stack trace here is noise. The operator needs to
    // know which variable is wrong, nothing else.
    console.error(`\nInvalid environment configuration:\n${issues}\n`);
    process.exit(1);
  }

  const env = parsed.data;

  const corsOrigins = splitList(env.WEB_ORIGIN);
  // Trailing slashes are the classic way to spend an afternoon on a 401: the
  // `azp` claim never carries one, so a WEB_ORIGIN of "http://localhost:3000/"
  // would never match.
  const issuer = env.CLERK_ISSUER_URL.replace(/\/+$/, "");

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    corsOrigins,
    logLevel: env.LOG_LEVEL,
    service: "samjho-api",
    version: process.env["npm_package_version"] ?? "0.1.0",

    clerk: {
      issuer,
      jwksUrl: env.CLERK_JWKS_URL ?? `${issuer}/.well-known/jwks.json`,
      secretKey: env.CLERK_SECRET_KEY,
      webhookSigningSecret: env.CLERK_WEBHOOK_SIGNING_SECRET,
      authorizedParties: env.CLERK_AUTHORIZED_PARTIES
        ? splitList(env.CLERK_AUTHORIZED_PARTIES)
        : corsOrigins,
    },
  } as const;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter((entry) => entry.length > 0);
}

export const config = loadConfig();
export type Config = typeof config;
