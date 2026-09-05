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

  // ─── AI tutor ─────────────────────────────────────────────────────────────
  // None of this is required. An instance with no provider keys still serves
  // the tutor endpoints — every reply degrades to the human-written solution
  // already stored against the question (docs/05 §5.6). That is a legitimate
  // deployment (a demo, a CI run, a cost freeze), so it must not be a boot
  // failure the way a missing Clerk key is.

  /**
   * Ordered fallback chain. First entry is tried first; each subsequent entry
   * is tried only if the one before it failed *before producing any output*.
   *
   * Providers with no API key are dropped from the chain at startup with a
   * warning rather than failing the boot — see provider/registry.ts.
   */
  AI_PROVIDER_CHAIN: z.string().default("openrouter,gemini,grok"),

  // OpenRouter — one key, many upstream models, its own failover across
  // providers of the same model. Sits first in the default chain because it is
  // the broadest single point of access.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.url().default("https://openrouter.ai/api/v1"),
  OPENROUTER_MODEL_STRONG: z.string().default("google/gemini-2.5-pro"),
  OPENROUTER_MODEL_FAST: z.string().default("google/gemini-2.5-flash"),

  // Google Gemini, direct. Not via OpenRouter, deliberately: a chain whose
  // every hop runs through one vendor's gateway fails as a unit the moment
  // that gateway does, which is the failure a chain exists to survive.
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_BASE_URL: z.url().default("https://generativelanguage.googleapis.com/v1beta"),
  GEMINI_MODEL_STRONG: z.string().default("gemini-2.5-pro"),
  GEMINI_MODEL_FAST: z.string().default("gemini-2.5-flash"),

  // xAI Grok. OpenAI-compatible wire format, so it shares a transport with
  // OpenRouter and differs only in base URL, keys and model ids.
  XAI_API_KEY: z.string().optional(),
  XAI_BASE_URL: z.url().default("https://api.x.ai/v1"),
  XAI_MODEL_STRONG: z.string().default("grok-4"),
  XAI_MODEL_FAST: z.string().default("grok-3-mini"),

  /** Whole-request ceiling for one provider attempt, including streaming. */
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(45_000),
  /**
   * How long a provider gets to produce its *first* token before the chain
   * gives up on it and moves down.
   *
   * Separate from the overall timeout, and the more important of the two: a
   * provider that is going to answer in 30 seconds has almost always started
   * answering within 10. Waiting out the full request timeout on each of three
   * providers turns one slow provider into a two-minute page.
   */
  AI_FIRST_TOKEN_TIMEOUT_MS: z.coerce.number().int().positive().default(12_000),
  /**
   * After a provider fails, how long before it is tried first again.
   *
   * Without this, a hard-down primary is retried — and waited on — by every
   * single request, and the fallback chain converts an outage into latency for
   * everyone instead of routing around it.
   */
  AI_PROVIDER_COOLDOWN_MS: z.coerce.number().int().nonnegative().default(60_000),

  /** Free-tier daily caps, enforced against AIUsageLedger before any call. */
  AI_DAILY_MESSAGE_QUOTA: z.coerce.number().int().positive().default(30),
  AI_DAILY_TOKEN_QUOTA: z.coerce.number().int().positive().default(120_000),
  /** Burst limit on top of the daily quota: N messages per window. */
  AI_RATE_LIMIT_MESSAGES: z.coerce.number().int().positive().default(10),
  AI_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(5 * 60_000),

  /** Sent to OpenRouter as attribution headers. Cosmetic; helps their dashboard. */
  AI_SITE_URL: z.string().default("https://samjho.app"),
  AI_SITE_NAME: z.string().default("Samjho"),

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

    ai: {
      /**
       * The declared chain, in order. Unknown names are rejected here rather
       * than ignored — a typo in AI_PROVIDER_CHAIN that silently shortens the
       * chain is exactly the sort of thing nobody notices until the primary is
       * down and the fallback everyone assumed existed turns out not to.
       */
      chain: parseProviderChain(env.AI_PROVIDER_CHAIN),
      requestTimeoutMs: env.AI_REQUEST_TIMEOUT_MS,
      firstTokenTimeoutMs: env.AI_FIRST_TOKEN_TIMEOUT_MS,
      providerCooldownMs: env.AI_PROVIDER_COOLDOWN_MS,
      dailyMessageQuota: env.AI_DAILY_MESSAGE_QUOTA,
      dailyTokenQuota: env.AI_DAILY_TOKEN_QUOTA,
      rateLimit: {
        messages: env.AI_RATE_LIMIT_MESSAGES,
        windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
      },
      siteUrl: env.AI_SITE_URL,
      siteName: env.AI_SITE_NAME,

      openrouter: {
        apiKey: env.OPENROUTER_API_KEY,
        baseUrl: env.OPENROUTER_BASE_URL.replace(/\/+$/, ""),
        strongModel: env.OPENROUTER_MODEL_STRONG,
        fastModel: env.OPENROUTER_MODEL_FAST,
      },
      gemini: {
        apiKey: env.GEMINI_API_KEY,
        baseUrl: env.GEMINI_BASE_URL.replace(/\/+$/, ""),
        strongModel: env.GEMINI_MODEL_STRONG,
        fastModel: env.GEMINI_MODEL_FAST,
      },
      grok: {
        apiKey: env.XAI_API_KEY,
        baseUrl: env.XAI_BASE_URL.replace(/\/+$/, ""),
        strongModel: env.XAI_MODEL_STRONG,
        fastModel: env.XAI_MODEL_FAST,
      },
    },

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

/** The provider ids this build knows how to talk to. */
export const AI_PROVIDER_IDS = ["openrouter", "gemini", "grok"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

function parseProviderChain(value: string): AIProviderId[] {
  const entries = splitList(value.toLowerCase());
  const unknown = entries.filter((entry) => !AI_PROVIDER_IDS.includes(entry as AIProviderId));

  if (unknown.length > 0) {
    console.error(
      `
Invalid environment configuration:
  - AI_PROVIDER_CHAIN: unknown provider(s) ${unknown.join(", ")}. Known: ${AI_PROVIDER_IDS.join(", ")}
`,
    );
    process.exit(1);
  }

  // Deduplicated, order preserved. A repeated entry would mean retrying a
  // provider that just failed, immediately, which is never what was meant.
  return [...new Set(entries as AIProviderId[])];
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim().replace(/\/+$/, ""))
    .filter((entry) => entry.length > 0);
}

export const config = loadConfig();
export type Config = typeof config;
