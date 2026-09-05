# AI Tutor Architecture

> Goal: an AI that behaves like a good teacher — one who makes you think — rather than an answer vending machine that produces the illusion of learning.

---

## 1. Provider abstraction

The brief asks for swappable providers. The mistake to avoid is abstracting at the wrong level: a lowest-common-denominator wrapper that reduces every provider to `sendText(string): string` throws away streaming, structured output and multimodal input — the things that actually differ between vendors, and the things the callers need.

**Abstract at the capability level, not the HTTP level:**

```ts
// apps/api/src/modules/ai/provider/types.ts
export type ModelTier = "strong" | "fast";

export interface AIProvider {
  readonly id: AIProviderId; // 'openrouter' | 'gemini' | 'grok'
  readonly capabilities: { structuredOutput: boolean; images: boolean; documents: boolean };

  /** The tutor's path: token by token, failed over only before the first one. */
  streamChat(request: ChatRequest): AsyncIterable<ChatChunk>;
  /** The extractor's path: one request, one JSON document, no partial output. */
  complete(request: ChatRequest): Promise<CompletionResponse>;
  countTokens(
    request: Pick<ChatRequest, "system" | "messages" | "tier" | "model">,
  ): Promise<number>;
}
```

`tier` rather than a model id: `"the good one"` is what a service knows, and which model that is belongs in config so changing it is an environment change rather than a deploy.

### The three providers, and why these three

- **OpenRouter** (`openai-compatible.ts`) — one key, many upstream models, with its own failover between hosts of the same model. First in the chain because it is the broadest single point of access and it reads PDFs.
- **Google Gemini, direct** (`gemini.ts`) — deliberately _not_ through OpenRouter. A chain whose every hop runs through one vendor's gateway fails as a unit the moment that gateway does, which is precisely the failure a chain exists to survive.
- **xAI Grok** (`openai-compatible.ts`, same dialect as OpenRouter) — a third vendor on a third network path. It reads images but has no document input, declared honestly in `capabilities` so the router never sends it a PDF and receives a confident answer about a file it could not see.

### The fallback chain

`FallbackChainProvider` tries them in `AI_PROVIDER_CHAIN` order. One rule shapes everything else:

**Failover ends at the first token.** Once a character has reached the student's screen, switching providers is no longer transparent — the alternatives are to abandon the text already shown or to splice a second model's continuation onto a first model's half-sentence, and both are worse than surfacing the error. Before that instant, any failure moves to the next candidate and the student sees nothing.

Which is why there are two deadlines, not one. `AI_FIRST_TOKEN_TIMEOUT_MS` (12s) is short and governs failover; `AI_REQUEST_TIMEOUT_MS` (45s) only starts mattering once text is flowing, where a long answer is not a stalled one. Waiting out a full request timeout on each of three providers would turn one slow provider into a two-minute page — the chain adding latency in exactly the situation it exists to remove it from.

A failed provider is demoted for a cooling-off period that doubles per consecutive failure (`AI_PROVIDER_COOLDOWN_MS`, capped at 8×, and a `Retry-After` wins over the curve). It is never removed outright: a chain that has excluded every provider must still ask one, because "cooling down" and "broken" are not the same thing and the only way to tell is to ask.

Non-streaming completions (`completeWithChain`, used by paper extraction) fail over on _every_ failure right to the end of the chain — a single JSON document has no instant at which something has been shown to anybody, so there is nothing to commit to.

A provider with no API key is dropped at startup with a warning rather than failing the boot: an instance with no keys must still serve every other endpoint, and the features that need a model decline and say so.

Providers are selected per-_action_, not globally (`ai.models.ts`), so an expensive step-by-step solution and a cheap rephrase need not use the same model. Model ids live in config, never inline in service code.

---

## 2. Grounding — the thing that makes this a tutor and not a chatbot

An ungrounded LLM asked "explain Q17" will confidently invent a question, a different solution method than the one the student's textbook uses, or a wrong numerical answer. All three are worse than no help at all, because students trust it.

**Every AI request is grounded in database content:**

```
System prompt
├── Role: CBSE Class {10|12} {subject} tutor, Indian curriculum, NCERT terminology
├── Pedagogy rules (see §3)
└── Formatting: LaTeX for maths, SI units, concise

Context block (server-assembled, never client-supplied)
├── Chapter + topic names
├── The exact question body, options, and marks
├── The OFFICIAL stored solution and step-marking scheme   ← the anchor
├── The student's submitted answer and whether it was correct
└── Their self-declared mistake reason, if given

Conversation history (trimmed to a token budget, oldest dropped first)

User turn: the selected action (+ optional free-text follow-up)
```

