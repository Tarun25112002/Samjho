import { AsyncLocalStorage } from "node:async_hooks";

import pino from "pino";

import { config } from "./config.js";

/**
 * Request-scoped context.
 *
 * AsyncLocalStorage lets any code deep in a service reach the current request's
 * id without every function signature growing a `ctx` parameter. The alternative
 * — threading a context object through routes → services → repositories — is
 * noise in every signature for the sake of one field.
 */
export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContextStore = new AsyncLocalStorage<RequestContext>();

export function getRequestContext(): RequestContext | undefined {
  return requestContextStore.getStore();
}

export const logger = pino({
  level: config.logLevel,

  // Pretty output locally; newline-delimited JSON in production, where a log
  // aggregator is doing the reading rather than a human.
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }),

  // Anything listed here is replaced with [Redacted] before it reaches a log
  // sink. Auth headers and cookies are obvious; student answers and AI prompt
  // content are added as those features land (see docs/06-security-and-ops.md).
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "*.password",
      "*.token",
      "*.apiKey",
    ],
    censor: "[Redacted]",
  },

  base: { service: config.service, version: config.version },

  // Every log line automatically carries the current request id.
  mixin() {
    const ctx = getRequestContext();
    return ctx ? { requestId: ctx.requestId, ...(ctx.userId ? { userId: ctx.userId } : {}) } : {};
  },
});

export type Logger = typeof logger;
