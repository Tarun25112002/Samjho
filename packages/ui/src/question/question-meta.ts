import type { Difficulty, QuestionType } from "@samjho/contracts";

/**
 * Display labels and behavioural facts about question types.
 *
 * `RESPONSE_SHAPE` is the one that matters. It answers "what does a student
 * physically do to answer this?" — and it is a lookup table rather than a
 * `switch` inside the renderer because the renderer is not the only thing that
 * will need the answer. The practice runner, the exam palette's
 * answered/unanswered state and the self-evaluation flow all need it too, and a
 * `switch` buried in JSX cannot be reused by any of them.
 */

export const QUESTION_TYPE_LABELS = {
  MCQ: "Multiple choice",
  ASSERTION_REASON: "Assertion & reason",
  VERY_SHORT_ANSWER: "Very short answer",
  SHORT_ANSWER: "Short answer",
  LONG_ANSWER: "Long answer",
  CASE_BASED: "Case study",
  NUMERICAL: "Numerical",
  TRUE_FALSE: "True or false",
  FILL_BLANK: "Fill in the blank",
  MATCH_FOLLOWING: "Match the following",
} as const satisfies Record<QuestionType, string>;

export const DIFFICULTY_LABELS = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
} as const satisfies Record<Difficulty, string>;

/**
 * How a student answers each type.
 *
 * - `CHOICE`   — pick one of the supplied options.
 * - `BOOLEAN`  — true or false; no option rows exist in the database.
 * - `SHORT`    — a single line: a word, a number, a set of pairs.
 * - `EXTENDED` — multiple lines of working.
 * - `NONE`     — a container. Case studies are never answered directly; their
 *                sub-parts are, which is exactly why the container carries no
 *                answer row of its own.
 */
export const RESPONSE_SHAPE = {
  MCQ: "CHOICE",
  ASSERTION_REASON: "CHOICE",
  TRUE_FALSE: "BOOLEAN",
  FILL_BLANK: "SHORT",
  NUMERICAL: "SHORT",
  MATCH_FOLLOWING: "SHORT",
  VERY_SHORT_ANSWER: "SHORT",
  SHORT_ANSWER: "EXTENDED",
  LONG_ANSWER: "EXTENDED",
  CASE_BASED: "NONE",
} as const satisfies Record<QuestionType, "CHOICE" | "BOOLEAN" | "SHORT" | "EXTENDED" | "NONE">;

export type ResponseShape = (typeof RESPONSE_SHAPE)[QuestionType];

export function responseShapeFor(type: QuestionType): ResponseShape {
  return RESPONSE_SHAPE[type];
}

/** "1 mark" / "4 marks" — wrong pluralisation on every question looks amateur. */
export function formatMarks(marks: number): string {
  return `${String(marks)} ${marks === 1 ? "mark" : "marks"}`;
}

/**
 * Placeholder text for a short answer, by type.
 *
 * Match-the-following gets an example rather than an instruction, because the
 * expected format ("i-q, ii-r") is not guessable and the seeded answer keys are
 * written exactly that way.
 */
export function shortAnswerHint(type: QuestionType, unit: string | null): string {
  if (type === "MATCH_FOLLOWING") return "For example: i-q, ii-r, iii-s, iv-p";
  if (type === "NUMERICAL") return unit ? `Your answer in ${unit}` : "Your answer";
  return "Your answer";
}
