import { describe, expect, it } from "vitest";

import {
  canTransitionQuestionStatus,
  publicationBlockers,
  QUESTION_TYPE_RULES,
  subPartInputSchema,
  writeQuestionInputSchema,
  type WriteQuestionInput,
} from "./admin.schema.js";
import { questionTypeSchema, type QuestionType } from "./question-enums.js";

/**
 * These rules are the difference between a question bank and a pile of rows.
 *
 * Tested here rather than only through the API because they are pure functions
 * over a document, and because the same code path serves three doors — the admin
 * form, bulk import and a direct API call. A rule proven once at this level is
 * proven for all three; proving it through HTTP would mean three suites.
 *
 * Every assertion below names the content mistake it catches. That is the point:
 * these are not schema shapes, they are the transcription errors that happen
 * when somebody enters their four-hundredth question at eleven at night.
 */

const SOURCE = { sourceType: "ORIGINAL" as const };

function issuePaths(result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join("."));
}

/** A minimal valid question of the given type, to be broken one field at a time. */
function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    chapterId: "chapter_1",
    topicIds: ["topic_1"],
    type: "SHORT_ANSWER",
    body: "Explain why the sky appears blue during the day.",
    marks: 2,
    source: SOURCE,
    answer: { solution: "Because shorter wavelengths scatter more (Rayleigh scattering)." },
    ...overrides,
  };
}

