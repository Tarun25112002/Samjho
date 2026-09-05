import {
  extractionResultSchema,
  type ExtractedQuestionPayload,
  type PaperUploadSourceKind,
} from "@samjho/contracts";

import { logger } from "../../lib/logger.js";
import { completeWithChain } from "../ai/provider/registry.js";
import type { ChatMessage, ContentPart } from "../ai/provider/types.js";
import {
  buildExtractionSystemPrompt,
  buildExtractionUserInstruction,
  EXTRACTION_JSON_SCHEMA,
  type PromptChapter,
} from "./extraction.prompt.js";

/**
 * Running one paper through a model and getting questions back.
 *
 * The whole file is one function and a parser, and the parser is the
 * interesting half. Two decisions in it are worth reading before changing:
 *
 * **The output is parsed defensively, then validated by Zod.** Providers are
 * asked for schema-constrained JSON and mostly deliver it, but "mostly" is not
 * a property to build on: models wrap JSON in markdown fences, prepend "Here is
 * the JSON:", and occasionally emit a trailing comma. Stripping that is five
 * lines and turns a whole failed extraction — a teacher's file, their wait, and
 * a real bill — into a success. The Zod parse afterwards is the actual gate.
 *
 * **One repair attempt, not a retry loop.** If the parse fails, the model is
 * shown its own output and the error and asked to fix it, once. A second
 * failure means something is wrong with the paper or the prompt, and looping
 * would spend a teacher's afternoon and our money rediscovering that.
 */

export interface ExtractionInput {
  subjectName: string;
  classLevel: number;
  chapters: PromptChapter[];
  title: string;
  notes: string | null;
  sourceKind: PaperUploadSourceKind;
  /** Base64 for PDF and IMAGE; the text itself for TEXT. */
  content: string;
  mimeType: string | null;
  fileName: string | null;
}

export interface ExtractionOutcome {
  questions: ExtractedQuestionPayload[];
  model: string;
  provider: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

/**
 * Output ceiling for one paper.
 *
 * A 40-question paper with marking schemes runs to roughly 25k tokens of JSON.
 * 32k leaves headroom without inviting a model to keep going: the cap is a
 * safety net against a runaway generation, not a target, and a paper that needs
 * more than this is one a teacher should be splitting anyway.
 */
const MAX_OUTPUT_TOKENS = 32_000;

export const extractionService = {
  async extract(input: ExtractionInput): Promise<ExtractionOutcome> {
    const system = buildExtractionSystemPrompt({
      subjectName: input.subjectName,
      classLevel: input.classLevel,
      chapters: input.chapters,
      notes: input.notes,
    });

    const messages: ChatMessage[] = [{ role: "user", content: buildPaperContent(input) }];

    const first = await completeWithChain(
      {
        tier: "strong",
        system,
        messages,
        maxTokens: MAX_OUTPUT_TOKENS,
        // Transcription, not authoring. There is one right reading of a printed
        // paper, and temperature is the knob that invents a second one.
        temperature: 0.1,
        jsonSchema: { name: "extracted_questions", schema: EXTRACTION_JSON_SCHEMA },
      },
      {
        documents: input.sourceKind === "PDF",
        images: input.sourceKind === "IMAGE",
      },
    );

    const parsed = parseExtraction(first.text);
    if (parsed.ok) {
      return {
        questions: parsed.questions,
        model: first.model,
        provider: first.provider,
        inputTokens: first.promptTokens,
        outputTokens: first.completionTokens,
      };
    }

    logger.warn(
      { provider: first.provider, reason: parsed.reason },
      "Paper extraction returned unusable JSON; asking the model to repair it",
    );

    // The repair turn carries the model's own output back to it. Re-sending the
    // paper would double the input bill for a problem that is entirely in the
    // response, and on a scanned PDF that is by far the larger half.
    const repaired = await completeWithChain(
      {
        tier: "strong",
        system,
        messages: [
          ...messages,
          { role: "assistant", content: first.text.slice(0, 60_000) },
          {
            role: "user",
            content: `That response could not be parsed: ${parsed.reason}

Return the corrected JSON object only — no fence, no commentary. Keep every question you already extracted; fix only what is malformed.`,
          },
        ],
        maxTokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
        jsonSchema: { name: "extracted_questions", schema: EXTRACTION_JSON_SCHEMA },
      },
      { documents: false, images: false },
    );

    const second = parseExtraction(repaired.text);
    if (!second.ok) {
      throw new ExtractionFormatError(second.reason);
    }

    return {
      questions: second.questions,
      model: repaired.model,
      provider: repaired.provider,
      // Both calls are billed, so both are reported. Recording only the second
      // would make a repaired extraction look cheaper than a clean one.
      inputTokens: sumTokens(first.promptTokens, repaired.promptTokens),
      outputTokens: sumTokens(first.completionTokens, repaired.completionTokens),
    };
  },
};

/** The model produced something we could not turn into questions, twice. */
export class ExtractionFormatError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ExtractionFormatError";
  }
}

