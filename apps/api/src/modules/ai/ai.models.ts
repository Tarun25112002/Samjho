import type { AIAction } from "@samjho/contracts";

import type { ModelTier } from "./provider/types.js";

/**
 * What each action costs, and which class of model earns it.
 *
 * Routing per *action* rather than globally is one of the larger cost levers
 * available (docs/05 §5.4), and it is not only about money. The six actions
 * genuinely want different behaviour: a hint must stay short or it stops being
 * a hint, and a worked solution that reformats the official marking scheme
 * wants a near-zero temperature because there is exactly one right answer and
 * no call for invention.
 *
 * `maxTokens` is a ceiling, not a target, and is deliberately tight. A model
 * given room to ramble will use it, and the student who wanted one nudge gets
 * six paragraphs — which is worse pedagogy *and* more expensive, the rare case
 * where the two point the same way.
 */
export interface ActionProfile {
  tier: ModelTier;
  maxTokens: number;
  temperature: number;
  /**
   * Whether this action's reply may be served from the explanation cache.
   *
   * "Explain the concept" for a given question is near-identical across
   * students, so it caches. Anything that reads the student's own attempt does
   * not — a cached "explain my mistake" would explain somebody else's.
   */
  cacheable: boolean;
}

export const ACTION_PROFILES = {
  // Short by design. The failure mode of a hint is giving too much away, and
  // brevity is the cheapest structural defence against that.
  HINT: { tier: "fast", maxTokens: 300, temperature: 0.4, cacheable: false },

  // Teaches the idea rather than this question, so it is the same explanation
  // for every student who asks — the one action worth caching.
  EXPLAIN: { tier: "strong", maxTokens: 700, temperature: 0.5, cacheable: true },

  // Reads the student's own answer against the marking scheme. Low temperature:
  // this is diagnosis, and a creative diagnosis is a wrong one.
  WHY_WRONG: { tier: "strong", maxTokens: 600, temperature: 0.25, cacheable: false },

  // The longest and most expensive action, and the one where accuracy matters
  // most, so it gets the strong model and the largest budget.
  STEP_BY_STEP: { tier: "strong", maxTokens: 900, temperature: 0.2, cacheable: false },

  // A rewrite of text the model already produced. No reasoning required, so the
  // cheap model does it as well as the expensive one.
  SIMPLER: { tier: "fast", maxTokens: 500, temperature: 0.5, cacheable: false },

  // Only reaches a model when the question bank has nothing suitable — see
  // ai.service.ts. When it does, it is authoring, which wants some latitude.
  SIMILAR: { tier: "strong", maxTokens: 600, temperature: 0.7, cacheable: false },
} as const satisfies Record<AIAction, ActionProfile>;

export function profileFor(action: AIAction): ActionProfile {
  return ACTION_PROFILES[action];
}

/**
 * Token budget for conversation history on the way into a request.
 *
 * History is trimmed to this, oldest first. The number is chosen against the
 * cost model in docs/05 §5 — roughly 1,500 prompt tokens per interaction, of
 * which the system prompt and the grounded context are the larger part — not
 * against any provider's context limit. Every model in the chain could hold far
 * more; the constraint is what we are willing to pay for on every turn, and a
 * tutor that needs twenty turns of scrollback to answer has lost the thread
 * anyway.
 */
export const HISTORY_TOKEN_BUDGET = 1_200;
