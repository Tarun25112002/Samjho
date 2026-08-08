# AI Tutor Architecture

> Goal: an AI that behaves like a good teacher — one who makes you think — rather than an answer vending machine that produces the illusion of learning.

---

## 1. Provider abstraction

The brief asks for swappable providers. The mistake to avoid is abstracting at the wrong level: a lowest-common-denominator wrapper that reduces every provider to `sendText(string): string` throws away streaming, tool use, prompt caching, and structured output — the things that actually matter.

**Abstract at the capability level, not the HTTP level:**

```ts
// apps/api/src/modules/ai/provider/types.ts
export interface AIProvider {
  readonly id: string; // 'anthropic' | 'openai' | ...
  readonly defaultModel: string;
  streamChat(req: ChatRequest): AsyncIterable<ChatChunk>;
  countTokens(messages: ChatMessage[]): Promise<number>;
  capabilities: { streaming: boolean; systemPrompt: boolean; promptCaching: boolean };
}

export interface ChatRequest {
  model?: string;
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  temperature?: number;
  cacheableSystemPrefix?: boolean; // providers that support it use it; others ignore it
  signal?: AbortSignal;
}

export type ChatChunk =
  | { type: "text"; delta: string }
  | { type: "done"; usage: { promptTokens: number; completionTokens: number }; stopReason: string }
  | { type: "error"; code: string; retryable: boolean };
```

`AnthropicProvider` implements it first (default model: `claude-sonnet-5` — the right balance of tutoring quality and cost for high-volume per-question help; `claude-haiku-4-5` is the fallback for cheap actions like "simpler language"). `OpenAIProvider` can be added later without touching a single service.

`getProvider()` reads config; providers are selected per-_action_, not globally, so an expensive step-by-step solution and a cheap rephrase need not use the same model. Model ids live in config, never inline in service code.

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
Express  POST /api/v1/ai/conversations/:id/messages
  ├─ requireAuth
  ├─ ownership check: conversation.userId === req.user.id
  ├─ exam guard: reject if question is in a live exam attempt
  ├─ rate limit: 10 msg / 5 min per user (sliding window, Redis or Postgres)
  ├─ quota check: AIUsageLedger — daily message + token cap
  ├─ assemble grounded context from DB
  ├─ persist the user message
  ├─ provider.streamChat(...)  →  SSE  →  BFF  →  client (token-by-token)
  ├─ on completion: persist assistant message + token usage + latency
  └─ increment AIUsageLedger atomically
```

**Why stream:** a step-by-step solution is 400–800 tokens, ~6–10 seconds of wall clock. A spinner for ten seconds reads as broken; streaming text reads as a tutor thinking. This is the difference between the feature being used and being ignored.

**Why through a BFF:** the browser gets a same-origin SSE endpoint (no CORS/EventSource credential complications), and the Clerk token is attached server-side.

**Abort handling:** if the client disconnects, the `AbortSignal` cancels the upstream call so we stop paying for tokens nobody will read. Partial output is still persisted and billed to the ledger — otherwise repeated cancel-and-retry becomes a free-tokens exploit.

---

## 5. Cost control

Unit economics decide whether this feature survives contact with real usage. Concretely: at roughly 1,500 prompt + 600 completion tokens per interaction and 15 interactions per active student per month, per-student monthly AI cost sits in the low tens of rupees at current Sonnet-class pricing — sustainable, but only with the controls below in place from day one, not retrofitted after a bill arrives.

1. **Per-user daily quota** (`AIUsageLedger`), e.g. 30 messages/day free tier. Enforced before the provider call. Remaining quota is visible in `/profile` — surprise limits feel punitive; visible ones feel fair.
2. **Rate limiting** — 10 messages / 5 minutes, on top of quotas, to stop runaway loops and scripted abuse.
3. **Prompt caching** — the system prompt and pedagogy rules are identical across all requests and account for a large share of prompt tokens. Marking them cacheable cuts input cost substantially on providers that support it.
4. **Model routing by action** — cheap model for "simpler language" and hints; stronger model for step-by-step and mistake analysis.
5. **Explanation cache** — "explain the concept" for a given topic is nearly identical across students. Cache by `(action, topicId, questionId)` with a TTL and serve the cached response. Expected to remove a meaningful share of calls.
6. **Hard monthly ceiling** with alerting at 50/80/100%. At 100%, AI degrades to serving the stored explanation with a clear notice — the product keeps working, because every question already has a human-written solution. **This is the reason grounding data is mandatory: it is also the fallback.**
7. **Token budget per request** — history trimmed to a fixed budget; `maxTokens` capped per action.

Every AI response records `promptTokens`, `completionTokens`, `model` and `latencyMs` on `AIMessage`, so cost per student, per subject, and per action is queryable rather than guessed.

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
