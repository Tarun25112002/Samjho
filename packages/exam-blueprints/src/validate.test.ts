import { describe, expect, it } from "vitest";
import type { ExamBlueprintInput } from "./blueprint.schema.js";
import {
  ALL_BLUEPRINTS,
  cbse10MathsStandard,
  cbse10Science,
  cbse12Physics,
} from "./blueprints/index.js";
import { mixedMarksSectionFixture } from "./fixtures/mixed-marks-section.js";
import { assertValidBlueprint, summariseBlueprint, validateBlueprint } from "./validate.js";

/** A minimal valid blueprint to mutate into each failure case. */
function baseBlueprint(): ExamBlueprintInput {
  return {
    id: "test-blueprint",
    version: 1,
    name: "Test",
    academicYear: "2026-27",
    subject: { board: "CBSE", classLevel: 10, code: "MATH" },
    totalMarks: 10,
    totalQuestions: 6,
    durationMinutes: 60,
    generalInstructions: ["Test."],
    verifiedAgainstOfficial: false,
    sections: [
      {
        name: "Section A",
        orderIndex: 0,
        marksPerQuestion: 1,
        groups: [{ count: 4, types: ["MCQ"] }],
      },
      {
        name: "Section B",
        orderIndex: 1,
        marksPerQuestion: 3,
        groups: [{ count: 2, types: ["SHORT_ANSWER"] }],
      },
    ],
  };
}

function issuePaths(input: unknown): string[] {
  const result = validateBlueprint(input);
  if (result.ok) throw new Error("expected validation to fail, but it passed");
  return result.issues.map((i) => i.path);
}

describe("validateBlueprint — the shipped blueprints", () => {
  it.each(ALL_BLUEPRINTS.map((b) => [b.id, b] as const))("%s is valid", (_id, blueprint) => {
    expect(validateBlueprint(blueprint).ok).toBe(true);
  });

  it("reconciles Class 10 Maths against the published 80 marks / 38 questions", () => {
    const summary = summariseBlueprint(assertValidBlueprint(cbse10MathsStandard));
    expect(summary.totalMarks).toBe(80);
    expect(summary.totalQuestions).toBe(38);
    expect(summary.sections.map((s) => s.marks)).toEqual([20, 10, 18, 20, 12]);
  });

  it("reconciles Class 10 Science against the published 80 marks / 39 questions", () => {
    const summary = summariseBlueprint(assertValidBlueprint(cbse10Science));
    expect(summary.totalMarks).toBe(80);
    expect(summary.totalQuestions).toBe(39);
    expect(summary.sections.map((s) => s.questions)).toEqual([20, 6, 7, 3, 3]);
  });

  it("reconciles Class 12 Physics against the published 70 marks / 33 questions", () => {
    const summary = summariseBlueprint(assertValidBlueprint(cbse12Physics));
    expect(summary.totalMarks).toBe(70);
    expect(summary.totalQuestions).toBe(33);
  });

  it("keeps Physics structurally distinct from the Class 10 papers (R13)", () => {
    // If this ever passes trivially, the fixture has stopped doing its job.
    const physics = summariseBlueprint(assertValidBlueprint(cbse12Physics));
    const maths = summariseBlueprint(assertValidBlueprint(cbse10MathsStandard));

    expect(physics.totalMarks).not.toBe(maths.totalMarks);

    // Case-based lives in Section D for Physics and Section E for Class 10.
    // Anything keying off "the last section is the case-study section" breaks.
    const containerSection = (s: typeof physics) =>
      s.sections.find((x) => x.containerPositions > 0)?.name;
    expect(containerSection(physics)).toBe("Section D");
    expect(containerSection(maths)).toBe("Section E");
  });

  it("models the Maths/Science sub-part difference rather than flattening it", () => {
    const mathsE = cbse10MathsStandard.sections[4]?.groups[0];
    const scienceE = cbse10Science.sections[4]?.groups[0];
    expect(mathsE?.subParts?.mode).toBe("FIXED");
    expect(scienceE?.subParts?.mode).toBe("CONSTRAINED");
  });
});

