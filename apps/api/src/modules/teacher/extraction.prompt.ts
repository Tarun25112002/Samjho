import {
  MARKING_SCHEME_REQUIRED_FROM_MARKS,
  QUESTION_TYPE_RULES,
  type QuestionType,
} from "@samjho/contracts";

/**
 * The prompt that turns a scanned paper into structured questions.
 *
 * ## Why the type rules are generated rather than written
 *
 * The list of per-type requirements below is built from `QUESTION_TYPE_RULES` —
 * the same table `writeQuestionInputSchema` validates against and the same one
 * the admin form renders from. That is not cleverness for its own sake. The
 * model's output is validated by that table at import, so a prompt that
 * describes it in prose is a second copy of the rules with no test holding it
 * to the first. The copy drifts, the model is told the old rules, and every
 * extracted assertion-reason question fails validation for a reason the teacher
 * cannot see and we would have to rediscover.
 *
 * ## Why the chapter list is in the prompt
 *
 * docs/05 §2 calls this grounding, and it is the difference between a tool and
 * a plausible-sounding mess. Asked to file a question into a chapter, an
 * unground model invents a chapter name that sounds like CBSE and is not one.
 * Given the actual syllabus with its actual slugs, the task stops being
 * generative and becomes a choice from a list — which is a far more reliable
 * thing to ask a model for, and a wrong answer is then visibly wrong rather
 * than merely unfamiliar.
 *
 * ## What the model is told it may not do
 *
 * Invent an answer. A great many real papers do not print their answer key, and
 * a model that fills the field anyway produces a marking scheme that looks
 * official, reads plausibly, and is wrong — which is worse than an empty field
 * in every way, because the empty field gets fixed.
 */

export interface PromptChapter {
  slug: string;
  name: string;
  topics: { slug: string; name: string }[];
}

export interface ExtractionPromptInput {
  subjectName: string;
  classLevel: number;
  chapters: PromptChapter[];
  /** The teacher's own hint about the paper, passed through verbatim. */
  notes: string | null;
}

/** Human labels for the type rules, so the prompt reads like instructions. */
function describeTypeRule(type: QuestionType): string {
  const rule = QUESTION_TYPE_RULES[type];
  const parts: string[] = [];

  if (rule.options === "required" && rule.optionCount) {
    const { min, max } = rule.optionCount;
    parts.push(
      min === max
        ? `exactly ${String(min)} options, labelled A onwards, with exactly one marked isCorrect`
        : `${String(min)}–${String(max)} options, labelled A onwards, with exactly one marked isCorrect`,
    );
    // Storing the key twice — as a flag and as a letter — means two things that
    // can disagree silently. The validator forbids it; so does the prompt.
    parts.push("leave correctValue null (the option flag is the answer)");
  } else {
    parts.push("no options");
  }

  if (rule.correctValue === "required") parts.push("answer.correctValue is required");
  if (rule.correctValue === "optional") {
    parts.push("answer.correctValue optional; a written solution is what matters");
  }

  if (rule.subParts === "required") {
    parts.push("2–6 subParts whose marks add up exactly to the question's marks");
  }

  if (rule.bodyMustMatch) parts.push(rule.bodyMustMatch.message);

  return `- ${type}: ${parts.join("; ")}.`;
}

export function buildExtractionSystemPrompt(input: ExtractionPromptInput): string {
  const typeRules = (Object.keys(QUESTION_TYPE_RULES) as QuestionType[])
    .map(describeTypeRule)
    .join("\n");

  const chapterList = input.chapters
    .map((chapter) => {
      const topics = chapter.topics.map((topic) => topic.slug).join(", ");
      return `- ${chapter.slug} — ${chapter.name}${topics ? `\n    topics: ${topics}` : ""}`;
    })
    .join("\n");

  return `You extract questions from CBSE Class ${String(input.classLevel)} ${input.subjectName} question papers into structured data for a teacher's question bank.

You are transcribing, not authoring. Every question you return must be one that is actually printed in the paper you were given, in the words it was printed in. Do not add questions, do not improve wording, do not translate, and do not fill in anything the paper does not contain.

# Output

Return JSON only: an object with a single "questions" array, in the order the questions appear in the paper. No prose, no markdown fence.

# Per-type requirements

Every question must satisfy the rules for its type, or it will be rejected:

${typeRules}

A question worth ${String(MARKING_SCHEME_REQUIRED_FROM_MARKS)} marks or more, that is not option-based, needs answer.markingScheme — an ordered list of {step, marks, keyPoints} whose marks sum to the question's marks. This is what a student self-evaluates against, so it must reflect how CBSE actually awards step marks.

# Filing each question

chapterSlug must be one of these exact slugs, or null if you genuinely cannot tell:

${chapterList}

topicSlugs must come from the chosen chapter's topic list. The first is the primary topic. An empty list is acceptable and better than a guess.

# Difficulty

EASY — direct recall or a one-step application of a stated formula.
MEDIUM — two or three steps, or applying a familiar idea to an unfamiliar situation.
HARD — multi-step, needs a non-obvious insight, or combines two chapters.

Judge the question, not its marks. A one-mark question can be hard.

# Answers

If the paper prints an answer key or marking scheme, use it exactly.

If it does not, you may work out the answer yourself for questions where the answer is determined by the question — a numerical, an MCQ, a fill-in-the-blank — and write the solution you derived. Set confidence below 0.6 for those and say so in "note", for example "answer worked out; not printed on the paper".

For subjective questions with no printed marking scheme, set answer to null. Do not invent a marking scheme. An empty answer is a five-second fix for the teacher; a fabricated one that reads plausibly may never be caught.

# Formatting

- Maths goes in LaTeX between $ delimiters: $x^2 + 5x + 6 = 0$.
- Keep SI units as printed.
- Match-the-following goes in a Markdown table so both columns render.
- Mark a blank with at least three underscores: ________
- A case study's stimulus is the parent's body; its questions are the subParts.

# Confidence and notes

Set "confidence" between 0 and 1 for every question — your own honest estimate that this row is correct and complete. Use "note" for anything a teacher should check: a diagram you could not read, a smudged number, an OR-choice you had to pick between. Notes are read by a person; write them as one short sentence.

# Diagrams

If a question depends on a figure you cannot reproduce as text, still extract the question, describe the figure in one line inside the body as [Figure: …], and say so in "note" with a confidence below 0.5.${
    input.notes
      ? `

# What the teacher told you about this paper

${input.notes}`
      : ""
  }`;
}

