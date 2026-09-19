import {
  answerTranscriptionSchema,
  type AnswerImage,
  type AnswerTranscription,
} from "@samjho/contracts";
import { z } from "zod";

import { logger } from "../../lib/logger.js";
import { aiIsConfigured, completeWithChain } from "./provider/registry.js";

/**
 * Reading handwriting off a photograph.
 *
 * ## The one thing this prompt exists to prevent
 *
 * A transcriber that helps. Asked to read a student's working, a capable model
 * will quietly fix the arithmetic on the way past — it has seen ten million
 * correct solutions to this question and one incorrect one, and the correct one
 * is what comes out. That is catastrophic here: the student's mistake is the
 * only thing on the page worth having, and a transcription that repairs it
 * produces an answer marked correct that the student did not write.
 *
 * So most of the system prompt below is about copying rather than reading, and
 * the instruction appears in three different framings because a single "do not
 * correct errors" loses to the model's training.
 *
 * ## Why the question is in the prompt
 *
 * Handwriting is ambiguous and context resolves it. `x2` on a page about
 * quadratics is `x²`; the same glyph pair in a Chemistry answer is a subscript.
 * The question body costs a few hundred tokens and removes a whole class of
 * error.
 *
 * The answer key is *not* in the prompt, and that is deliberate — it is the
 * strongest possible invitation to transcribe the right answer instead of the
 * written one. This is the only AI path in the module that is denied the key.
 */

const MAX_TOKENS = 1_500;
/** Zero. There is one correct reading of a page, and it is not a creative task. */
const TEMPERATURE = 0;
const MAX_TEXT_CHARS = 6_000;

const SYSTEM = `
You are transcribing a photograph of a student's handwritten answer into text. You are a copyist, not a teacher and not an examiner.

WHAT YOU ARE DOING
- Copy out exactly what is written on the page, line by line, in the order it appears.
- Preserve the student's own working, including every intermediate line, even where it is redundant.

WHAT YOU MUST NOT DO — THIS IS THE WHOLE JOB
- Do not correct anything. If the page says 7 x 8 = 54, you write 7 x 8 = 54.
- Do not complete anything. If the working stops halfway, your transcription stops halfway.
- Do not improve, tidy, reorder, or fill in a step the student skipped.
- Do not solve the question. You are not being asked for the answer; you are being asked what is on the paper.
- If you find yourself writing something you did not see on the page, you have made a mistake.

The student's errors are the only valuable thing here. A transcription that silently repairs them is worse than no transcription at all, because it will be marked correct and the student will never learn that they got it wrong.

HOW TO WRITE IT
- Mathematics as LaTeX between single dollar signs. Chemistry formulae the same way.
- One line of the page per line of output. Keep the student's line breaks; they are how the working reads.
- Crossed-out work is omitted unless nothing replaced it.
- A word you cannot read becomes [?]. Do not guess at it, and do not leave it out silently.

CONFIDENCE
- HIGH: the whole page is legible and you are sure of every character.
- MEDIUM: readable, with a few characters you inferred from context.
- LOW: parts are cut off, blurred, or genuinely illegible.

CAVEAT
- One sentence, only when something is wrong with the photograph itself — cut off at an edge, too blurred to read, a page that does not appear to contain an answer. Empty otherwise.
- Say which part, so the student knows whether to retake the photograph.
`.trim();

const modelOutputSchema = z.object({
  text: z.string(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]),
  caveat: z.string().optional(),
});

const MODEL_JSON_SCHEMA = {
  name: "answer_transcription",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["text", "confidence", "caveat"],
    properties: {
      text: { type: "string", description: "The page, copied out verbatim." },
      confidence: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] },
      caveat: { type: "string", description: "One sentence, or empty." },
    },
  },
} as const;

export interface TranscribeRequest {
  questionId: string;
  questionBody: string;
  subjectName: string;
  classLevel: number;
  image: AnswerImage;
}

/** What the student gets when nothing read the page: an empty field, honestly. */
const NOT_READ: AnswerTranscription = {
  text: "",
  confidence: "LOW",
  caveat: "",
  generated: false,
};

export const aiTranscribe = {
  async read(request: TranscribeRequest): Promise<AnswerTranscription> {
    if (!aiIsConfigured()) return NOT_READ;

    try {
      const response = await completeWithChain(
        {
          tier: "strong",
          system: SYSTEM,
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: describe(request) },
                { type: "image", mimeType: request.image.mimeType, data: request.image.data },
              ],
            },
          ],
          maxTokens: MAX_TOKENS,
          temperature: TEMPERATURE,
          jsonSchema: MODEL_JSON_SCHEMA,
        },
        // Not a preference. A provider without vision cannot see this request at
        // all, so the chain skips it rather than failing over from a 400.
        { images: true },
      );

      const parsed = modelOutputSchema.safeParse(readJson(response.text));
      if (!parsed.success) {
        logger.warn(
          { questionId: request.questionId, issues: parsed.error.issues.length },
          "Transcriber returned output that did not match the schema",
        );
        return NOT_READ;
      }

      return finalise(parsed.data);
    } catch (error) {
      logger.warn(
        { err: error, questionId: request.questionId },
        "Transcription failed; degrading",
      );
      return NOT_READ;
    }
  },
};

/**
 * Clamp the reading, and let an empty page be an empty page.
 *
 * A model handed a photograph of a blank sheet sometimes returns prose about
 * how there is nothing there. That text would land in the student's answer
 * field and be marked, so a transcription with no content comes back empty with
 * the explanation moved into the caveat — where it belongs, and where it cannot
 * be graded.
 */
function finalise(output: z.infer<typeof modelOutputSchema>): AnswerTranscription {
  const text = output.text.trim().slice(0, MAX_TEXT_CHARS);
  const caveat = (output.caveat ?? "").trim().slice(0, 300);
  const empty = text.length === 0;

  return answerTranscriptionSchema.parse({
    text,
    confidence: empty ? "LOW" : output.confidence,
    caveat: empty && caveat.length === 0 ? "Nothing could be read from that photo." : caveat,
    generated: true,
  });
}

/**
 * The text part of the message: what question this page is answering.
 *
 * Fenced, because the question body is authored content and the instruction not
 * to answer it has to survive a question that itself says "explain your
 * reasoning". Everything inside the fence describes the page; none of it is an
 * instruction to follow.
 */
function describe(request: TranscribeRequest): string {
  return [
    `The photograph is a student's handwritten answer to the question below, from CBSE Class ${String(request.classLevel)} ${request.subjectName}.`,
    "",
    "The question is given only so that you can resolve ambiguous handwriting. Do not answer it, and do not let it influence what you read — if the page disagrees with the question, the page is what you transcribe.",
    "",
    "<question>",
    request.questionBody.trim().slice(0, 2_000),
    "</question>",
    "",
    "Now copy out what is written on the photograph.",
  ].join("\n");
}

function readJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/u.exec(trimmed);
  const candidate = fenced?.[1] ?? trimmed;

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}