describe("question type rules", () => {
  it("covers every question type in the enum", () => {
    // A type added to the enum without a rule would otherwise fall through to
    // `undefined` at runtime and validate nothing at all.
    for (const type of questionTypeSchema.options) {
      expect(QUESTION_TYPE_RULES[type], type).toBeDefined();
    }
  });

  describe("MCQ", () => {
    const mcq = (options: { label: string; body: string; isCorrect?: boolean }[]) =>
      base({
        type: "MCQ",
        marks: 1,
        body: "Which of these is a prime number greater than 20?",
        options,
        answer: { solution: "23 is prime; 21, 22 and 24 are not." },
      });

    const FOUR = [
      { label: "A", body: "21" },
      { label: "B", body: "22" },
      { label: "C", body: "23", isCorrect: true },
      { label: "D", body: "24" },
    ];

    it("accepts four options with exactly one marked correct", () => {
      expect(writeQuestionInputSchema.safeParse(mcq(FOUR)).success).toBe(true);
    });

    it("rejects an MCQ with no correct option — the commonest entry slip of all", () => {
      const result = writeQuestionInputSchema.safeParse(
        mcq(FOUR.map((option) => ({ ...option, isCorrect: false }))),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("options");
      expect(JSON.stringify(result.error?.issues)).toContain("exactly one");
    });

    it("rejects two correct options", () => {
      const twoRight = FOUR.map((option) => ({ ...option, isCorrect: option.label !== "A" }));
      const result = writeQuestionInputSchema.safeParse(mcq(twoRight));

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("3 are marked");
    });

    it("rejects duplicate option labels, which silently collide on the unique index", () => {
      const duplicated = [...FOUR.slice(0, 3), { label: "C", body: "24" }];
      const result = writeQuestionInputSchema.safeParse(mcq(duplicated));

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("each be different");
    });

    it("rejects a correctValue alongside the options, so the key cannot be stored twice", () => {
      // Two copies of the same fact eventually disagree, and the disagreement is
      // silent: the question still renders, and only the grading is wrong.
      const result = writeQuestionInputSchema.safeParse({
        ...mcq(FOUR),
        answer: { solution: "23 is prime.", correctValue: "C" },
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.correctValue");
    });
  });

  describe("ASSERTION_REASON", () => {
    const AR_BODY =
      "**Assertion (A):** Water expands on freezing.\n\n**Reason (R):** Ice is less dense than liquid water.";

    const arOptions = (correct: string) =>
      ["A", "B", "C", "D"].map((label) => ({
        label,
        body: `stem ${label}`,
        isCorrect: label === correct,
      }));

    it("accepts the standard four-option format", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "ASSERTION_REASON",
          marks: 1,
          body: AR_BODY,
          options: arOptions("A"),
          answer: { solution: "Both are true and R explains A." },
        }),
      );

      expect(result.success).toBe(true);
    });

    it("rejects three options — CBSE's assertion-reason format is fixed at four", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "ASSERTION_REASON",
          marks: 1,
          body: AR_BODY,
          options: arOptions("A").slice(0, 3),
          answer: { solution: "Both are true and R explains A." },
        }),
      );

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("exactly 4");
    });

    it("rejects a body that never states an assertion and a reason", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "ASSERTION_REASON",
          marks: 1,
          body: "Water expands on freezing because ice is less dense.",
          options: arOptions("A"),
          answer: { solution: "Both are true." },
        }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("body");
    });
  });

  describe("types that take no options", () => {
    it.each(["TRUE_FALSE", "NUMERICAL", "SHORT_ANSWER", "CASE_BASED"] as QuestionType[])(
      "rejects options on a %s question",
      (type) => {
        const result = writeQuestionInputSchema.safeParse(
          base({
            type,
            body:
              type === "TRUE_FALSE"
                ? "State whether the following is true or false: arteries carry blood away from the heart."
                : "Calculate the resistance of the circuit shown in the diagram.",
            options: [{ label: "A", body: "yes", isCorrect: true }],
          }),
        );

        expect(result.success).toBe(false);
        expect(issuePaths(result)).toContain("options");
      },
    );
  });

  describe("TRUE_FALSE", () => {
    const tf = (correctValue: string | undefined) =>
      base({
        type: "TRUE_FALSE",
        marks: 1,
        body: "State whether the following is true or false: arteries carry blood away from the heart.",
        answer: {
          solution: "True — arteries always carry blood away from the heart.",
          correctValue,
        },
      });

    it("accepts TRUE and FALSE in any casing", () => {
      expect(writeQuestionInputSchema.safeParse(tf("TRUE")).success).toBe(true);
      expect(writeQuestionInputSchema.safeParse(tf("false")).success).toBe(true);
    });

    it("rejects anything else, so the grader never compares against 'Yes'", () => {
      const result = writeQuestionInputSchema.safeParse(tf("Yes"));
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.correctValue");
    });

    it("rejects a missing answer", () => {
      const result = writeQuestionInputSchema.safeParse(tf(undefined));
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.correctValue");
    });
  });

  describe("NUMERICAL", () => {
    const numerical = (answer: Record<string, unknown>) =>
      base({
        type: "NUMERICAL",
        marks: 2,
        body: "A body falls freely for 3 s. Calculate the distance covered. Take g = 9.8 m/s².",
        answer: { solution: "s = ½gt² = 44.1 m.", ...answer },
      });

    it("requires a tolerance, because without one 9.80 is marked wrong against 9.8", () => {
      const result = writeQuestionInputSchema.safeParse(numerical({ correctValue: "44.1" }));

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.tolerance");
    });

    it("accepts a deliberate tolerance of zero", () => {
      const result = writeQuestionInputSchema.safeParse(
        numerical({ correctValue: "44.1", tolerance: 0 }),
      );

      expect(result.success).toBe(true);
    });

    it("rejects a non-numeric answer with the unit typed into it", () => {
      const result = writeQuestionInputSchema.safeParse(
        numerical({ correctValue: "44.1 m", tolerance: 0.1 }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.correctValue");
    });
  });

  describe("body shape checks", () => {
    it("rejects a fill-in-the-blank with no blank in it", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "FILL_BLANK",
          marks: 1,
          body: "The sum of the first n terms of an AP is given by the formula.",
          answer: { solution: "S = n/2[2a+(n-1)d]", correctValue: "n/2[2a+(n-1)d]" },
        }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("body");
    });

    it("accepts one written with underscores", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "FILL_BLANK",
          marks: 1,
          body: "The sum of the first $n$ terms of an AP is $S_n = $ ________.",
          answer: { solution: "S = n/2[2a+(n-1)d]", correctValue: "n/2[2a+(n-1)d]" },
        }),
      );

      expect(result.success).toBe(true);
    });

    it("rejects match-the-following written as prose instead of a table", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "MATCH_FOLLOWING",
          marks: 1,
          body: "Match insulin with pancreas and thyroxine with thyroid gland.",
          answer: { solution: "i-s, ii-p", correctValue: "i-s, ii-p" },
        }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("body");
    });
  });

  describe("marking schemes", () => {
    it("requires one on a written answer worth three marks or more", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "LONG_ANSWER",
          marks: 5,
          body: "Describe the process of double fertilisation in flowering plants.",
          answer: { solution: "One male gamete fuses with the egg; the other with polar nuclei." },
        }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer.markingScheme");
    });

    it("does not require one on a two-mark answer", () => {
      expect(writeQuestionInputSchema.safeParse(base()).success).toBe(true);
    });

    it("does not require one on an auto-graded question, however many marks", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "NUMERICAL",
          marks: 3,
          body: "Find the 10th term of the AP 2, 7, 12, …",
          answer: { solution: "a + 9d = 2 + 45 = 47.", correctValue: "47", tolerance: 0 },
        }),
      );

      expect(result.success).toBe(true);
    });

    it("rejects steps that do not add up to the question's marks", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "LONG_ANSWER",
          marks: 5,
          body: "Describe the process of double fertilisation in flowering plants.",
          answer: {
            solution: "One male gamete fuses with the egg; the other with polar nuclei.",
            markingScheme: [
              { step: "Pollen tube reaches the ovule", marks: 2 },
              { step: "Syngamy", marks: 2 },
            ],
          },
        }),
      );

      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).toContain("add up to 4 marks");
    });

    it("accepts half marks that sum exactly, despite binary floating point", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          type: "LONG_ANSWER",
          marks: 3,
          body: "Describe the process of double fertilisation in flowering plants.",
          answer: {
            solution: "One male gamete fuses with the egg; the other with polar nuclei.",
            markingScheme: [
              { step: "Pollen tube reaches the ovule", marks: 0.5 },
              { step: "Syngamy", marks: 0.5 },
              { step: "Triple fusion", marks: 0.5 },
              { step: "Endosperm forms", marks: 1.5 },
            ],
          },
        }),
      );

      expect(result.success).toBe(true);
    });
  });

  describe("case studies", () => {
    const part = (marks: number, index: number) => ({
      type: "VERY_SHORT_ANSWER",
      body: `Sub-part ${index}: state the value asked for in the table above.`,
      marks,
      answer: { solution: `The answer to sub-part ${index}.` },
    });

    const caseStudy = (marks: number, parts: unknown[]) =>
      base({
        type: "CASE_BASED",
        marks,
        body: "Read the following passage about the electricity bill of a household and answer the questions that follow.",
        answer: null,
        subParts: parts,
      });

    it("accepts a 1+1+2 case study marked as 4", () => {
      const result = writeQuestionInputSchema.safeParse(
        caseStudy(4, [part(1, 1), part(1, 2), part(2, 3)]),
      );

      expect(result.success).toBe(true);
    });

    it("rejects sub-parts whose marks do not add up to the container's", () => {
      const result = writeQuestionInputSchema.safeParse(
        caseStudy(4, [part(1, 1), part(1, 2), part(1, 3)]),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("marks");
      expect(JSON.stringify(result.error?.issues)).toContain("add up to 3 marks");
    });

    it("rejects an answer key on the container itself", () => {
      const result = writeQuestionInputSchema.safeParse({
        ...caseStudy(4, [part(1, 1), part(1, 2), part(2, 3)]),
        answer: { solution: "The container should not carry a solution." },
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("answer");
    });

    it("rejects a single sub-part — that is a plain question with extra steps", () => {
      const result = writeQuestionInputSchema.safeParse(caseStudy(2, [part(2, 1)]));
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("subParts");
    });

    it("rejects sub-parts on a type that is answered as one question", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({ type: "SHORT_ANSWER", marks: 2, subParts: [part(1, 1), part(1, 2)] }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("subParts");
    });

    it("rejects a case study nested inside a case study", () => {
      const result = subPartInputSchema.safeParse({
        type: "CASE_BASED",
        body: "Read the following passage and answer the questions that follow.",
        marks: 2,
        answer: null,
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("type");
    });

    it("applies the same per-type rules to a sub-part as to a whole question", () => {
      // An MCQ sub-part with no correct option is the same mistake as an MCQ
      // question with no correct option, and must fail the same way.
      const result = subPartInputSchema.safeParse({
        type: "MCQ",
        body: "Which of the readings in the table is the peak load?",
        marks: 1,
        options: [
          { label: "A", body: "2 kW" },
          { label: "B", body: "3 kW" },
        ],
        answer: { solution: "3 kW is the highest reading." },
      });

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("options");
    });
  });

  describe("provenance", () => {
    it("requires attribution on anything not written from scratch", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({ source: { sourceType: "ADAPTED", year: 2024 } }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("source.attributionText");
    });

    it("requires a year on a CBSE paper", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({
          source: { sourceType: "CBSE_BOARD_PAPER", attributionText: "CBSE 2024, Set 1, Q19" },
        }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("source.year");
    });

    it("requires provenance at all — there is no way to enter a question without it", () => {
      const withoutSource = base();
      delete withoutSource.source;

      const result = writeQuestionInputSchema.safeParse(withoutSource);
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("source");
    });

    it("defaults an unreviewed licence to NEEDS_REVIEW rather than to cleared", () => {
      const result = writeQuestionInputSchema.safeParse(base());
      expect(result.success).toBe(true);
      expect((result.data as WriteQuestionInput).source.licenceStatus).toBe("NEEDS_REVIEW");
    });
  });

  describe("topics", () => {
    it("requires at least one, since the first is the primary one mastery uses", () => {
      const result = writeQuestionInputSchema.safeParse(base({ topicIds: [] }));
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("topicIds");
    });

    it("rejects the same topic listed twice", () => {
      const result = writeQuestionInputSchema.safeParse(
        base({ topicIds: ["topic_1", "topic_2", "topic_1"] }),
      );

      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain("topicIds");
    });
  });
});

describe("status transitions", () => {
  it("lets a draft be published and a published question be withdrawn", () => {
    expect(canTransitionQuestionStatus("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransitionQuestionStatus("PUBLISHED", "IN_REVIEW")).toBe(true);
    expect(canTransitionQuestionStatus("PUBLISHED", "ARCHIVED")).toBe(true);
  });

  it("does not let an archived question go straight back to students", () => {
    // Something was wrong enough with it to pull it mid-session. Whatever that
    // was gets looked at again on the way back, via DRAFT.
    expect(canTransitionQuestionStatus("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransitionQuestionStatus("ARCHIVED", "DRAFT")).toBe(true);
  });

  it("treats a no-op as illegal, so a double-click is not silently a success", () => {
    expect(canTransitionQuestionStatus("PUBLISHED", "PUBLISHED")).toBe(false);
  });
});

describe("publication blockers", () => {
  const publishable = { licenceStatus: "CLEARED", hasSolution: true, isContainer: false };

  it("clears a question whose licensing has been decided", () => {
    expect(publicationBlockers(publishable)).toEqual([]);
  });

  it("blocks publication while nobody has decided the licensing", () => {
    // This is docs/07 R2's mitigation made operational: the audit happens one
    // question at a time, by the person holding the source paper.
    const blockers = publicationBlockers({ ...publishable, licenceStatus: "NEEDS_REVIEW" });
    expect(blockers).toHaveLength(1);
    expect(blockers[0]).toContain("licensing");
  });

  it("blocks a restricted question outright", () => {
    expect(publicationBlockers({ ...publishable, licenceStatus: "RESTRICTED" })).toHaveLength(1);
  });

  it("does not demand a solution from a container, which holds none", () => {
    expect(publicationBlockers({ ...publishable, hasSolution: false, isContainer: true })).toEqual(
      [],
    );
  });
});
