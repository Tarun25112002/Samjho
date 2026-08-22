import type { QuestionType, StudentAnswer } from "@samjho/contracts";
import { describe, expect, it } from "vitest";

import {
  gradeAnswer,
  normaliseMatchPairs,
  normaliseText,
  parseNumber,
  selfEvaluatedGrade,
  type GradableUnit,
} from "./grading.js";

/**
 * The grader, exercised without a database.
 *
 * These are the tests that decide whether a student trusts the app. Almost every
 * case below is a real thing a fifteen-year-old types — the unit written out,
 * the digits grouped the Indian way, the pairs listed in the order they worked
 * them out rather than the order the key lists them. Each one is a mark that
 * would have been wrongly refused.
 */

function unit(overrides: Partial<GradableUnit> & { type: QuestionType }): GradableUnit {
  return {
    id: "q1",
    marks: 1,
    options: [],
    answer: null,
    ...overrides,
  };
}

function answer(overrides: Partial<StudentAnswer> = {}): StudentAnswer {
  return { optionIds: [], text: "", ...overrides };
}

function key(overrides: Partial<NonNullable<GradableUnit["answer"]>> = {}) {
  return { correctValue: null, acceptedValues: [], tolerance: null, unit: null, ...overrides };
}

describe("multiple choice", () => {
  const mcq = unit({
    type: "MCQ",
    marks: 1,
    options: [
      { id: "opt-a", label: "A", isCorrect: false },
      { id: "opt-b", label: "B", isCorrect: true },
      { id: "opt-c", label: "C", isCorrect: false },
    ],
  });

  it("awards the marks for the flagged option", () => {
    expect(gradeAnswer(mcq, answer({ optionIds: ["opt-b"] }))).toEqual({
      isCorrect: true,
      marksAwarded: 1,
      evaluationMode: "AUTO",
    });
  });

  it("scores a wrong option zero rather than leaving it unscored", () => {
    expect(gradeAnswer(mcq, answer({ optionIds: ["opt-a"] }))).toEqual({
      isCorrect: false,
      marksAwarded: 0,
      evaluationMode: "AUTO",
    });
  });

  it("counts a blank answer as wrong, not as unanswered", () => {
    // Submitting nothing is a decision a student is allowed to make, and the
    // solution they get afterwards is the point of making it.
    expect(gradeAnswer(mcq, answer()).isCorrect).toBe(false);
  });

  it("does not accept the right option plus a wrong one", () => {
    expect(gradeAnswer(mcq, answer({ optionIds: ["opt-a", "opt-b"] })).isCorrect).toBe(false);
  });

  it("falls back to the option label when only the seed's correctValue exists", () => {
    // Seeded content predates Phase 4's rule that the tick on the option *is*
    // the key, and writes the letter as well. Reading it is legacy support.
    const seeded = unit({
      type: "MCQ",
      options: [
        { id: "opt-a", label: "A", isCorrect: false },
        { id: "opt-b", label: "B", isCorrect: false },
      ],
      answer: key({ correctValue: "B" }),
    });

    expect(gradeAnswer(seeded, answer({ optionIds: ["opt-b"] })).isCorrect).toBe(true);
  });

  it("leaves a question with no key at all unscored rather than wrong", () => {
    const broken = unit({
      type: "MCQ",
      options: [{ id: "opt-a", label: "A", isCorrect: false }],
    });

    expect(gradeAnswer(broken, answer({ optionIds: ["opt-a"] }))).toEqual({
      isCorrect: null,
      marksAwarded: 0,
      evaluationMode: "PENDING",
    });
  });
});

describe("numerical", () => {
  const numerical = unit({
    type: "NUMERICAL",
    marks: 3,
    answer: key({ correctValue: "8", unit: "A" }),
  });

  it.each([
    ["8", "the bare number"],
    ["8 A", "the unit written out"],
    ["8A", "the unit with no space"],
    ["8.0", "a trailing zero"],
    [" 8 ", "surrounding whitespace"],
    ["+8", "an explicit sign"],
  ])("accepts %j — %s", (text) => {
    expect(gradeAnswer(numerical, answer({ text })).isCorrect).toBe(true);
  });

  it("accepts Indian digit grouping", () => {
    const large = unit({ type: "NUMERICAL", answer: key({ correctValue: "100000" }) });
    expect(gradeAnswer(large, answer({ text: "1,00,000" })).isCorrect).toBe(true);
  });

  it("respects the author's tolerance and nothing wider", () => {
    const tolerant = unit({
      type: "NUMERICAL",
      answer: key({ correctValue: "9.8", tolerance: 0.2 }),
    });

    expect(gradeAnswer(tolerant, answer({ text: "9.61" })).isCorrect).toBe(true);
    expect(gradeAnswer(tolerant, answer({ text: "9.5" })).isCorrect).toBe(false);
  });

  it("does not let binary floating point cost a mark", () => {
    // 0.1 + 0.2 is 0.30000000000000004. A student who typed the exactly right
    // decimal must not be the one who pays for that.
    const exact = unit({ type: "NUMERICAL", answer: key({ correctValue: "0.3" }) });
    expect(gradeAnswer(exact, answer({ text: String(0.1 + 0.2) })).isCorrect).toBe(true);
  });

  it("accepts any of the author's alternative values", () => {
    const fractions = unit({
      type: "NUMERICAL",
      answer: key({ correctValue: "0.5", acceptedValues: ["0.50", "0.500"] }),
    });

    expect(gradeAnswer(fractions, answer({ text: "0.500" })).isCorrect).toBe(true);
  });

  it("marks text with no number in it wrong", () => {
    expect(gradeAnswer(numerical, answer({ text: "I don't know" })).isCorrect).toBe(false);
  });

  it("compares as text when the key is not a number", () => {
    const symbolic = unit({
      type: "NUMERICAL",
      answer: key({ correctValue: "3.4 × 10⁵ J" }),
    });

    expect(gradeAnswer(symbolic, answer({ text: "3.4 × 10⁵ J" })).isCorrect).toBe(true);
  });
});

