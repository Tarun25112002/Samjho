import { z } from "zod";

/**
 * Reading a handwritten answer off a photograph.
 *
 * ## Why this is a separate step and not part of grading
 *
 * It would be one call: send the photo to the grader and let it mark what it
 * sees. It is two calls instead, and the reason is the whole design.
 *
 * Optical reading of handwritten mathematics is the weakest link in the chain.
 * A 7 read as a 1, a minus sign lost in a crease, an exponent read as a
 * coefficient — each of those produces a confident, specific, wrong mark, and a
 * student who only ever sees the mark has no way to find out which. So the
 * transcription is surfaced *before* anything is graded. The student reads back
 * what the machine thinks they wrote, fixes it if it is wrong, and only then
 * does the existing grading path run — against text they have confirmed.
 *
 * That also means this feature composes rather than duplicates. It produces the
 * same `text` a student would have typed, so every path downstream of the
 * answer field — auto-marking, self-evaluation, AI-assisted marking, the mistake
 * book — works unchanged and knows nothing about photographs.
 *
 * ## What is not stored
 *
 * The photograph. It is read, transcribed, and dropped; nothing writes the
 * image bytes to a database or a bucket. A photograph of a child's exercise
 * book, in a product whose every user is a minor (docs/07 R6), is a liability
 * we have no use for once the text is out of it.
 */

/**
 * Rough ceiling on the encoded image, in base64 characters.
 *
 * ~700 KB of base64 is ~525 KB of JPEG, which is a generous phone photograph
 * after the client downscales it — and it sits inside the 1 MB body limit with
 * room for the rest of the request. The client is expected to downscale; this
 * bound exists because a client that does not must be refused rather than
 * silently truncated.
 */
export const MAX_IMAGE_BASE64_CHARS = 700_000;

export const ANSWER_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const answerImageSchema = z.object({
  mimeType: z.enum(ANSWER_IMAGE_MIME_TYPES),
  /** Base64, without the `data:` prefix. The client strips it. */
  data: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
});

export type AnswerImage = z.infer<typeof answerImageSchema>;

export const transcribeAnswerSchema = z.object({
  /**
   * The question being answered.
   *
   * Not decoration. A transcriber that knows the question is solving a quadratic
   * resolves an ambiguous glyph towards `x²` rather than `x2`, and one that
   * knows the subject is Chemistry reads `H2O` correctly. The question body is
   * loaded server-side from this id — the client sends an id, never text.
   */
  questionId: z.string().min(1).max(60),
  image: answerImageSchema,
});

export type TranscribeAnswerInput = z.infer<typeof transcribeAnswerSchema>;

/**
 * How much of the page the reader is sure about.
 *
 * Drives what the UI says rather than whether it shows anything. A LOW-confidence
 * transcription is still worth showing — correcting three words is faster than
 * typing forty — but it is presented as a draft to check, not as a reading.
 */
export const transcriptionConfidenceSchema = z.enum(["LOW", "MEDIUM", "HIGH"]);
export type TranscriptionConfidence = z.infer<typeof transcriptionConfidenceSchema>;

export const answerTranscriptionSchema = z.object({
  /**
   * The student's working, as text, ready to go straight into the answer field.
   *
   * Mathematics comes back as LaTeX between `$…$`, because that is what every
   * other surface in this product renders and a transcription that arrived as
   * `x^2` would display as `x^2`.
   */
  text: z.string().max(6_000),
  confidence: transcriptionConfidenceSchema,
  /**
   * What could not be read, in one sentence. Empty when the page was clean.
   *
   * The most important field when it is non-empty: "the third line is cut off
   * at the right edge" tells the student to retake the photo, which no amount
   * of confidence scoring does.
   */
  caveat: z.string().max(300),
  /**
   * False when no model read the image and this is an empty placeholder.
   *
   * The student then types as they always have. Nothing about the page pretends
   * a reading happened.
   */
  generated: z.boolean(),
});

export type AnswerTranscription = z.infer<typeof answerTranscriptionSchema>;
