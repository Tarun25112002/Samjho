import { describe, expect, it } from "vitest";

import { computeMetrics, toLearningMetrics, type AttemptSample } from "./analysis.metrics.js";

function sample(overrides: Partial<AttemptSample> = {}): AttemptSample {
  return {
    isCorrect: true,
    marksAwarded: 1,
    marksPossible: 1,
    bloomLevel: "UNDERSTAND",
    timeSpentMs: 60_000,
    expectedTimeSeconds: 60,
    day: "2026-09-01",
    ...overrides,
  };
}

function wrong(overrides: Partial<AttemptSample> = {}): AttemptSample {
  return sample({ isCorrect: false, marksAwarded: 0, ...overrides });
}

describe("with nothing to measure", () => {
  it("returns nulls rather than zeroes", () => {
    const metrics = computeMetrics([]);

    expect(metrics.overallMastery).toBeNull();
    expect(metrics.accuracy).toBeNull();
    expect(metrics.consistency).toBeNull();
    expect(metrics.scored).toBe(0);
  });

  it("ignores attempts still waiting to be scored", () => {
    const metrics = computeMetrics([sample({ isCorrect: null, marksAwarded: 0 })]);
    expect(metrics.scored).toBe(0);
    expect(metrics.accuracy).toBeNull();
  });

  it("labels every metric even when its value is unknown", () => {
    const labelled = toLearningMetrics(computeMetrics([]));

    expect(labelled).toHaveLength(5);
    expect(labelled.every((metric) => metric.label.length > 0)).toBe(true);
    expect(labelled.every((metric) => metric.basis.length > 0)).toBe(true);
    expect(labelled.every((metric) => metric.value === null)).toBe(true);
  });
});

describe("mastery and accuracy", () => {
  it("weights mastery by marks rather than by question count", () => {
    const metrics = computeMetrics([
      sample({ marksAwarded: 5, marksPossible: 5 }),
      wrong({ marksPossible: 1 }),
    ]);

    expect(metrics.overallMastery).toBeCloseTo(5 / 6);
    expect(metrics.accuracy).toBeCloseTo(0.5);
  });

  it("counts a partly-scored answer in mastery but not in accuracy", () => {
    const metrics = computeMetrics([wrong({ marksAwarded: 2, marksPossible: 4 })]);

    expect(metrics.overallMastery).toBeCloseTo(0.5);
    expect(metrics.accuracy).toBe(0);
  });
});

describe("consistency", () => {
  it("is unknown from a single day", () => {
    expect(computeMetrics([sample(), sample(), wrong()]).consistency).toBeNull();
  });

  it("is high when the student scores the same every day", () => {
    const metrics = computeMetrics([
      sample({ day: "2026-09-01" }),
      wrong({ day: "2026-09-01" }),
      sample({ day: "2026-09-02" }),
      wrong({ day: "2026-09-02" }),
    ]);

    expect(metrics.consistency).toBe(1);
  });

  it("is low when the student swings between days", () => {
    const metrics = computeMetrics([
      sample({ day: "2026-09-01" }),
      sample({ day: "2026-09-01" }),
      wrong({ day: "2026-09-02" }),
      wrong({ day: "2026-09-02" }),
    ]);

    expect(metrics.consistency).toBe(0);
  });
});

describe("the two kinds of knowing", () => {
  it("separates applying a method from recalling an idea", () => {
    const metrics = computeMetrics([
      sample({ bloomLevel: "REMEMBER" }),
      sample({ bloomLevel: "UNDERSTAND" }),
      sample({ bloomLevel: "UNDERSTAND" }),
      wrong({ bloomLevel: "APPLY" }),
      wrong({ bloomLevel: "APPLY" }),
      wrong({ bloomLevel: "ANALYSE" }),
    ]);

    expect(metrics.conceptualUnderstanding).toBe(1);
    expect(metrics.problemSolving).toBe(0);
  });

  it("stays unknown rather than guessing from one or two questions", () => {
    const metrics = computeMetrics([
      sample({ bloomLevel: "APPLY" }),
      sample({ bloomLevel: "REMEMBER" }),
    ]);

    expect(metrics.problemSolving).toBeNull();
    expect(metrics.conceptualUnderstanding).toBeNull();
  });
});

describe("pace", () => {
  it("reports the average in seconds and the ratio against expected time", () => {
    const metrics = computeMetrics([
      sample({ timeSpentMs: 90_000, expectedTimeSeconds: 60 }),
      sample({ timeSpentMs: 30_000, expectedTimeSeconds: 60 }),
    ]);

    expect(metrics.averageResponseSeconds).toBe(60);
    expect(metrics.paceRatio).toBe(1);
  });

  it("shows a ratio above one when the student is slower than expected", () => {
    const metrics = computeMetrics([sample({ timeSpentMs: 120_000, expectedTimeSeconds: 60 })]);
    expect(metrics.paceRatio).toBe(2);
  });

  it("is unknown when no time was recorded", () => {
    const metrics = computeMetrics([sample({ timeSpentMs: 0 })]);

    expect(metrics.averageResponseSeconds).toBeNull();
    expect(metrics.paceRatio).toBeNull();
  });
});