The official solution in context is what forces the AI to explain _the method CBSE expects_, using _the notation the student's textbook uses_, and to arrive at _the right answer_. It converts a generative problem into a much more reliable explanatory one.

**The client sends `{ conversationId, action, text? }` — never question content, never the solution.** If the client supplied context, a student could send a fabricated "the correct answer is B" and the model would helpfully agree. Context assembly is a server responsibility, always.

---

## 3. Tutor behaviour: the hint ladder

Six actions, deliberately ordered by how much they give away:

| Action                          | Contract                                                                                                                                                                                                                                      |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Give me a hint**              | Name the concept and the first step only. **Never** state the answer or complete the derivation. End with a question back to the student.                                                                                                     |
| **Explain the concept**         | Teach the underlying idea generally, using a _different_ example. Do not solve this question.                                                                                                                                                 |
| **Explain my mistake**          | Only available after a wrong attempt. Compare their answer to the marking scheme, name the specific error, address that.                                                                                                                      |
| **Solve step-by-step**          | Full worked solution following the official marking scheme's steps. Available freely — students who want the answer will find it anyway, and gating it just makes the product annoying. The _default_ path is hints; this is one tap further. |
| **Explain in simpler language** | Rewrite the last explanation at a lower reading level. Useful for students studying in English as a second language.                                                                                                                          |
| **Give me a similar question**  | Search the question bank for a same-topic, same-type, similar-marks question **first**. Only fall back to generation if nothing suitable exists — and mark generated questions clearly as AI-generated and unverified.                        |

The pedagogy is enforced in the system prompt _and_ by action-specific prompt templates, because a single prompt asked to behave six different ways does all six mediocrely.

**Guardrails:**

- Refuse off-topic requests politely and redirect. Scope is stated in the system prompt and reinforced by a cheap topical check on free-text follow-ups.
- **AI is hard-disabled during an in-progress exam attempt** — enforced server-side by rejecting any conversation whose `questionId` belongs to a paper with a live attempt for that user. Not merely by hiding a button.
- Model output never writes to `QuestionAnswer` or any content table. AI is read-only with respect to the question bank.
- A visible disclaimer that AI can make mistakes and the stored solution is authoritative.

---

## 4. Request flow

```
Client (practice runner)
  │  POST /api/ai/conversations/:id/messages   { action }
  ▼
Next.js BFF route handler  — same-origin, attaches Clerk token, streams through
  │
  ▼
Express  POST /api/v1/ai/conversations/:id/messages/stream
  ├─ requireAuth
  ├─ ownership: scoped by userId in the WHERE, not fetched then checked
  ├─ rate limit: 10 msg / 5 min per user (in-process sliding window)
  ├─ exam guard: reject if the question is in a live exam attempt
  ├─ action guard: WHY_WRONG needs a wrong attempt, SIMPLER needs a prior reply
  ├─ assemble grounded context from DB  (never from the request body)
  ├─ SIMILAR: search the bank first, and skip the model entirely on a hit
  ├─ quota check: AIUsageLedger — degrade to the stored solution if spent
  ├─ chain.streamChat(...)  →  SSE  →  BFF  →  client (token-by-token)
  ├─ persist both turns in one transaction + usage + latency
  └─ increment AIUsageLedger atomically
```

`POST …/messages` (no `/stream`) is the same turn, buffered. It exists because SSE is not universally survivable — some proxies and carriers buffer `text/event-stream` until the response closes — and a client that detects this falls back to it and gets the identical answer from the identical service.

**Why both turns are written together, after the reply:** a half-written exchange is worse than none. A user message with no reply reappears in the next request's history as an unanswered question, and the model dutifully answers it a second time.

**Why the guards throw but the outages do not:** an exam in progress or an unearned action means answering would be _wrong_, so those are 4xx. Every provider being down, or the daily quota being spent, only means answering _expensively_ is impossible — and there is a human-written solution already stored against the question. See §5.6.

**Why stream:** a step-by-step solution is 400–800 tokens, ~6–10 seconds of wall clock. A spinner for ten seconds reads as broken; streaming text reads as a tutor thinking. This is the difference between the feature being used and being ignored.

**Why through a BFF:** the browser gets a same-origin SSE endpoint (no CORS/EventSource credential complications), and the Clerk token is attached server-side.

**Abort handling:** if the client disconnects, the `AbortSignal` cancels the upstream call so we stop paying for tokens nobody will read. Partial output is still persisted and billed to the ledger — otherwise repeated cancel-and-retry becomes a free-tokens exploit.