describe("validateBlueprint — arithmetic cross-checks", () => {
  it("rejects the draft Class 12 Physics structure from docs/04", () => {
    // The original sketch: Section D as 3 x 5m and Section E as 2 x 4m + 1 x 6m.
    // Well-formed, plausible, and wrong — 76 marks over 34 questions against a
    // real 70 and 33. This is the case the declared totals exist to catch.
    const draft: ExamBlueprintInput = {
      ...baseBlueprint(),
      id: "cbse-12-physics-draft",
      totalMarks: 70,
      totalQuestions: 33,
      sections: [
        {
          name: "Section A",
          orderIndex: 0,
          marksPerQuestion: 1,
          groups: [{ count: 16, types: ["MCQ"] }],
        },
        {
          name: "Section B",
          orderIndex: 1,
          marksPerQuestion: 2,
          groups: [{ count: 5, types: ["SHORT_ANSWER"] }],
        },
        {
          name: "Section C",
          orderIndex: 2,
          marksPerQuestion: 3,
          groups: [{ count: 7, types: ["SHORT_ANSWER"] }],
        },
        {
          name: "Section D",
          orderIndex: 3,
          marksPerQuestion: 5,
          groups: [{ count: 3, types: ["LONG_ANSWER"] }],
        },
        {
          name: "Section E",
          orderIndex: 4,
          groups: [
            {
              count: 2,
              marks: 4,
              types: ["CASE_BASED"],
              subParts: { mode: "FIXED", marks: [1, 1, 2] },
            },
            { count: 1, marks: 6, types: ["LONG_ANSWER"] },
          ],
        },
      ],
    };

    const result = validateBlueprint(draft);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    const messages = result.issues.map((i) => i.message).join("\n");
    expect(messages).toContain("declared 70 but sections sum to 76");
    expect(messages).toContain("declared 33 but sections sum to 34");
  });

  it("rejects a marks total that disagrees with the sections", () => {
    expect(issuePaths({ ...baseBlueprint(), totalMarks: 999 })).toContain("totalMarks");
  });

  it("rejects a question count that disagrees with the sections", () => {
    expect(issuePaths({ ...baseBlueprint(), totalQuestions: 999 })).toContain("totalQuestions");
  });

  it("rejects a group whose marks resolve from nowhere", () => {
    const bp = baseBlueprint();
    const section = bp.sections[0];
    if (!section) throw new Error("fixture drift");
    delete section.marksPerQuestion;
    expect(issuePaths(bp)).toContain("sections.0.groups.0.marks");
  });

  it("rejects a section default that a group silently contradicts", () => {
    const bp = baseBlueprint();
    const group = bp.sections[0]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.marks = 7; // section says 1
    expect(issuePaths(bp)).toContain("sections.0.groups.0.marks");
  });
});

describe("validateBlueprint — sub-parts", () => {
  it("rejects a fixed split that does not sum to the question's marks", () => {
    const bp = baseBlueprint();
    const group = bp.sections[1]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.subParts = { mode: "FIXED", marks: [1, 1, 2] }; // question is worth 3
    expect(issuePaths(bp)).toContain("sections.1.groups.0.subParts.marks");
  });

  it("accepts a fixed split that does", () => {
    const bp = baseBlueprint();
    const group = bp.sections[1]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.subParts = { mode: "FIXED", marks: [1, 2] };
    expect(validateBlueprint(bp).ok).toBe(true);
  });

  it("accepts a constrained split when some legal combination exists", () => {
    const bp = baseBlueprint();
    const group = bp.sections[1]?.groups[0];
    if (!group) throw new Error("fixture drift");
    // 3 marks from {1,2} with at least 2 parts: 1+2. Legal.
    group.subParts = { mode: "CONSTRAINED", allowedMarks: [1, 2], minParts: 2 };
    expect(validateBlueprint(bp).ok).toBe(true);
  });

  it("rejects a constrained split when no combination can reach the total", () => {
    const bp = baseBlueprint();
    const group = bp.sections[1]?.groups[0];
    if (!group) throw new Error("fixture drift");
    // 3 marks from {2} only: 2 and 4 are reachable, 3 is not.
    group.subParts = { mode: "CONSTRAINED", allowedMarks: [2], minParts: 2 };
    expect(issuePaths(bp)).toContain("sections.1.groups.0.subParts.allowedMarks");
  });

  it("rejects a constrained split that needs fewer parts than minParts allows", () => {
    const bp = baseBlueprint();
    const group = bp.sections[1]?.groups[0];
    if (!group) throw new Error("fixture drift");
    // 3 marks from {3} with at least 2 parts: only 3 itself works, and that is
    // one part. Real Section E rules always want two or more sub-parts.
    group.subParts = { mode: "CONSTRAINED", allowedMarks: [3], minParts: 2 };
    expect(issuePaths(bp)).toContain("sections.1.groups.0.subParts.allowedMarks");
  });

  it("accepts every sub-part split Class 10 Science permits", () => {
    // 1+1+2, 1+3 and 2+2 are all legal for different case studies in one paper.
    const scienceRule = { mode: "CONSTRAINED", allowedMarks: [1, 2, 3], minParts: 2 } as const;
    for (const split of [
      [1, 1, 2],
      [1, 3],
      [2, 2],
    ]) {
      expect(split.reduce((a, b) => a + b, 0)).toBe(4);
      expect(split.every((m) => scienceRule.allowedMarks.includes(m as 1 | 2 | 3))).toBe(true);
    }
  });
});

