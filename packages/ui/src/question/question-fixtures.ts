import type { QuestionType, StudentQuestion, StudentSubPart } from "@samjho/contracts";

/**
 * Fixtures shaped like the real seed data.
 *
 * Copied in spirit from `apps/api/prisma/seed/questions/*` rather than invented:
 * the bodies carry the same LaTeX, the assertion–reason options are CBSE's
 * actual four, and the case study splits 1+1+2 the way Class 10 Maths
 * prescribes. A fixture that is tidier than production data tests a renderer
 * that does not have to handle production data.
 */

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${String(counter)}`;
}

export function makeQuestion(overrides: Partial<StudentQuestion> = {}): StudentQuestion {
  return {
    id: nextId("q"),
    type: "MCQ",
    body: "Placeholder body.",
    marks: 1,
    difficulty: "MEDIUM",
    bloomLevel: "UNDERSTAND",
    expectedTimeSeconds: 60,
    version: 1,
    options: [],
    assets: [],
    chapter: { id: "ch-1", name: "Electricity", slug: "electricity", domain: "Physics" },
    topics: [{ id: "t-1", name: "Ohm's law", slug: "ohms-law", isPrimary: true }],
    isContainer: false,
    subParts: [],
    provenance: null,
    ...overrides,
  };
}

export function makeSubPart(overrides: Partial<StudentSubPart> = {}): StudentSubPart {
  return {
    id: nextId("sp"),
    type: "VERY_SHORT_ANSWER",
    body: "Sub-part body.",
    marks: 1,
    difficulty: "EASY",
    bloomLevel: "REMEMBER",
    expectedTimeSeconds: 60,
    version: 1,
    options: [],
    assets: [],
    subPartIndex: 0,
    ...overrides,
  };
}

function options(bodies: string[]) {
  return bodies.map((body, index) => ({
    id: nextId("opt"),
    label: ["A", "B", "C", "D"][index] ?? String(index),
    body,
    orderIndex: index,
  }));
}

/** One realistic question per type — the parameterised render test's input. */
export function questionOfEveryType(): Record<QuestionType, StudentQuestion> {
  return {
    MCQ: makeQuestion({
      type: "MCQ",
      marks: 1,
      body: "Two resistors of $6\\ \\Omega$ and $3\\ \\Omega$ are connected in parallel. Their equivalent resistance is:",
      options: options(["$2\\ \\Omega$", "$9\\ \\Omega$", "$18\\ \\Omega$", "$0.5\\ \\Omega$"]),
    }),

    ASSERTION_REASON: makeQuestion({
      type: "ASSERTION_REASON",
      marks: 1,
      body: "**Assertion (A):** Copper does not liberate hydrogen with dilute HCl.\n\n**Reason (R):** Copper is more reactive than hydrogen.",
      options: options([
        "Both A and R are true and R is the correct explanation of A.",
        "Both A and R are true but R is not the correct explanation of A.",
        "A is true but R is false.",
        "A is false but R is true.",
      ]),
    }),

    TRUE_FALSE: makeQuestion({
      type: "TRUE_FALSE",
      marks: 1,
      // No option rows exist for this type in the database.
      body: "State whether the following is true or false: *Arteries carry blood away from the heart.*",
    }),

    FILL_BLANK: makeQuestion({
      type: "FILL_BLANK",
      marks: 1,
      body: "The SI unit of electric resistance is the ________.",
    }),

    NUMERICAL: makeQuestion({
      type: "NUMERICAL",
      marks: 3,
      difficulty: "HARD",
      body: "An object is placed $30$ cm in front of a convex mirror of focal length $15$ cm. Find the image position.",
    }),

    MATCH_FOLLOWING: makeQuestion({
      type: "MATCH_FOLLOWING",
      marks: 2,
      body: [
        "Match the trigonometric ratios in Column I with their values in Column II.",
        "",
        "| Column I | Column II |",
        "| --- | --- |",
        "| (i) $\\sin 30^\\circ$ | (p) $\\sqrt{2}$ |",
        "| (ii) $\\cos 30^\\circ$ | (q) $\\dfrac{1}{2}$ |",
      ].join("\n"),
    }),

    VERY_SHORT_ANSWER: makeQuestion({
      type: "VERY_SHORT_ANSWER",
      marks: 2,
      body: "Find the HCF of $510$ and $92$.",
    }),

    SHORT_ANSWER: makeQuestion({
      type: "SHORT_ANSWER",
      marks: 3,
      body: "Explain, with an example, why a reaction is called a displacement reaction.",
    }),

    LONG_ANSWER: makeQuestion({
      type: "LONG_ANSWER",
      marks: 5,
      body: "Derive the expression for the equivalent resistance of three resistors in series.",
    }),

    CASE_BASED: makeQuestion({
      type: "CASE_BASED",
      marks: 4,
      isContainer: true,
      body: "**The school auditorium**\n\nThe first row has $20$ seats and every row after has $2$ more.",
      subParts: [
        makeSubPart({ subPartIndex: 0, marks: 1, body: "(i) Write the common difference." }),
        makeSubPart({ subPartIndex: 1, marks: 1, body: "(ii) How many seats in row $10$?" }),
        makeSubPart({
          subPartIndex: 2,
          marks: 2,
          type: "SHORT_ANSWER",
          body: "(iii) Find the total number of seats.",
        }),
      ],
    }),
  };
}