---

## 5. Cost control

Unit economics decide whether this feature survives contact with real usage. Concretely: at roughly 1,500 prompt + 600 completion tokens per interaction and 15 interactions per active student per month, per-student monthly AI cost sits in the low tens of rupees at the mid-tier pricing of the three providers in the chain — sustainable, but only with the controls below in place from day one, not retrofitted after a bill arrives.

1. **Per-user daily quota** — `AIUsageLedger`, 30 messages and 120k tokens per UTC day (`AI_DAILY_*`). Checked before the provider call; billed _after_ the reply rather than reserved before it, so a request that fails over three providers and returns nothing is not charged for. The cost of that choice is that a student can exceed by exactly one message, which is the error that runs in their favour. Remaining quota is on `/ai/status` and every reply — surprise limits feel punitive; visible ones feel fair. ✅
2. **Rate limiting** — 10 messages / 5 minutes, sliding window, on top of quotas. Unlike the quota this _is_ an error: ten messages in five minutes is faster than anyone reads a tutor's reply, so it means a script or a stuck client. Currently per-process and in memory; the daily quota in Postgres is the global backstop, so the worst case behind two instances is a faster burst, still capped in total. ✅
3. **Model routing by action** — `ACTION_PROFILES` gives each of the six actions its own tier, `maxTokens` and temperature. A hint gets the fast model and 300 tokens; a worked solution gets the strong model, 900 tokens and near-zero temperature. Tight ceilings are pedagogy as well as cost: a model given room to ramble will use it, and the student who wanted one nudge gets six paragraphs. ✅
4. **Token budget per request** — history trimmed to `HISTORY_TOKEN_BUDGET` (1,200), oldest first, and `maxTokens` capped per action. The budget is set against what we are willing to pay per turn, not against any provider's context limit — every model in the chain would hold far more. ✅
5. **Bank-first SIMILAR** — "give me a similar question" searches the question bank on primary topic, type and marks before any model is asked, and skips the call entirely on a hit. Not only cheaper: a bank question has been through editorial review and carries a verified answer, where a generated one is unverified by construction. The better artefact and the cheaper one are the same artefact. ✅
6. **Degradation instead of failure** — when every provider is down, or the daily quota is spent, or no API key is configured at all, the tutor serves the stored human-written solution with `degraded: true` and a clear notice. The product keeps working. **This is the reason grounding data is mandatory: it is also the fallback.** ✅
7. **Prompt caching** — the system prompt and pedagogy rules are identical across requests and are a large share of prompt tokens. `ACTION_PROFILES.cacheable` marks which actions may use it; no provider-level cache-control is wired up yet. ⛔ Not built.
8. **Explanation cache** — "explain the concept" is near-identical across students, so it caches on `(action, questionId)`. Anything that reads the student's own attempt does not — a cached "explain my mistake" would explain somebody else's. ⛔ Not built; `cacheable` is the flag it will read.
9. **Hard monthly ceiling** with alerting at 50/80/100%. ⛔ Not built. `AIUsageLedger.estimatedCostPaise` is populated to make it possible, from rough per-provider rates — the number's job is to catch a runaway before the invoice does, not to reconcile one.

Every AI response records `promptTokens`, `completionTokens`, `model` and `latencyMs` on `AIMessage`, so cost per student, per subject and per action is queryable rather than guessed. `model` is stored as `"<provider>:<model>"` — with a chain in play, "which model answered" is only half the question anyone actually has.

---

## 6. Key security

- The provider API key exists **only** in the Express process environment. It is never in `apps/web`, never in a `NEXT_PUBLIC_*` var, never in a client bundle, never in a response body.
- All AI calls originate from the API service. There is no client-side SDK usage anywhere in this codebase.
- Prompt content is redacted from logs by default (it contains student work).
- Key rotation is a config change plus a restart; no code references a key literal.

---

## 7. Evaluation

Prompt changes are not obviously-correct in the way code changes are, so quality needs a check:

- A fixture set of ~30 (question, action) pairs across both subjects and all six actions, with expected properties: _"hint does not contain the final answer"_, _"solution matches the stored marking scheme's steps"_, _"explanation uses NCERT terminology"_.
- Run as a snapshot-style suite against the real provider before prompt changes ship. Not in CI on every commit — it costs money and is non-deterministic — but as a deliberate gate.
- Thumbs up/down on every AI message, stored on `AIMessage`, giving a real quality signal from actual students. `[V1.1]`
