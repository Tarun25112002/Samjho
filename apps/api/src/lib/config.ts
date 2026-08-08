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

  return {
    env: env.NODE_ENV,
    isProduction: env.NODE_ENV === "production",
    isTest: env.NODE_ENV === "test",
    port: env.PORT,
    databaseUrl: env.DATABASE_URL,
    corsOrigins: env.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    logLevel: env.LOG_LEVEL,
    service: "samjho-api",
    version: process.env["npm_package_version"] ?? "0.1.0",
  } as const;
}

export const config = loadConfig();
export type Config = typeof config;
