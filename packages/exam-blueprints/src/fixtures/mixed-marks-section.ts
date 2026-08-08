import type { ExamBlueprintInput } from "../blueprint.schema.js";

/**
 * A synthetic blueprint. Not a real CBSE paper — deliberately.
 *
 * `docs/00-overview.md` §8 claimed that "a section can contain groups with
 * different marks per question", citing Class 12 Physics Section E as holding
 * both 4-mark and 6-mark questions. Checking that against the actual pattern
 * showed it is not true: Physics Section E is a uniform 3 × 5 marks, and none of
 * the three papers this platform models mixes marks within a section.
 *
 * That leaves a choice. Drop the capability, or keep it and test it honestly.
 *
 * Keeping it costs one nullable field (`group.marks`) and is the safer bet: CBSE
 * demonstrably changes patterns (R8), other subjects exist, and discovering the
 * limitation mid-Phase-6 means a schema migration against live exam data. But an
 * untested capability is not a capability, and with no real paper to exercise it
 * the mixed-marks path would be dead code that only executes for the first
 * student unlucky enough to sit a paper shaped this way.
 *
 * So: a fixture. It never reaches the database, never appears in the UI, and
 * exists only to keep the engine's mixed-marks path covered.
 */
export const mixedMarksSectionFixture: ExamBlueprintInput = {
  id: "fixture-mixed-marks-section",
  version: 1,
  name: "Fixture — section with mixed marks per question",
  academicYear: "2026-27",
  subject: { board: "CBSE", classLevel: 12, code: "FIXTURE" },

  totalMarks: 30,
  totalQuestions: 8,
  durationMinutes: 60,

  generalInstructions: ["Synthetic fixture. Not a real examination paper."],

  sections: [
    {
      name: "Section A",
      orderIndex: 0,
      marksPerQuestion: 2,
      groups: [{ count: 5, types: ["MCQ"] }],
    },
    {
      // No `marksPerQuestion` here: every group carries its own. The validator
      // rejects a section that declares a default *and* contradicts it, because
      // then two places claim authority over the same number.
      name: "Section B",
      orderIndex: 1,
      groups: [
        {
          count: 2,
          marks: 4,
          types: ["CASE_BASED"],
          subParts: { mode: "FIXED", marks: [1, 1, 2] },
        },
        {
          count: 1,
          marks: 12,
          types: ["LONG_ANSWER"],
          internalChoice: true,
          choiceCount: 1,
        },
      ],
    },
  ],

  verifiedAgainstOfficial: false,
};
