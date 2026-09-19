import type { WeeklyPlanDay } from "@medhavi/contracts";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { aiIsConfigured, completeWithChain } from "../ai/provider/registry.js";
import { deterministicNote } from "./study-plan.week.js";

/**
 * The voice on top of the plan.
 *
 * ## What the model is given and what it can change
 *
 * It is given the seven days, already decided, and the two or three facts that
 * decided them. It returns an opening and seven sentences. It cannot add a day,
 * move a topic, change a question count or schedule a mock — those arrive as
 * data and leave as data, and this file only ever reads them.
 *
 * So the worst outcome here is a sentence that explains a slot poorly, which a
 * student can disregard. The outcome this arrangement rules out is a plan that
 * tells a student to revise a topic they have never been taught, which they
 * would follow.
 *
 * ## Why it is worth a model call at all
 *
 * Because "20 questions on Quadratic Equations" is a task and "you have lost
 * marks to sign errors three weeks running, so today is about slowing down
 * rather than getting through them" is a reason — and a plan without reasons is
 * a list a student stops opening by Wednesday.
 */

const MAX_TOKENS = 700;
const TEMPERATURE = 0.5;

const SYSTEM = `
You are a calm, experienced CBSE tutor writing the week's plan for one student. The plan itself has already been decided from their own data. You are writing the reasons.

WHAT YOU ARE WRITING
- An opening of at most two sentences, addressed to the student as "you".
- One sentence for each of the seven days, saying why that is the day's work.

RULES
- Every day's sentence must be about that day's actual slot. Do not suggest different work, a different topic, or a different number of questions. The plan is fixed.
- Use the figures you are given and no others. Never invent a topic, a subject, a score or a count.
- No greeting, no sign-off, no motivational filler, no exclamation marks. A student can tell the difference between a reason and encouragement, and only one of them is worth reading.
- Plain English for a fifteen-year-old. Short sentences.
- A rest day is a real part of the plan. Say why it is there; do not apologise for it.
- If the exam is close, let that show in how you write — direct, specific, no hedging. Do not tell them to panic and do not tell them it will be fine.
- Where the data is thin, say what it is thin on rather than inventing a reason.
`.trim();

const modelOutputSchema = z.object({
  opening: z.string(),
  notes: z.array(z.string()),
});

const MODEL_JSON_SCHEMA = {
  name: "weekly_plan_notes",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["opening", "notes"],
    properties: {
      opening: { type: "string", description: "At most two sentences." },
      notes: {
        type: "array",
        description: "Exactly seven sentences, one per day, in order.",
        items: { type: "string" },
      },
    },
  },
} as const;

export interface CoachInput {
  days: Array<Omit<WeeklyPlanDay, "note">>;
  daysToExam: number | null;
  classLevel: number;
  revisionDue: number;
  weakest: string | null;
  /** Their most common self-reported mistake reason, where one dominates. */
  mistakePattern: string | null;
}

export interface CoachResult {
  opening: string;
  notes: string[];
  generated: boolean;
}

export const studyCoach = {
  async write(input: CoachInput): Promise<CoachResult> {
    const fallback: CoachResult = {
      opening: deterministicOpening(input),
      notes: input.days.map(deterministicNote),
      generated: false,
    };

    if (!aiIsConfigured()) return fallback;

    try {
      const response = await completeWithChain({
        tier: "fast",
        system: SYSTEM,
        messages: [{ role: "user", content: describe(input) }],
        maxTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        jsonSchema: MODEL_JSON_SCHEMA,
      });

      const parsed = modelOutputSchema.safeParse(readJson(response.text));
      if (!parsed.success) return fallback;

      // A model that returned five sentences for seven days does not get to
      // leave two days unexplained: the deterministic note fills the gap, which
      // is why it exists for every kind rather than only for the unusual ones.
      const notes = input.days.map(
        (day, index) => trim(parsed.data.notes[index] ?? "") || deterministicNote(day),
      );

      const opening = trim(parsed.data.opening);

      return {
        opening: opening.length > 0 ? opening : fallback.opening,
        notes,
        generated: true,
      };
    } catch (error) {
      logger.warn({ err: error }, "Weekly coach failed; falling back to the plain plan");
      return fallback;
    }
  },
};

function trim(value: string): string {
  return value.trim().slice(0, 240);
}

/**
 * The opening when no model wrote one.
 *
 * States the week's shape and the exam distance, which is the information a
 * student actually opens this page for. It reads flatter than the written one
 * and it is not wrong, which is the right order of priorities.
 */
function deterministicOpening(input: CoachInput): string {
  const working = input.days.filter((day) => day.focus[0]?.kind !== "REST").length;
  const parts = [`${String(working)} working days this week.`];

  if (input.daysToExam !== null) {
    parts.push(
      input.daysToExam <= 0
        ? "Your exam has started."
        : `${String(input.daysToExam)} days until your exam.`,
    );
  }

  if (input.weakest) parts.push(`Most of the new practice is on ${input.weakest}.`);

  return parts.join(" ").slice(0, 400);
}

/**
 * The data block.
 *
 * The days go in fully rendered — kind, topic, count — because the model is
 * writing about them and a summary is not something it can write about. What is
 * deliberately absent is anything identifying: no name, no school, no age. The
 * same rule the tutor's learner profile follows, for the same reason (docs/07
 * R6).
 */
function describe(input: CoachInput): string {
  const lines = [`A CBSE Class ${String(input.classLevel)} student's week, already planned.`, ""];

  if (input.daysToExam !== null) {
    lines.push(`Days until their target exam: ${String(input.daysToExam)}`);
  }
  if (input.revisionDue > 0) {
    lines.push(`Questions owed to their revision queue right now: ${String(input.revisionDue)}`);
  }
  if (input.weakest) lines.push(`Their weakest topic: ${input.weakest}`);
  if (input.mistakePattern) {
    lines.push(
      `When they get things wrong, they most often say the cause was: ${input.mistakePattern}`,
    );
  }

  lines.push("", "THE SEVEN DAYS, IN ORDER — write one sentence for each:");

  for (const [index, day] of input.days.entries()) {
    const slots = day.focus
      .map((slot) => {
        switch (slot.kind) {
          case "REST":
            return "rest day, nothing scheduled";
          case "REVISION":
            return `${String(slot.questionCount)} revision questions (ones they have already got wrong)`;
          case "MOCK":
            return `a full ${slot.subjectName ?? ""} paper, three hours, to time`;
          case "TOPIC":
            return `${String(slot.questionCount)} new questions on ${slot.topicName ?? ""} (${slot.subjectName ?? ""})`;
        }
      })
      .join("; ");

    lines.push(
      `${String(index + 1)}. ${day.label}: ${slots} — about ${String(day.minutes)} minutes`,
    );
  }

  return lines.join("\n");
}

function readJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
