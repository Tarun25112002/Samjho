import { describe, expect, it } from "vitest";

import {
  blendSequence,
  chooseTopic,
  clampLevel,
  diagnosticLevelAt,
  levelForMastery,
  levelForPick,
  levelsToDifficulties,
  nextLevelAfter,
  nextStreak,
  pickNext,
  planBlend,
  type AnsweredOutcome,
  type TopicMasteryState,
} from "./practice.adaptive.js";

function state(
  topicId: string,
  masteryScore: number,
  overrides: Partial<TopicMasteryState> = {},
): TopicMasteryState {
  return {
    topicId,
    topicName: topicId,
    subjectId: "subject-1",
    masteryScore,
    attempted: 5,
    unrepairedMistakes: 0,
    ...overrides,
  };
}

function outcome(overrides: Partial<AnsweredOutcome> = {}): AnsweredOutcome {
  return {
    topicId: "algebra",
    targetLevel: 3,
    isCorrect: true,
    hintUsed: false,
    paceRatio: 1,
    ...overrides,
  };
}

describe("difficulty levels", () => {
  it("clamps to the 1-5 band", () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(9)).toBe(5);
    expect(clampLevel(3.4)).toBe(3);
  });

  it("maps mastery across the whole band", () => {
    expect(levelForMastery(0)).toBe(1);
    expect(levelForMastery(0.5)).toBe(3);
    expect(levelForMastery(1)).toBe(5);
  });

  it("prefers the matching stored difficulty and keeps a fallback", () => {
    expect(levelsToDifficulties(1)[0]).toBe("EASY");
    expect(levelsToDifficulties(3)[0]).toBe("MEDIUM");
    expect(levelsToDifficulties(5)[0]).toBe("HARD");
    expect(levelsToDifficulties(3).length).toBeGreaterThan(1);
  });
});

describe("moving the difficulty after an answer", () => {
  it("raises it when an easy question is answered correctly", () => {
    expect(nextLevelAfter(1, outcome({ targetLevel: 1 }), 1)).toBe(2);
  });

  it("raises it further on a run of correct answers", () => {
    expect(nextLevelAfter(2, outcome({ targetLevel: 2 }), 3)).toBe(4);
  });

  it("lowers it when a hard question is answered wrongly", () => {
    expect(nextLevelAfter(5, outcome({ targetLevel: 5, isCorrect: false }), -1)).toBe(4);
  });

  it("drops two levels once the student is wrong repeatedly", () => {
    expect(nextLevelAfter(4, outcome({ targetLevel: 4, isCorrect: false }), -2)).toBe(2);
  });

  it("holds level when the answer needed a hint", () => {
    expect(nextLevelAfter(3, outcome({ hintUsed: true }), 1)).toBe(3);
  });

  it("holds level when the student was correct but far over time", () => {
    expect(nextLevelAfter(3, outcome({ paceRatio: 2.5 }), 1)).toBe(3);
  });

  it("never leaves the band", () => {
    expect(nextLevelAfter(5, outcome({ targetLevel: 5 }), 5)).toBe(5);
    expect(nextLevelAfter(1, outcome({ isCorrect: false }), -5)).toBe(1);
  });
});

describe("streaks", () => {
  it("counts consecutive correct answers and resets on a miss", () => {
    let streak = 0;
    streak = nextStreak(streak, true);
    streak = nextStreak(streak, true);
    expect(streak).toBe(2);

    streak = nextStreak(streak, false);
    expect(streak).toBe(-1);

    streak = nextStreak(streak, false);
    expect(streak).toBe(-2);
  });
});

describe("the diagnostic ladder", () => {
  it("keeps the fundamentals paper easy", () => {
    const levels = Array.from({ length: 10 }, (_, index) =>
      diagnosticLevelAt("DIAGNOSTIC_FUNDAMENTALS", index),
    );
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
  });

  it("raises the floor on each successive diagnostic", () => {
    const mean = (objective: Parameters<typeof diagnosticLevelAt>[0]) =>
      Array.from({ length: 10 }, (_, index) => diagnosticLevelAt(objective, index)).reduce(
        (sum, level) => sum + level,
        0,
      ) / 10;

    expect(mean("DIAGNOSTIC_FUNDAMENTALS")).toBeLessThan(mean("DIAGNOSTIC_APPLICATION"));
    expect(mean("DIAGNOSTIC_APPLICATION")).toBeLessThan(mean("DIAGNOSTIC_CHALLENGE"));
  });

  it("does not depend on the student, so three sittings stay comparable", () => {
    expect(diagnosticLevelAt("DIAGNOSTIC_APPLICATION", 4)).toBe(
      diagnosticLevelAt("DIAGNOSTIC_APPLICATION", 4),
    );
  });
});

describe("the personalised blend", () => {
  it("splits ten questions four-three-two-one", () => {
    expect(planBlend(10)).toEqual([
      { reason: "WEAK_AREA", count: 4 },
      { reason: "REINFORCEMENT", count: 3 },
      { reason: "CURRENT_LEVEL", count: 2 },
      { reason: "CHALLENGE", count: 1 },
    ]);
  });

  it("always assigns exactly the requested number", () => {
    for (const count of [5, 7, 10, 13, 25]) {
      const total = planBlend(count).reduce((sum, entry) => sum + entry.count, 0);
      expect(total).toBe(count);
    }
  });

  it("opens at the student's current level rather than on a weak area", () => {
    expect(blendSequence(10)[0]).toBe("CURRENT_LEVEL");
  });

  it("produces a sequence matching the blend's counts", () => {
    const sequence = blendSequence(10);
    expect(sequence).toHaveLength(10);
    expect(sequence.filter((reason) => reason === "WEAK_AREA")).toHaveLength(4);
    expect(sequence.filter((reason) => reason === "CHALLENGE")).toHaveLength(1);
  });
});