/**
 * The paper itself, as content parts.
 *
 * A PDF and a photograph go as attachments the model reads directly; pasted
 * text goes inline. The instruction comes *after* the file in the parts array,
 * which is not cosmetic: attention to an instruction that trails a large
 * document is measurably better than to one buried in front of it.
 */
function buildPaperContent(input: ExtractionInput): ContentPart[] {
  const instruction: ContentPart = {
    type: "text",
    text: buildExtractionUserInstruction(input.title),
  };

  if (input.sourceKind === "TEXT") {
    return [
      {
        type: "text",
        // Fenced so a paper containing the word "JSON" or a stray brace cannot
        // read as an instruction. The tutor's prompt module fences student text
        // for the same reason; this is the same threat with a bigger payload.
        text: `<paper>\n${input.content}\n</paper>`,
      },
      instruction,
    ];
  }

  if (input.sourceKind === "IMAGE") {
    return [
      { type: "image", mimeType: input.mimeType ?? "image/jpeg", data: input.content },
      instruction,
    ];
  }

  return [
    {
      type: "document",
      mimeType: input.mimeType ?? "application/pdf",
      data: input.content,
      fileName: input.fileName ?? "paper.pdf",
    },
    instruction,
  ];
}

type ParseOutcome =
  { ok: true; questions: ExtractedQuestionPayload[] } | { ok: false; reason: string };

/**
 * Model output → validated questions.
 *
 * Exported for the test, which is where the fence-stripping and the
 * "questions": [...] recovery earn their keep — every one of those branches is
 * a real thing a model did, not a defensive hypothetical.
 */
export function parseExtraction(text: string): ParseOutcome {
  const json = extractJsonObject(text);
  if (json === null) return { ok: false, reason: "the response contained no JSON object" };

  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (error) {
    return {
      ok: false,
      reason: error instanceof Error ? error.message : "the response was not valid JSON",
    };
  }

  const result = extractionResultSchema.safeParse(raw);
  if (!result.success) {
    // Only the first few issues. A model that got the shape wrong got it wrong
    // the same way forty times, and forty copies of one message is a repair
    // prompt the model has to read past rather than act on.
    const reason = result.error.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    return { ok: false, reason };
  }

  return { ok: true, questions: result.data.questions };
}

/**
 * Find the JSON object in a response that may be wrapped in prose or a fence.
 *
 * Brace-matching rather than a regex, because the payload contains LaTeX and
 * Markdown tables full of braces and a lazy or greedy match gets both wrong.
 * String literals are tracked so a `{` inside a question body does not shift
 * the depth count — which is exactly what happens on the first paper containing
 * a set like $\{1, 2, 3\}$.
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (character === "\\") {
      escaped = true;
      continue;
    }

    if (character === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  // Unbalanced: the response was truncated, almost always by max_tokens. The
  // caller reports it as a format failure, and the repair turn is what recovers
  // the questions that did arrive.
  return null;
}

function sumTokens(left: number | null, right: number | null): number | null {
  if (left === null && right === null) return null;
  return (left ?? 0) + (right ?? 0);
}
