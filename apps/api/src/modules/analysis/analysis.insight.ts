import type { AnalysisInsight, AnalysisSubject, AnalysisTopic } from "@samjho/contracts";

import { logger } from "../../lib/logger.js";
import { aiIsConfigured, completeWithChain } from "../ai/provider/registry.js";
import type { MetricSet } from "./analysis.metrics.js";

export interface InsightInput {
  metrics: MetricSet;
  subjects: AnalysisSubject[];
  strong: AnalysisTopic[];
  needsPractice: AnalysisTopic[];
  weak: AnalysisTopic[];
  classLevel: number;
}

const MAX_TOKENS = 220;
const TEMPERATURE = 0.4;

const SYSTEM = `
You write one short paragraph for a CBSE student, summarising what their own assessment data shows.

RULES
- Three sentences at most. No headings, no lists, no preamble, no greeting.
- Every claim must be supported by a number in the data block. If the data does not show something, do not say it.
- Never invent a topic, a subject or a figure that is not in the data block.
- Name the single biggest area for improvement explicitly.
- Speak to the student as "you". Plain English, no jargon, no cheerleading.
- If the data is thin, say what it is thin on rather than guessing.
`.trim();

export const analysisInsight = {
  async build(input: InsightInput): Promise<AnalysisInsight | null> {
    const fallbackText = deterministicInsight(input);
    if (fallbackText === null) return null;

    if (!aiIsConfigured()) {
      return { text: fallbackText, generated: false };
    }

    try {
      const response = await completeWithChain({
        tier: "fast",
        system: SYSTEM,
        messages: [{ role: "user", content: describe(input) }],
        maxTokens: MAX_TOKENS,
        temperature: TEMPERATURE,
      });

      const text = response.text.trim();
      if (text.length === 0) return { text: fallbackText, generated: false };

      return { text, generated: true };
    } catch (error) {
      // An analysis page that fails because a model was unreachable is worse
      // than one that reads a little flatter. The numbers above it are the same
      // either way, and they are the part the student came for.
      logger.warn({ err: error }, "Could not generate a preparation insight; using the summary");
      return { text: fallbackText, generated: false };
    }
  },
};

export function deterministicInsight(input: InsightInput): string | null {
  const { metrics, strong, weak, needsPractice } = input;
  if (metrics.overallMastery === null) return null;

  const sentences: string[] = [];

  const best = strong[0];
  if (best) {
    sentences.push(
      `You are solid on ${best.name}, where you are scoring ${percent(best.masteryScore)}.`,
    );
  } else {
    sentences.push(
      `Across ${String(metrics.scored)} answered questions you are scoring ${percent(metrics.overallMastery)} overall.`,
    );
  }

  const worst = weak[0] ?? needsPractice.at(-1);
  if (worst) {
    sentences.push(
      `${worst.name} is currently your biggest area for improvement, at ${percent(worst.masteryScore)}.`,
    );
  }

  if (
    metrics.problemSolving !== null &&
    metrics.conceptualUnderstanding !== null &&
    metrics.conceptualUnderstanding - metrics.problemSolving > 0.12
  ) {
    sentences.push(
      "You know the ideas better than you apply them — your accuracy drops on questions that need a method worked through rather than recalled.",
    );
  } else if (metrics.consistency !== null && metrics.consistency < 0.5) {
    sentences.push(
      "Your accuracy swings a lot from one session to the next, which usually means a topic is half-learned rather than unknown.",
    );
  } else if (metrics.paceRatio !== null && metrics.paceRatio > 1.4) {
    sentences.push(
      "You are taking noticeably longer than these questions are meant to take, so pace is worth practising alongside accuracy.",
    );
  }

  return sentences.join(" ");
}

function describe(input: InsightInput): string {
  const lines: string[] = [];

  lines.push(`Class: ${String(input.classLevel)}`);
  lines.push(`Questions scored: ${String(input.metrics.scored)}`);
  lines.push(`Overall mastery: ${percent(input.metrics.overallMastery)}`);
  lines.push(`Accuracy: ${percent(input.metrics.accuracy)}`);
  lines.push(`Consistency: ${percent(input.metrics.consistency)}`);
  lines.push(`Problem solving: ${percent(input.metrics.problemSolving)}`);
  lines.push(`Conceptual understanding: ${percent(input.metrics.conceptualUnderstanding)}`);
  lines.push(
    `Pace against expected time: ${input.metrics.paceRatio === null ? "unknown" : `${String(input.metrics.paceRatio)}x`}`,
  );

  lines.push("");
  lines.push("Subjects:");
  for (const subject of input.subjects) {
    lines.push(
      `- ${subject.subject.name}: ${percent(subject.masteryScore)} over ${String(subject.attempted)} questions`,
    );
  }

  lines.push("");
  lines.push("Strong topics:");
  lines.push(...listTopics(input.strong));
  lines.push("Topics needing practice:");
  lines.push(...listTopics(input.needsPractice));
  lines.push("Weak topics:");
  lines.push(...listTopics(input.weak));

  return lines.join("\n");
}

function listTopics(topics: AnalysisTopic[]): string[] {
  if (topics.length === 0) return ["- none"];

  return topics
    .slice(0, 6)
    .map(
      (topic) =>
        `- ${topic.name} (${topic.subjectName}): ${percent(topic.masteryScore)} over ${String(topic.attempted)} questions`,
    );
}

function percent(value: number | null): string {
  return value === null ? "not enough data" : `${String(Math.round(value * 100))}%`;
}