describe("choosing a topic", () => {
  const states = [
    state("probability", 0.38),
    state("trigonometry", 0.54),
    state("quadratics", 0.61),
    state("linear-equations", 0.91),
    state("statistics", 0, { attempted: 0 }),
  ];

  it("sends a weak-area slot to the lowest mastery", () => {
    expect(chooseTopic(states, "WEAK_AREA", new Set())?.topicId).toBe("probability");
  });

  it("sends a challenge slot to the strongest topic", () => {
    expect(chooseTopic(states, "CHALLENGE", new Set())?.topicId).toBe("linear-equations");
  });

  it("sends a coverage slot to a topic never attempted", () => {
    expect(chooseTopic(states, "COVERAGE", new Set())?.topicId).toBe("statistics");
  });

  it("skips topics already served in this sitting", () => {
    const picked = chooseTopic(states, "WEAK_AREA", new Set(["probability"]));
    expect(picked?.topicId).toBe("trigonometry");
  });

  it("breaks mastery ties towards the topic with more open mistakes", () => {
    const tied = [
      state("a", 0.5, { unrepairedMistakes: 1 }),
      state("b", 0.5, { unrepairedMistakes: 6 }),
    ];
    expect(chooseTopic(tied, "WEAK_AREA", new Set())?.topicId).toBe("b");
  });

  it("returns nothing when every topic is excluded", () => {
    expect(chooseTopic(states, "WEAK_AREA", new Set(states.map((s) => s.topicId)))).toBeNull();
  });
});

describe("the level a slot aims at", () => {
  it("drops below the estimate on a weak area, so the student can get in", () => {
    expect(levelForPick("WEAK_AREA", 0.5)).toBe(2);
  });

  it("goes above the estimate on a challenge", () => {
    expect(levelForPick("CHALLENGE", 0.5)).toBe(4);
  });

  it("sits at the estimate at the current level", () => {
    expect(levelForPick("CURRENT_LEVEL", 0.75)).toBe(4);
  });

  it("opens mid-band for a topic with no history", () => {
    expect(levelForPick("CURRENT_LEVEL", null)).toBe(3);
  });
});

describe("pickNext", () => {
  const states = [
    state("probability", 0.3),
    state("trigonometry", 0.55),
    state("algebra", 0.85),
    state("circles", 0, { attempted: 0 }),
  ];

  it("walks the ladder and ignores mastery on a diagnostic", () => {
    const pick = pickNext({
      objective: "DIAGNOSTIC_FUNDAMENTALS",
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(pick.reason).toBe("DIAGNOSTIC_LADDER");
    expect(pick.targetLevel).toBe(diagnosticLevelAt("DIAGNOSTIC_FUNDAMENTALS", 0));
  });

  it("spreads a diagnostic across topics rather than drilling one", () => {
    const first = pickNext({
      objective: "DIAGNOSTIC_APPLICATION",
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });
    const second = pickNext({
      objective: "DIAGNOSTIC_APPLICATION",
      index: 1,
      states,
      history: [],
      servedTopicIds: new Set([first.topicId ?? ""]),
      count: 10,
    });

    expect(second.topicId).not.toBe(first.topicId);
  });

  it("aims a weak-area slot at the weakest topic", () => {
    const pick = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 1,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(pick.reason).toBe("WEAK_AREA");
    expect(pick.topicId).toBe("probability");
    expect(pick.masteryAtPick).toBeCloseTo(0.3);
  });

  it("raises the aim after the student answers correctly on pace", () => {
    const base = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    const afterSuccess = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [outcome({ topicId: base.topicId, targetLevel: base.targetLevel })],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(afterSuccess.targetLevel).toBeGreaterThan(base.targetLevel);
  });

  it("lowers the aim after the student answers wrongly", () => {
    const base = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    const afterMiss = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [
        outcome({ topicId: base.topicId, targetLevel: base.targetLevel, isCorrect: false }),
      ],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(afterMiss.targetLevel).toBeLessThan(base.targetLevel);
  });

  it("does not raise the aim when the correct answer needed a hint", () => {
    const base = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    const afterHint = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states,
      history: [outcome({ topicId: base.topicId, targetLevel: base.targetLevel, hintUsed: true })],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(afterHint.targetLevel).toBe(base.targetLevel);
  });

  it("falls back to the current level when the blend runs past its sequence", () => {
    const pick = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 99,
      states,
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(pick.reason).toBe("CURRENT_LEVEL");
  });

  it("survives a student with no mastery rows at all", () => {
    const pick = pickNext({
      objective: "ADAPTIVE_PERSONALISED",
      index: 0,
      states: [],
      history: [],
      servedTopicIds: new Set(),
      count: 10,
    });

    expect(pick.topicId).toBeNull();
    expect(pick.masteryAtPick).toBeNull();
    expect(pick.targetLevel).toBe(3);
  });
});
