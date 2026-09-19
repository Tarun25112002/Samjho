import type { BloomLevel, LearningMetric } from "@medhavi/contracts";

export interface AttemptSample {
  isCorrect: boolean | null;
  marksAwarded: number;
  marksPossible: number;
  bloomLevel: BloomLevel;
  timeSpentMs: number;
  expectedTimeSeconds: number;
  day: string;
}

export interface MetricSet {
  overallMastery: number | null;
  accuracy: number | null;
  consistency: number | null;
  problemSolving: number | null;
  conceptualUnderstanding: number | null;
  averageResponseSeconds: number | null;
  paceRatio: number | null;
  scored: number;
}

const HIGHER_ORDER: readonly BloomLevel[] = ["APPLY", "ANALYSE", "EVALUATE", "CREATE"];
const LOWER_ORDER: readonly BloomLevel[] = ["REMEMBER", "UNDERSTAND"];

const CONSISTENCY_MIN_DAYS = 2;
const MIN_SAMPLES_FOR_SPLIT = 3;

export function computeMetrics(samples: AttemptSample[]): MetricSet {
  const scored = samples.filter((sample) => sample.isCorrect !== null);

  if (scored.length === 0) {
    return {
      overallMastery: null,
      accuracy: null,
      consistency: null,
      problemSolving: null,
      conceptualUnderstanding: null,
      averageResponseSeconds: null,
      paceRatio: null,
      scored: 0,
    };
  }

  return {
    overallMastery: markRatio(scored),
    accuracy: scored.filter((sample) => sample.isCorrect === true).length / scored.length,
    consistency: consistencyOf(scored),
    problemSolving: ratioForBloom(scored, HIGHER_ORDER),
    conceptualUnderstanding: ratioForBloom(scored, LOWER_ORDER),
    averageResponseSeconds: averageResponseSeconds(scored),
    paceRatio: paceRatioOf(scored),
    scored: scored.length,
  };
}

export function toLearningMetrics(metrics: MetricSet): LearningMetric[] {
  return [
    {
      key: "OVERALL_MASTERY",
      label: "Overall mastery",
      value: metrics.overallMastery,
      basis: "Marks earned as a share of marks attempted",
    },
    {
      key: "ACCURACY",
      label: "Accuracy",
      value: metrics.accuracy,
      basis: "Questions answered fully correctly",
    },
    {
      key: "CONSISTENCY",
      label: "Consistency",
      value: metrics.consistency,
      basis: "How steady your accuracy is from one day to the next",
    },
    {
      key: "PROBLEM_SOLVING",
      label: "Problem solving",
      value: metrics.problemSolving,
      basis: "Questions that need a method applied, not just recalled",
    },
    {
      key: "CONCEPTUAL_UNDERSTANDING",
      label: "Conceptual understanding",
      value: metrics.conceptualUnderstanding,
      basis: "Questions that test whether you know the idea itself",
    },
  ];
}

function markRatio(samples: AttemptSample[]): number {
  const possible = samples.reduce((sum, sample) => sum + sample.marksPossible, 0);
  if (possible === 0) return 0;

  const earned = samples.reduce((sum, sample) => sum + sample.marksAwarded, 0);
  return clamp01(earned / possible);
}

function ratioForBloom(samples: AttemptSample[], levels: readonly BloomLevel[]): number | null {
  const subset = samples.filter((sample) => levels.includes(sample.bloomLevel));
  if (subset.length < MIN_SAMPLES_FOR_SPLIT) return null;
  return markRatio(subset);
}

function consistencyOf(samples: AttemptSample[]): number | null {
  const byDay = new Map<string, { correct: number; total: number }>();

  for (const sample of samples) {
    const entry = byDay.get(sample.day) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (sample.isCorrect === true) entry.correct += 1;
    byDay.set(sample.day, entry);
  }

  if (byDay.size < CONSISTENCY_MIN_DAYS) return null;

  const rates = [...byDay.values()].map((entry) => entry.correct / entry.total);
  const mean = rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
  const variance = rates.reduce((sum, rate) => sum + (rate - mean) ** 2, 0) / rates.length;

  return clamp01(1 - Math.sqrt(variance) * 2);
}

function averageResponseSeconds(samples: AttemptSample[]): number | null {
  const timed = samples.filter((sample) => sample.timeSpentMs > 0);
  if (timed.length === 0) return null;

  const total = timed.reduce((sum, sample) => sum + sample.timeSpentMs, 0);
  return Math.round(total / timed.length / 1000);
}

function paceRatioOf(samples: AttemptSample[]): number | null {
  const timed = samples.filter(
    (sample) => sample.timeSpentMs > 0 && sample.expectedTimeSeconds > 0,
  );
  if (timed.length === 0) return null;

  const spent = timed.reduce((sum, sample) => sum + sample.timeSpentMs, 0);
  const expected = timed.reduce((sum, sample) => sum + sample.expectedTimeSeconds * 1000, 0);
  if (expected === 0) return null;

  return round2(spent / expected);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
