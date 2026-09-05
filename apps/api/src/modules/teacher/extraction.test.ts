import { extractionResultSchema, QUESTION_TYPE_RULES, type QuestionType } from "@samjho/contracts";
import { describe, expect, it } from "vitest";

import { buildExtractionSystemPrompt, EXTRACTION_JSON_SCHEMA } from "./extraction.prompt.js";
import { parseExtraction } from "./extraction.service.js";

/**
 * The parts of extraction that do not need a model.
 *
 * Nothing here calls a provider, and that is the point: the two things most
 * likely to break this feature are the response parser and the drift between
 * what the prompt asks for and what the schema accepts. Both are testable
 * without spending a request, and neither would be caught by a test that mocked
 * the provider and asserted the mock was called.
 */

/** A response shaped exactly as the JSON schema describes. */
const VALID_RESPONSE = JSON.stringify({
  questions: [
    {
      printedNumber: "17",
      type: "MCQ",
      body: "The resistance of a wire is $R$. What is the resistance of half of it?",
      marks: 1,
      difficulty: "EASY",
      bloomLevel: "UNDERSTAND",
      chapterSlug: "electricity",
      topicSlugs: ["ohms-law"],
      options: [
        { label: "A", body: "$R$", isCorrect: false },
        { label: "B", body: "$R/2$", isCorrect: true },
        { label: "C", body: "$2R$", isCorrect: false },
        { label: "D", body: "$4R$", isCorrect: false },
      ],
      answer: {
        correctValue: null,
        solution: "Resistance is proportional to length, so halving the length halves $R$.",
        explanation: null,
        unit: null,
        markingScheme: null,
      },
      subParts: [],
      confidence: 0.94,
      note: null,
    },
  ],
});

describe("parseExtraction", () => {
  it("reads a clean response", () => {
    const result = parseExtraction(VALID_RESPONSE);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.type).toBe("MCQ");
    expect(result.questions[0]?.options.filter((option) => option.isCorrect)).toHaveLength(1);
  });

  // Every one of these is a real thing a model does, not a defensive
  // hypothetical — which is why the parser bothers with them at all.
  it("reads a response wrapped in a markdown fence", () => {
    const result = parseExtraction(`\`\`\`json\n${VALID_RESPONSE}\n\`\`\``);
    expect(result.ok).toBe(true);
  });

  it("reads a response with prose in front of it", () => {
    const result = parseExtraction(`Here is the extracted paper:\n\n${VALID_RESPONSE}`);
    expect(result.ok).toBe(true);
  });

  /**
   * The braces in `$\{1, 2, 3\}$` are the case a naive brace-counter gets wrong:
   * it sees the opening brace inside a string literal, never balances, and
   * declares a perfectly good response truncated.
   */
  it("is not confused by braces inside LaTeX in a question body", () => {
    const withSet = JSON.stringify({
      questions: [
        {
          printedNumber: "3",
          type: "VERY_SHORT_ANSWER",
          body: "List the elements of $\\{1, 2, 3\\}$ that are prime.",
          marks: 1,
          difficulty: "EASY",
          bloomLevel: "REMEMBER",
          chapterSlug: null,
          topicSlugs: [],
          options: [],
          answer: {
            correctValue: null,
            solution: "2 and 3.",
            explanation: null,
            unit: null,
            markingScheme: null,
          },
          subParts: [],
          confidence: 0.9,
          note: null,
        },
      ],
    });

    const result = parseExtraction(`Sure!\n${withSet}\nLet me know if you need more.`);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions[0]?.body).toContain("\\{1, 2, 3\\}");
  });

  it("reports a truncated response rather than half-reading it", () => {
    const result = parseExtraction(VALID_RESPONSE.slice(0, 200));
    expect(result.ok).toBe(false);
  });

  it("reports which field was wrong, so the repair turn can act on it", () => {
    const badDifficulty = VALID_RESPONSE.replace('"EASY"', '"TRIVIAL"');
    const result = parseExtraction(badDifficulty);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("difficulty");
  });

  it("refuses a response that is not JSON at all", () => {
    const result = parseExtraction("I could not read this paper, sorry.");
    expect(result.ok).toBe(false);
  });
});

describe("the prompt and the schema agree", () => {
  /**
   * The prompt's type rules are generated from `QUESTION_TYPE_RULES`, so this
   * asserts the generation actually ran rather than that the text is correct —
   * the point being that a type added to the table appears in the prompt with
   * no edit here.
   */
  it("describes every question type the validator knows about", () => {
    const prompt = buildExtractionSystemPrompt({
      subjectName: "Science",
      classLevel: 10,
      chapters: [
        {
          slug: "electricity",
          name: "Electricity",
          topics: [{ slug: "ohms-law", name: "Ohm's law" }],
        },
      ],
      notes: null,
    });

    for (const type of Object.keys(QUESTION_TYPE_RULES) as QuestionType[]) {
      expect(prompt).toContain(type);
    }
  });

  it("grounds the model in the real chapter and topic slugs", () => {
    const prompt = buildExtractionSystemPrompt({
      subjectName: "Science",
      classLevel: 10,
      chapters: [
        {
          slug: "electricity",
          name: "Electricity",
          topics: [{ slug: "ohms-law", name: "Ohm's law" }],
        },
        { slug: "acids-bases", name: "Acids and Bases", topics: [] },
      ],
      notes: "the answer key is on the last page",
    });

    expect(prompt).toContain("electricity");
    expect(prompt).toContain("ohms-law");
    expect(prompt).toContain("acids-bases");
    // The teacher's hint reaches the model verbatim, which is the whole reason
    // the field exists.
    expect(prompt).toContain("the answer key is on the last page");
  });

  /**
   * The JSON Schema is hand-written for the provider dialects while the Zod
   * schema is the gate, so nothing but a test stops them drifting. A response
   * built to satisfy the JSON Schema has to survive the Zod parse, or the model
   * is being asked for a shape we then reject.
   */
  it("accepts a response built to the JSON schema it advertises", () => {
    const questionSchema = (
      (EXTRACTION_JSON_SCHEMA["properties"] as Record<string, Record<string, unknown>>)[
        "questions"
      ] as Record<string, Record<string, unknown>>
    )["items"] as Record<string, unknown>;

    const required = questionSchema["required"] as string[];
    // Everything the JSON Schema marks required must be enough on its own: a
    // model that supplies exactly the required fields and nothing else is
    // behaving correctly, and must not fail our parse.
    const minimal = {
      questions: [
        {
          type: "SHORT_ANSWER",
          body: "State Ohm's law.",
          marks: 2,
          difficulty: "MEDIUM",
          confidence: 0.8,
        },
      ],
    };

    expect(required).toEqual(["type", "body", "marks", "difficulty", "confidence"]);
    expect(extractionResultSchema.safeParse(minimal).success).toBe(true);
  });
});
