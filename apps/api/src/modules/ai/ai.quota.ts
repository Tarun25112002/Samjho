import type { AIQuota } from "@samjho/contracts";

import type { AIProviderId } from "../../lib/config.js";
import { config } from "../../lib/config.js";
import { RateLimitError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/**
 * What a student is allowed to spend, and what they have spent.
 *
 * Two different limits live here and they are deliberately not the same
 * mechanism, because they exist for different reasons (docs/05 §5):
 *
 *  - **The daily quota** is a cost ceiling. Exceeding it is not misbehaviour —
 *    it is a student who revised hard on a Sunday — so it does not produce an
 *    error. The service degrades to the stored human-written solution and sets
 *    `degraded: true`. The feature keeps working; it just stops calling models.
 *  - **The rate limit** is an abuse and runaway-loop control. Ten messages in
 *    five minutes is faster than anyone reads a tutor's reply, so tripping it
 *    means a script or a stuck client, and *that* is a 429.
 *
 * Getting these the wrong way round would be a real product bug in both
 * directions: a 429 at message thirty-one reads as a fault, and a silent
 * degrade under a runaway loop hides the loop.
 */

/**
 * The ledger's day boundary: UTC midnight.
 *
 * Not IST midnight, despite every user being in India, because the column is
 * the unique key of a row written from several code paths and a boundary that
 * moves with a timezone offset is a boundary that eventually writes two rows
 * for one day. The cost of the choice is that the reset lands at 05:30 IST,
 * which is the quietest moment of an Indian student's day — the one hour where
 * an off-by-one reset is least likely to interrupt anybody.
 */
export function utcDayStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function nextUtcDayStart(now = new Date()): Date {
  const start = utcDayStart(now);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

/**
 * Order-of-magnitude output cost, in paise per million tokens.
 *
 * These are for spotting a runaway — "one student cost ₹400 yesterday" — not
 * for reconciling an invoice, and they are rounded hard on purpose so that
 * nobody mistakes the ledger for accounting. Real per-model prices differ by
 * more than an order of magnitude across the chain, which is exactly why a
 * single blended rate would be useless: the number's only job is to be roughly
 * right about which provider served the traffic.
 */
const COST_PER_MILLION_PAISE: Record<AIProviderId, number> = {
  openrouter: 40_000,
  gemini: 25_000,
  grok: 50_000,
};

function estimateCostPaise(model: string | null, tokens: number): number {
  const providerId = model?.split(":")[0] as AIProviderId | undefined;
  const rate = (providerId && COST_PER_MILLION_PAISE[providerId]) || 40_000;
  return Math.ceil((tokens * rate) / 1_000_000);
}

/**
 * The sliding window, in memory.
 *
 * Per-process, which is the honest limitation to state: behind two instances a
 * determined client gets twice the burst. That is acceptable here and would not
 * be for a login endpoint — the backstop is the daily quota, which *is* in
 * Postgres and *is* global, so the worst case is that a burst arrives faster
 * than intended while still being capped in total. Moving this to Redis is the
 * upgrade when there is a Redis; adding one for this alone would not be.
 */
const windows = new Map<string, number[]>();

/** Test seam, and the hook a future eviction sweep would use. */
export function resetRateLimits(): void {
  windows.clear();
}

export function assertNotRateLimited(userId: string, now = Date.now()): void {
  const { messages, windowMs } = config.ai.rateLimit;
  const cutoff = now - windowMs;

  const recent = (windows.get(userId) ?? []).filter((at) => at > cutoff);

  if (recent.length >= messages) {
    const oldest = recent[0] ?? now;
    const retryInSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    throw new RateLimitError(
      `You are sending messages faster than the tutor can be useful. Try again in ${retryInSeconds}s.`,
    );
  }

  recent.push(now);
  windows.set(userId, recent);

  // The map would otherwise grow one entry per user who has ever asked
  // anything, forever. Cheap opportunistic sweep on a hash of the id, so it
  // runs about once every fifty calls rather than on every one.
  if (windows.size > 1_000 && Math.random() < 0.02) {
    for (const [key, stamps] of windows) {
      if (stamps.every((at) => at <= cutoff)) windows.delete(key);
    }
  }
}

export interface QuotaState extends AIQuota {
  /** True when today's message or token allowance is spent. */
  exhausted: boolean;
  tokensUsed: number;
}

function toQuotaState(messageCount: number, totalTokens: number, now: Date): QuotaState {
  const limit = config.ai.dailyMessageQuota;
  const exhausted = messageCount >= limit || totalTokens >= config.ai.dailyTokenQuota;

  return {
    messagesUsed: messageCount,
    messagesLimit: limit,
    messagesRemaining: Math.max(0, limit - messageCount),
    resetsAt: nextUtcDayStart(now).toISOString(),
    exhausted,
    tokensUsed: totalTokens,
  };
}

/** Today's usage, without changing it. Also what `/ai/quota` returns. */
export async function readQuota(userId: string, now = new Date()): Promise<QuotaState> {
  const row = await prisma.aIUsageLedger.findUnique({
    where: { userId_date: { userId, date: utcDayStart(now) } },
    select: { messageCount: true, totalTokens: true },
  });

  return toQuotaState(row?.messageCount ?? 0, row?.totalTokens ?? 0, now);
}

/**
 * Record one model-backed turn against the ledger.
 *
 * Written *after* the reply, not reserved before it, and the difference is
 * visible to students: a reservation charges for a request that then fails over
 * three providers and returns nothing. The cost of billing afterwards is that a
 * student can exceed the quota by exactly one message — which is the cheaper
 * error of the two, and the one that errs in their favour.
 *
 * An upsert with `increment` rather than read-modify-write: two tabs asking at
 * once are two concurrent transactions on one row, and only the database can
 * settle that ordering correctly.
 */
export async function recordUsage(input: {
  userId: string;
  promptTokens: number;
  completionTokens: number;
  model: string | null;
  now?: Date;
}): Promise<QuotaState> {
  const now = input.now ?? new Date();
  const date = utcDayStart(now);
  const tokens = input.promptTokens + input.completionTokens;
  const costPaise = estimateCostPaise(input.model, tokens);

  const row = await prisma.aIUsageLedger.upsert({
    where: { userId_date: { userId: input.userId, date } },
    create: {
      userId: input.userId,
      date,
      messageCount: 1,
      totalTokens: tokens,
      estimatedCostPaise: costPaise,
    },
    update: {
      messageCount: { increment: 1 },
      totalTokens: { increment: tokens },
      estimatedCostPaise: { increment: costPaise },
    },
    select: { messageCount: true, totalTokens: true },
  });

  return toQuotaState(row.messageCount, row.totalTokens, now);
}
