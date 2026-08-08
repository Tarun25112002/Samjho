import type { ExamBlueprintInput } from "../blueprint.schema.js";

/**
 * CBSE Class 10 Mathematics (Standard), 2026-27.
 *
 * 80 theory marks over 38 questions in three hours. Mathematics also has a
 * Basic variant sat by students not continuing with the subject; it shares this
 * structure exactly and differs only in difficulty, which is why `variant` is a
 * field on the blueprint rather than a separate shape.
 *
 * Section E is the reason the question tree exists: three 4-mark case studies,
 * each prescribed as 1+1+2. Not "roughly 4 marks of sub-parts" — this paper
 * fixes the split, so an authored question that comes out 2+2 is wrong and the
 * admin tooling should say so.
 */
export const cbse10MathsStandard: ExamBlueprintInput = {
  id: "cbse-10-maths-standard-2026",
  version: 1,
  name: "CBSE Class 10 Mathematics (Standard) — 2026-27",
  academicYear: "2026-27",
  subject: { board: "CBSE", classLevel: 10, code: "MATH", variant: "STANDARD" },

  totalMarks: 80,
  totalQuestions: 38,
  durationMinutes: 180,

  generalInstructions: [
    "This question paper contains 38 questions. All questions are compulsory.",
    "This question paper is divided into five sections — A, B, C, D and E.",
    "Section A comprises 20 questions of 1 mark each.",
    "Section B comprises 5 questions of 2 marks each.",
    "Section C comprises 6 questions of 3 marks each.",
    "Section D comprises 4 questions of 5 marks each.",
    "Section E comprises 3 case-based integrated units of assessment of 4 marks each, with sub-parts of 1, 1 and 2 marks.",
    "There is no overall choice. Internal choice is provided in 2 questions of Section B, 2 of Section C, 2 of Section D and in the 2-mark sub-part of each question in Section E.",
    "Draw neat figures wherever required. Take π = 22/7 wherever required if not stated.",
    "Use of calculators is not allowed.",
  ],

  sections: [
    {
      name: "Section A",
      orderIndex: 0,
      marksPerQuestion: 1,
      instructions: "Questions 1 to 20 carry 1 mark each.",
      groups: [
        { count: 18, types: ["MCQ"] },
        {
          count: 2,
          types: ["ASSERTION_REASON"],
          note: "Questions 19 and 20 are Assertion–Reason, always the last two of Section A.",
        },
      ],
    },
    {
      name: "Section B",
      orderIndex: 1,
      marksPerQuestion: 2,
      instructions: "Questions 21 to 25 carry 2 marks each.",
      groups: [
        {
          count: 5,
          types: ["VERY_SHORT_ANSWER", "SHORT_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 2,
        },
      ],
    },
    {
      name: "Section C",
      orderIndex: 2,
      marksPerQuestion: 3,
      instructions: "Questions 26 to 31 carry 3 marks each.",
      groups: [
        {
          count: 6,
          types: ["SHORT_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 2,
        },
      ],
    },
    {
      name: "Section D",
      orderIndex: 3,
      marksPerQuestion: 5,
      instructions: "Questions 32 to 35 carry 5 marks each.",
      groups: [
        {
          count: 4,
          types: ["LONG_ANSWER", "NUMERICAL"],
          internalChoice: true,
          choiceCount: 2,
        },
      ],
    },
    {
      name: "Section E",
      orderIndex: 4,
      marksPerQuestion: 4,
      instructions:
        "Questions 36 to 38 are case-based integrated units of assessment carrying 4 marks each.",
      groups: [
        {
          count: 3,
          types: ["CASE_BASED"],
          internalChoice: true,
          choiceCount: 3,
          subParts: { mode: "FIXED", marks: [1, 1, 2] },
          note: "The internal choice sits inside the 2-mark sub-part, not at the level of the whole case study.",
        },
      ],
    },
  ],

  sourceUrl: "https://www.vedantu.com/sample-papers/cbse-sample-papers-for-class-10-maths",

  // Transcribed from secondary sources. Must be re-checked against the official
  // sample paper PDF on cbseacademic.nic.in before Phase 6 scores anyone.
  verifiedAgainstOfficial: false,
};
