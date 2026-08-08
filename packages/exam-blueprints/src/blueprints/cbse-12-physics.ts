import type { ExamBlueprintInput } from "../blueprint.schema.js";

/**
 * CBSE Class 12 Physics, 2026-27 — a validator fixture, not MVP content.
 *
 * There is no Class 12 content, no Class 12 UI, and no Class 12 student in the
 * seed. This blueprint exists solely so the exam engine is exercised against a
 * paper shape it will not otherwise see until Class 12 launches (R13). Both MVP
 * subjects are 80 marks over five sections; if that is the only shape the engine
 * ever sees, "80" and "five sections" quietly become assumptions.
 *
 * What it actually varies:
 *   • 70 marks, not 80 — the theory total is per-subject data, never a constant.
 *     (The other 30 marks are practical, which this platform does not model.)
 *   • 33 questions, not 38 or 39.
 *   • Section D is the 4-mark case-based section and Section E is 3 × 5 marks.
 *     In both Class 10 papers, case-based is Section E. Anything that keys off
 *     "the last section is the case-study section" breaks here — which is the
 *     entire point of keeping this blueprint around.
 *
 * A note on how this was corrected. The draft structure in docs/04-exam-engine.md
 * had Section D as 3 × 5m and Section E as 2 × 4m + 1 × 6m. That sums to 76 marks
 * over 34 questions, against a verified 70 and 33 — the case-based section had
 * been put in the wrong place and a 6-mark question invented. It looked entirely
 * plausible and nobody would catch it by reading. The declared-totals cross-check
 * in validate.ts catches it in under a millisecond, which is the argument for
 * declaring redundant totals at all.
 */
export const cbse12Physics: ExamBlueprintInput = {
  id: "cbse-12-physics-2026",
  version: 1,
  name: "CBSE Class 12 Physics — 2026-27",
  academicYear: "2026-27",
  subject: { board: "CBSE", classLevel: 12, code: "PHY" },

  totalMarks: 70,
  totalQuestions: 33,
  durationMinutes: 180,

  generalInstructions: [
    "There are 33 questions in all. All questions are compulsory.",
    "This question paper has five sections: Section A, Section B, Section C, Section D and Section E.",
    "All the sections are compulsory.",
    "Section A contains sixteen questions of 1 mark each, Section B contains five questions of 2 marks each, Section C contains seven questions of 3 marks each, Section D contains two case study based questions of 4 marks each and Section E contains three long answer questions of 5 marks each.",
    "There is no overall choice. However, an internal choice has been provided in some questions.",
    "Use of calculators is not allowed.",
  ],

  sections: [
    {
      name: "Section A",
      orderIndex: 0,
      marksPerQuestion: 1,
      instructions: "Questions 1 to 16 carry 1 mark each.",
      groups: [
        { count: 12, types: ["MCQ"] },
        { count: 4, types: ["ASSERTION_REASON"] },
      ],
    },
    {
      name: "Section B",
      orderIndex: 1,
      marksPerQuestion: 2,
      instructions: "Questions 17 to 21 carry 2 marks each.",
      groups: [
        {
          count: 5,
          types: ["VERY_SHORT_ANSWER", "SHORT_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 1,
        },
      ],
    },
    {
      name: "Section C",
      orderIndex: 2,
      marksPerQuestion: 3,
      instructions: "Questions 22 to 28 carry 3 marks each.",
      groups: [
        {
          count: 7,
          types: ["SHORT_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 2,
        },
      ],
    },
    {
      // The divergence that makes this fixture worth keeping: in both Class 10
      // papers the case-based section is E and it is the last one. Here it is D.
      name: "Section D",
      orderIndex: 3,
      marksPerQuestion: 4,
      instructions: "Questions 29 and 30 are case study based questions carrying 4 marks each.",
      groups: [
        {
          count: 2,
          types: ["CASE_BASED"],
          internalChoice: true,
          choiceCount: 2,
          subParts: { mode: "CONSTRAINED", allowedMarks: [1, 2], minParts: 2 },
        },
      ],
    },
    {
      name: "Section E",
      orderIndex: 4,
      marksPerQuestion: 5,
      instructions: "Questions 31 to 33 carry 5 marks each.",
      groups: [
        {
          count: 3,
          types: ["LONG_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 3,
        },
      ],
    },
  ],

  sourceUrl: "https://school.careers360.com/boards/cbse/cbse-12th-exam-pattern",
  verifiedAgainstOfficial: false,
};
