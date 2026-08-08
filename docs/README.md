# Samjho — Design Documents

CBSE Class 10 & 12 board-exam preparation platform.

**Status: Phase 0 (foundation scaffold) complete and verified. Phase 1 (data model & seed) is next.**
Setup and commands are in the [root README](../README.md); the phase plan is in [07-roadmap-risks-questions.md](./07-roadmap-risks-questions.md#1-development-phases).

| Doc                                                                | Contents                                                                                                                                                  |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [00-overview.md](./00-overview.md)                                 | Product vision, target users, core journeys, feature list, MVP scope, future features, success metrics, **verified CBSE exam facts**                      |
| [01-information-architecture.md](./01-information-architecture.md) | Navigation model, full route map, layouts, dashboard composition, the three detailed user journeys, UI states, design direction                           |
| [02-architecture.md](./02-architecture.md)                         | System topology, why a separate Express API, monorepo structure, API design + endpoint map, auth & authorization, errors/logging/config, testing strategy |
| [03-data-model.md](./03-data-model.md)                             | Entity map, the five decisions that matter, full entity reference, indexes, DB constraints, seed plan                                                     |
| [04-exam-engine.md](./04-exam-engine.md)                           | Blueprint → paper → attempt, server-authoritative timer, answer persistence & offline, exactly-once submission, scoring, runner UI, **failure matrix**    |
| [05-ai-tutor.md](./05-ai-tutor.md)                                 | Provider abstraction, grounding, the hint ladder, request flow, cost control, key security, evaluation                                                    |
| [06-security-and-ops.md](./06-security-and-ops.md)                 | Threat model, security baseline, data protection & minors (DPDP), content licensing, observability, environments & deployment, accessibility              |
| [07-roadmap-risks-questions.md](./07-roadmap-risks-questions.md)   | **10 development phases with gates, 11 technical risks, 12 open questions**                                                                               |

---

## Decisions locked (2026-08-08)

|                      |                                         |
| -------------------- | --------------------------------------- |
| **MVP subjects**     | Class 10 Mathematics + Class 10 Science |
| **Existing content** | None — building from zero               |
| **Intent**           | Commercial, serving real students       |

## The short version

**Vision.** Not a question bank with an exam mode bolted on. A loop: practise → get it wrong → understand _why_ → re-practise that. The mistake is a first-class object in the schema, not a log row.

**MVP.** Class 10 Maths + Science, complete end-to-end: auth, browse, practice with full filters, full 3-hour exam simulation, AI tutor, dashboard, admin content management. Narrow in content, complete in mechanics.

**The commercial hook:** from 2026 CBSE runs Class 10 boards twice — mandatory February, optional May, best-of-two. That creates a March–May window full of students who have just seen a real score, know which subjects failed them, and have ten weeks to fix it. Highest-intent audience this product will ever address.

**The five decisions that shape everything else:**

1. **Questions are a tree** — CBSE case-based questions have sub-parts with their own marks (1+1+2 in Maths, 1/2/3 in Science — so sub-part structure is data, not a constant).
2. **An exam position is a _slot_ that can hold alternatives** — internal choice ("attempt either/or") is everywhere in real papers.
3. **Exam structure is versioned JSON, not code** — CBSE changed the pattern twice recently; a pattern change must be a data change.
4. **The exam client is untrusted and disposable** — timer, deadline, grading and submission are all server-authoritative, with three independent auto-submit paths.
5. **`Chapter.domain`** — Class 10 Science is Physics + Chemistry + Biology in one 80-mark paper, and students navigate by domain, not by subject.

**The three biggest risks are not technical:** building ~2,000 questions per subject from zero (R1), the legal position on reproducing CBSE content (R2), and DPDP parental-consent compliance when 100% of paying users are 14–16 year-old minors (R6). All three want work starting before Phase 4.

**Start here if reading one thing:** [07-roadmap-risks-questions.md §3](./07-roadmap-risks-questions.md#3-open-questions) — Q1–Q3 resolved, Q4–Q12 open.