describe("validateBlueprint — internal choice", () => {
  it("rejects internalChoice with no choiceCount", () => {
    const bp = baseBlueprint();
    const group = bp.sections[0]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.internalChoice = true;
    expect(issuePaths(bp)).toContain("sections.0.groups.0.choiceCount");
  });

  it("rejects choiceCount with internalChoice false", () => {
    const bp = baseBlueprint();
    const group = bp.sections[0]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.choiceCount = 2;
    expect(issuePaths(bp)).toContain("sections.0.groups.0.internalChoice");
  });

  it("rejects more choices than there are positions", () => {
    const bp = baseBlueprint();
    const group = bp.sections[0]?.groups[0];
    if (!group) throw new Error("fixture drift");
    group.internalChoice = true;
    group.choiceCount = 99; // count is 4
    expect(issuePaths(bp)).toContain("sections.0.groups.0.choiceCount");
  });
});

describe("validateBlueprint — section ordering", () => {
  it("rejects duplicate orderIndex values", () => {
    const bp = baseBlueprint();
    const section = bp.sections[1];
    if (!section) throw new Error("fixture drift");
    section.orderIndex = 0;
    expect(issuePaths(bp)).toContain("sections");
  });

  it("rejects gaps in orderIndex", () => {
    const bp = baseBlueprint();
    const section = bp.sections[1];
    if (!section) throw new Error("fixture drift");
    section.orderIndex = 5;
    expect(issuePaths(bp)).toContain("sections");
  });

  it("rejects duplicate section names", () => {
    const bp = baseBlueprint();
    const section = bp.sections[1];
    if (!section) throw new Error("fixture drift");
    section.name = "Section A";
    expect(issuePaths(bp)).toContain("sections.1.name");
  });
});

describe("mixed-marks fixture", () => {
  it("is valid — the engine must handle a section whose groups differ in marks", () => {
    const result = validateBlueprint(mixedMarksSectionFixture);
    if (!result.ok) throw new Error(result.issues.map((i) => `${i.path}: ${i.message}`).join("\n"));
    expect(result.summary.totalMarks).toBe(30);
    expect(result.summary.sections[1]?.marks).toBe(20);
  });

  it("covers a shape no real MVP blueprint exercises", () => {
    const sectionMixesMarks = (bp: (typeof ALL_BLUEPRINTS)[number]) =>
      bp.sections.some((s) => new Set(s.groups.map((g) => g.marks ?? s.marksPerQuestion)).size > 1);

    expect(ALL_BLUEPRINTS.some(sectionMixesMarks)).toBe(false);
    expect(sectionMixesMarks(assertValidBlueprint(mixedMarksSectionFixture))).toBe(true);
  });
});

describe("assertValidBlueprint", () => {
  it("throws with every issue listed, not just the first", () => {
    expect(() =>
      assertValidBlueprint({ ...baseBlueprint(), totalMarks: 1, totalQuestions: 2 }),
    ).toThrow(/totalMarks[\s\S]*totalQuestions/);
  });
});
