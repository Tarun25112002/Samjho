import type { ExamBlueprintInput } from "../blueprint.schema.js";

/**
 * CBSE Class 10 Science, 2026-27.
 *
 * 80 theory marks over 39 questions, plus 20 marks of internal assessment that
 * this platform does not model — the paper is worth 80, and `theoryMarks` on the
 * Subject row says so.
 *
 * Structurally close to Maths (five sections, A–E, 80 marks), which is exactly
 * the R13 problem: two MVP subjects that agree on almost everything let a wrong
 * assumption hide. The one place they genuinely diverge is Section E, and it is
 * a real divergence rather than a cosmetic one. Maths *prescribes* 1+1+2.
 * Science prescribes a vocabulary — "sub-parts of the values of 1/2/3 marks" —
 * so 1+1+2, 1+3 and 2+2 are all legal for different case studies in the same
 * paper. Modelling that as a fixed split would reject valid content.
 *
 * Science also spans Physics, Chemistry and Biology in one paper. That lives on
 * Chapter.domain rather than here, because it constrains which chapters a slot
 * draws from, not how the paper is shaped.
 */
export const cbse10Science: ExamBlueprintInput = {
  id: "cbse-10-science-2026",
  version: 1,
  name: "CBSE Class 10 Science — 2026-27",
  academicYear: "2026-27",
  subject: { board: "CBSE", classLevel: 10, code: "SCI" },

  totalMarks: 80,
  totalQuestions: 39,
  durationMinutes: 180,

  generalInstructions: [
    "This question paper consists of 39 questions in 5 sections.",
    "All questions are compulsory. However, an internal choice is provided in some questions.",
    "Section A consists of 20 objective type questions carrying 1 mark each.",
    "Section B consists of 6 Very Short Answer type questions carrying 2 marks each. Answers should be in the range of 30 to 50 words.",
    "Section C consists of 7 Short Answer type questions carrying 3 marks each. Answers should be in the range of 50 to 80 words.",
    "Section D consists of 3 Long Answer type questions carrying 5 marks each. Answers should be in the range of 80 to 120 words.",
    "Section E consists of 3 source-based / case-based units of assessment of 4 marks each with sub-parts of the values of 1/2/3 marks.",
    "Draw neat and clean diagrams wherever necessary.",
  ],

  sections: [
    {
      name: "Section A",
      orderIndex: 0,
      marksPerQuestion: 1,
      instructions: "Questions 1 to 20 are objective type and carry 1 mark each.",
      groups: [
        { count: 16, types: ["MCQ"] },
        {
          count: 4,
          types: ["ASSERTION_REASON"],
          note: "Science carries four Assertion–Reason questions to Maths's two — a real per-subject difference, not a rounding of the same rule.",
        },
      ],
    },
    {
      name: "Section B",
      orderIndex: 1,
      marksPerQuestion: 2,
      instructions: "Questions 21 to 26 carry 2 marks each.",
      groups: [
        {
          count: 6,
          types: ["VERY_SHORT_ANSWER", "SHORT_ANSWER"],
          internalChoice: true,
          choiceCount: 2,
        },
      ],
    },
    {
      name: "Section C",
      orderIndex: 2,
      marksPerQuestion: 3,
      instructions: "Questions 27 to 33 carry 3 marks each.",
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
      name: "Section D",
      orderIndex: 3,
      marksPerQuestion: 5,
      instructions: "Questions 34 to 36 carry 5 marks each.",
      groups: [
        {
          count: 3,
          types: ["LONG_ANSWER"],
          internalChoice: true,
          choiceCount: 3,
          note: "Typically one long-answer question per domain — Physics, Chemistry, Biology.",
        },
      ],
    },
    {
      name: "Section E",
      orderIndex: 4,
      marksPerQuestion: 4,
      instructions:
        "Questions 37 to 39 are source-based / case-based units of assessment carrying 4 marks each.",
      groups: [
        {
          count: 3,
          types: ["CASE_BASED"],
          internalChoice: true,
          choiceCount: 3,
          subParts: { mode: "CONSTRAINED", allowedMarks: [1, 2, 3], minParts: 2 },
          note: "Unlike Maths, the split is not prescribed: 1+1+2, 1+3 and 2+2 are all legal for different case studies in the same paper.",
        },
      ],
    },
  ],

  sourceUrl: "https://www.vedantu.com/sample-papers/cbse-sample-papers-for-class-10-science",
  verifiedAgainstOfficial: false,
};