/**
 * The instruction that accompanies the file itself.
 *
 * Separate from the system prompt so the system half stays byte-identical
 * across every upload for one subject. That matters for cost the moment any
 * provider in the chain caches prompt prefixes: a system prompt carrying the
 * paper's own title would defeat it on every single request.
 */
export function buildExtractionUserInstruction(title: string): string {
  return `Extract every question from this paper ("${title}") as JSON.

Work through it in printed order and do not skip a question because it is hard to read — extract it with a low confidence and a note instead. If a question offers an internal choice ("OR"), extract the main question and mention the alternative in the note.`;
}

/**
 * The response schema, in the dialect intersection all three providers accept.
 *
 * Written by hand rather than generated from the Zod schema, and the reason is
 * worth stating because generating it looks obviously better: the two are not
 * the same artefact. This one is an *instruction* to a model, in a JSON Schema
 * subset that omits everything the providers disagree about — no `$ref`,
 * no `oneOf`, no `additionalProperties` on nested objects. The Zod schema is
 * the *gate*, and it enforces bounds this one cannot express.
 *
 * They are checked against each other by a test rather than by hope: the
 * extraction test parses a schema-shaped fixture through
 * `extractionResultSchema`, so a field added here and forgotten there fails.
 */
export const EXTRACTION_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          printedNumber: { type: "string", nullable: true },
          type: { type: "string", enum: Object.keys(QUESTION_TYPE_RULES) },
          body: { type: "string" },
          marks: { type: "integer" },
          difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
          bloomLevel: {
            type: "string",
            enum: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYSE", "EVALUATE", "CREATE"],
          },
          chapterSlug: { type: "string", nullable: true },
          topicSlugs: { type: "array", items: { type: "string" } },
          options: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                body: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["label", "body", "isCorrect"],
            },
          },
          answer: {
            type: "object",
            nullable: true,
            properties: {
              correctValue: { type: "string", nullable: true },
              solution: { type: "string" },
              explanation: { type: "string", nullable: true },
              unit: { type: "string", nullable: true },
              markingScheme: {
                type: "array",
                nullable: true,
                items: {
                  type: "object",
                  properties: {
                    step: { type: "string" },
                    marks: { type: "number" },
                    keyPoints: { type: "array", items: { type: "string" } },
                  },
                  required: ["step", "marks"],
                },
              },
            },
            required: ["solution"],
          },
          subParts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: { type: "string", enum: Object.keys(QUESTION_TYPE_RULES) },
                body: { type: "string" },
                marks: { type: "integer" },
                difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
                options: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      body: { type: "string" },
                      isCorrect: { type: "boolean" },
                    },
                    required: ["label", "body", "isCorrect"],
                  },
                },
                answer: {
                  type: "object",
                  nullable: true,
                  properties: {
                    correctValue: { type: "string", nullable: true },
                    solution: { type: "string" },
                    explanation: { type: "string", nullable: true },
                    unit: { type: "string", nullable: true },
                  },
                  required: ["solution"],
                },
              },
              required: ["type", "body", "marks"],
            },
          },
          confidence: { type: "number" },
          note: { type: "string", nullable: true },
        },
        required: ["type", "body", "marks", "difficulty", "confidence"],
      },
    },
  },
  required: ["questions"],
};