describe("true/false and fill in the blank", () => {
  it("grades true/false against the stored word", () => {
    const trueFalse = unit({ type: "TRUE_FALSE", answer: key({ correctValue: "TRUE" }) });

    expect(gradeAnswer(trueFalse, answer({ text: "TRUE" })).isCorrect).toBe(true);
    expect(gradeAnswer(trueFalse, answer({ text: "FALSE" })).isCorrect).toBe(false);
  });

  it("forgives case and a trailing full stop in a blank", () => {
    const blank = unit({
      type: "FILL_BLANK",
      answer: key({ correctValue: "sodium chloride" }),
    });

    expect(gradeAnswer(blank, answer({ text: "Sodium Chloride." })).isCorrect).toBe(true);
  });

  it("accepts the author's listed alternatives", () => {
    const blank = unit({
      type: "FILL_BLANK",
      answer: key({ correctValue: "sodium chloride", acceptedValues: ["common salt", "NaCl"] }),
    });

    expect(gradeAnswer(blank, answer({ text: "nacl" })).isCorrect).toBe(true);
  });

  it("does not accept a different word", () => {
    const blank = unit({ type: "FILL_BLANK", answer: key({ correctValue: "sodium chloride" }) });
    expect(gradeAnswer(blank, answer({ text: "sodium chlorate" })).isCorrect).toBe(false);
  });
});

describe("match the following", () => {
  const match = unit({
    type: "MATCH_FOLLOWING",
    marks: 2,
    answer: key({ correctValue: "i-q, ii-r, iii-s, iv-p" }),
  });

  it.each([
    ["i-q, ii-r, iii-s, iv-p", "exactly as the key is written"],
    ["iii-s, i-q, iv-p, ii-r", "in the order they worked them out"],
    ["I-Q; II-R; III-S; IV-P", "with semicolons and capitals"],
    ["i - q, ii - r, iii - s, iv - p", "with spaces around the dashes"],
    ["i→q, ii→r, iii→s, iv→p", "with arrows instead of dashes"],
  ])("accepts %j — %s", (text) => {
    expect(gradeAnswer(match, answer({ text })).isCorrect).toBe(true);
  });

  it("rejects a set with one pair swapped", () => {
    expect(gradeAnswer(match, answer({ text: "i-r, ii-q, iii-s, iv-p" })).isCorrect).toBe(false);
  });

  it("rejects an incomplete set", () => {
    expect(gradeAnswer(match, answer({ text: "i-q, ii-r" })).isCorrect).toBe(false);
  });
});

describe("subjective types", () => {
  it.each(["VERY_SHORT_ANSWER", "SHORT_ANSWER", "LONG_ANSWER"] as const)(
    "leaves %s for the student to score",
    (type) => {
      const subjective = unit({
        type,
        marks: 5,
        answer: key({ correctValue: "a full derivation" }),
      });

      expect(gradeAnswer(subjective, answer({ text: "a full derivation" }))).toEqual({
        isCorrect: null,
        marksAwarded: 0,
        evaluationMode: "PENDING",
      });
    },
  );

  it("does not auto-grade a very short answer even when the author supplied a value", () => {
    // `correctValue` is optional-but-allowed on VERY_SHORT_ANSWER, and string
    // matching a one-line written answer is exactly the fragile grading this
    // product refuses to do (docs/07 R3).
    const vsa = unit({ type: "VERY_SHORT_ANSWER", answer: key({ correctValue: "2" }) });
    expect(gradeAnswer(vsa, answer({ text: "two" })).evaluationMode).toBe("PENDING");
  });

  it("scores a container as pending — its marks live in its sub-parts", () => {
    expect(gradeAnswer(unit({ type: "CASE_BASED", marks: 4 }), answer()).evaluationMode).toBe(
      "PENDING",
    );
  });
});

describe("self-evaluation", () => {
  it("calls full marks correct and anything less incorrect", () => {
    expect(selfEvaluatedGrade(3, 3)).toEqual({
      isCorrect: true,
      marksAwarded: 3,
      evaluationMode: "SELF",
    });

    // Partial credit is recorded honestly and still counts as a mistake: a
    // half-understood derivation is exactly what the mistake list is for.
    expect(selfEvaluatedGrade(2, 3)).toEqual({
      isCorrect: false,
      marksAwarded: 2,
      evaluationMode: "SELF",
    });
  });

  it("clamps a student who awards themselves more than the question is worth", () => {
    expect(selfEvaluatedGrade(9, 3).marksAwarded).toBe(3);
    expect(selfEvaluatedGrade(-1, 3).marksAwarded).toBe(0);
  });
});

describe("normalisation helpers", () => {
  it("folds the characters a phone keyboard substitutes", () => {
    expect(normaliseText("Boyle’s  Law.")).toBe("boyle's law");
    expect(normaliseText("1–2")).toBe("1-2");
  });

  it("sorts match pairs so order cannot decide a mark", () => {
    expect(normaliseMatchPairs("ii-r, i-q")).toBe(normaliseMatchPairs("i-q, ii-r"));
  });

  it("reads a number out of what a student typed", () => {
    expect(parseNumber("8 A", "A")).toBe(8);
    expect(parseNumber("1,00,000", null)).toBe(100_000);
    expect(parseNumber("6.02e23", null)).toBe(6.02e23);
    expect(parseNumber("no idea", null)).toBeNull();
  });
});
