import { z } from "zod";

import { questionOptionInputSchema } from "../question/admin.schema.js";
import {
  bloomLevelSchema,
  difficultySchema,
  questionStatusSchema,
  questionTypeSchema,
} from "../question/question-enums.js";
import { markingStepSchema, multiValue } from "../question/question.schema.js";

/**
 * Uploading a question paper, and reviewing what the model made of it.
 *
 * ## Why this has three steps rather than one
 *
 * A teacher has a PDF. They want the questions in it. The tempting design is one
 * endpoint that takes the file and returns a filled question bank, and it is the
 * wrong one for a reason that is not engineering taste:
 *
 * **A model reading a scanned paper is confidently wrong in exactly the places a
 * teacher is instantly right.** It transcribes the questions well — transcribing
 * is what these models are best at. What it *guesses* is everything the paper
 * does not print: which chapter a question belongs to, how hard it is, which
 * topic it assesses. Those are also the fields the whole product runs on, and a
 * wrong difficulty tag does not fail loudly. It quietly skews every practice set
 * drawn from that chapter, for as long as nobody re-reads it.
 *
 * So: **upload → review → import.** The model proposes, the teacher disposes,
 * and only `ACCEPTED` rows are written. A teacher who uploads a paper and never
 * opens the review screen has imported nothing — which is the correct outcome,
 * not a missing feature.
 *
 * ## Why the payload is validated twice, against the same schema
 *
 * An extracted question is stored loosely and parsed against
 * `writeQuestionInputSchema` at import — the same schema that validates a
 * question typed into the admin form. That is the pattern
 * `question.import.service.ts` established, for the identical reason: one
 * validator, three doors. An MCQ the model gave two correct options is rejected
 * by the same code that rejects one an editor typed that way.
 */

// ── Enums crossing the wire ──────────────────────────────────────────────────

export const paperUploadSourceKindSchema = z.enum(["PDF", "IMAGE", "TEXT"]);
export type PaperUploadSourceKind = z.infer<typeof paperUploadSourceKindSchema>;

export const paperUploadStatusSchema = z.enum([
  "UPLOADED",
  "EXTRACTING",
  "READY",
  "FAILED",
  "IMPORTED",
]);
export type PaperUploadStatus = z.infer<typeof paperUploadStatusSchema>;

export const extractedQuestionStatusSchema = z.enum([
  "PROPOSED",
  "ACCEPTED",
  "REJECTED",
  "IMPORTED",
]);
export type ExtractedQuestionStatus = z.infer<typeof extractedQuestionStatusSchema>;

// ── Uploading ────────────────────────────────────────────────────────────────

/**
 * The ceiling on an upload, in bytes of the original file.
 *
 * 8MB is roughly forty pages of scanned CBSE paper at the resolution a school
 * photocopier produces — comfortably more than one paper, and less than a year
 * of them. It is checked in three places on the way in: the browser, this
 * schema, and the route's own body limit. The first is a courtesy, the second is
 * the contract, and only the third is a control.
 *
 * Base64 costs a third on top, which is why the route's JSON limit has to exceed
 * this number. See `apps/api/src/app.ts` for where that is set, and why it is
 * scoped to one route rather than raising the global limit for everything.
 */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** How much pasted text the extractor will read in one pass. */
export const MAX_UPLOAD_TEXT_LENGTH = 200_000;

const uploadTitleSchema = z.string().trim().min(2).max(120);

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${String(Math.round(bytes / 1024))}KB`;
}

/**
 * A file arrives as base64 in a JSON body rather than as multipart.
 *
 * The API has one body parser and one CSRF posture, both of which the BFF
 * already understands. Multipart would add a second parser, a second size limit,
 * a temp-file lifecycle, and a second way for a request to reach a route without
 * passing the checks the first path applies. For a file this size, over a proxy
 * that is already buffering the whole body, base64's 33% is the cheaper price.
 */
export const uploadPaperInputSchema = z
  .object({
    subjectId: z.string().min(1).max(60),
    title: uploadTitleSchema,
    sourceKind: paperUploadSourceKindSchema,

    /** Base64, with no data-URL prefix. Required for PDF and IMAGE. */
    fileData: z.string().min(1).optional(),
    fileName: z.string().trim().max(200).optional(),
    mimeType: z.string().trim().max(120).optional(),

    /** Required for TEXT: the paper typed or pasted in. */
    text: z.string().trim().min(40).max(MAX_UPLOAD_TEXT_LENGTH).optional(),

    /**
     * A hint passed to the model verbatim — "this is the 2019 pre-board, the
     * answer key is on the last two pages". Optional, and worth having: the most
     * useful thing a teacher knows that the file does not say is where the
     * answers are.
     */
    notes: z.string().trim().max(600).optional(),
  })
  .check((ctx) => {
    const value = ctx.value;

    if (value.sourceKind === "TEXT") {
      if (!value.text) {
        ctx.issues.push({
          code: "custom",
          input: value.text,
          path: ["text"],
          message: "paste the paper's text, or upload the file instead",
        });
      }
      return;
    }

    if (!value.fileData) {
      ctx.issues.push({
        code: "custom",
        input: value.fileData,
        path: ["fileData"],
        message: "choose a file to upload",
      });
      return;
    }

    // Base64 inflates by 4/3. Checking the *decoded* size means the error names
    // the size of the file the teacher actually chose, rather than a number a
    // third larger that matches nothing on their screen.
    const decodedBytes = Math.floor((value.fileData.length * 3) / 4);
    if (decodedBytes > MAX_UPLOAD_BYTES) {
      ctx.issues.push({
        code: "custom",
        input: decodedBytes,
        path: ["fileData"],
        message: `that file is ${formatBytes(decodedBytes)} — the limit is ${formatBytes(
          MAX_UPLOAD_BYTES,
        )}. Split the paper, or upload just the pages you need.`,
      });
    }
  });

export type UploadPaperInput = z.infer<typeof uploadPaperInputSchema>;

/** MIME types the extractor can read, mapped to how they reach the model. */
export const SUPPORTED_UPLOAD_MIME_TYPES = {
  "application/pdf": "PDF",
  "image/jpeg": "IMAGE",
  "image/png": "IMAGE",
  "image/webp": "IMAGE",
  "image/gif": "IMAGE",
  "text/plain": "TEXT",
} as const satisfies Record<string, PaperUploadSourceKind>;

export type SupportedUploadMimeType = keyof typeof SUPPORTED_UPLOAD_MIME_TYPES;

export function isSupportedUploadMimeType(value: string): value is SupportedUploadMimeType {
  return value in SUPPORTED_UPLOAD_MIME_TYPES;
}

/** The accept attribute and the server allow-list, from one definition. */
export const UPLOAD_ACCEPT_ATTRIBUTE = Object.keys(SUPPORTED_UPLOAD_MIME_TYPES).join(",");

// ── What the model returns ───────────────────────────────────────────────────

const extractedAnswerSchema = z.object({
  correctValue: z.string().trim().max(2000).nullable().default(null),
  solution: z.string().trim().max(8000),
  explanation: z.string().trim().max(4000).nullable().default(null),
  markingScheme: z.array(markingStepSchema).max(20).nullable().default(null),
  unit: z.string().trim().max(40).nullable().default(null),
});

/**
 * One extracted question, as the model produces it.
 *
 * Note what is *not* here: ids. The model names a chapter by slug, chosen from a
 * list the prompt supplied, and the server resolves it. A model free to emit a
 * chapter id would produce a foreign key that either fails at write or — far
 * worse — happens to hit a real row in a different subject.
 *
 * Note also what is nullable. `answer` is, because a great many real papers do
 * not print their answer key, and an extractor that invents a marking scheme to
 * satisfy a required field is strictly worse than one that says so. Those rows
 * sort to the top of the review queue.
 */
export const extractedQuestionPayloadSchema = z.object({
  printedNumber: z.string().trim().max(20).nullable().default(null),
  type: questionTypeSchema,
  body: z.string().trim().min(1).max(10_000),
  marks: z.int().min(1).max(20),
  difficulty: difficultySchema,
  bloomLevel: bloomLevelSchema.default("UNDERSTAND"),

  /** Chapter slug, chosen from the list the prompt supplied. */
  chapterSlug: z.string().trim().max(120).nullable().default(null),
  /** Topic slugs within that chapter. The first is the primary one. */
  topicSlugs: z.array(z.string().trim().max(120)).max(5).default([]),

  options: z.array(questionOptionInputSchema).max(6).default([]),
  answer: extractedAnswerSchema.nullable().default(null),

  /** Sub-parts of a case study. Same shape, without the recursion. */
  subParts: z
    .array(
      z.object({
        type: questionTypeSchema,
        body: z.string().trim().min(1).max(10_000),
        marks: z.int().min(1).max(20),
        difficulty: difficultySchema.default("MEDIUM"),
        options: z.array(questionOptionInputSchema).max(6).default([]),
        answer: extractedAnswerSchema.nullable().default(null),
      }),
    )
    .max(6)
    .default([]),

  /** 0–1. Drives the review order: least confident first. */
  confidence: z.number().min(0).max(1).nullable().default(null),
  /** Written for the teacher, not for a log. */
  note: z.string().trim().max(300).nullable().default(null),
});

export type ExtractedQuestionPayload = z.infer<typeof extractedQuestionPayloadSchema>;

/** The whole model response. Capped so one paper cannot become one thousand. */
export const extractionResultSchema = z.object({
  questions: z.array(extractedQuestionPayloadSchema).max(120),
});

export type ExtractionResult = z.infer<typeof extractionResultSchema>;

// ── Reading uploads back ─────────────────────────────────────────────────────

export const paperUploadSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  subject: z.object({ id: z.string(), name: z.string(), code: z.string() }),
  sourceKind: paperUploadSourceKindSchema,
  fileName: z.string().nullable(),
  status: paperUploadStatusSchema,
  error: z.string().nullable(),
  extractedCount: z.int().nonnegative(),
  acceptedCount: z.int().nonnegative(),
  importedCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  completedAt: z.iso.datetime().nullable(),
});

export type PaperUploadSummary = z.infer<typeof paperUploadSummarySchema>;

export const paperUploadListSchema = z.object({
  uploads: z.array(paperUploadSummarySchema),
  /**
   * Whether this server can actually read a paper.
   *
   * Returned with the list rather than inferred by the web app from its own
   * environment, because it is a fact about the *API's* configuration and the
   * web app has no way to know it. A deployment with no provider key is
   * legitimate — a demo, a CI run, a cost freeze — and the honest thing is for
   * the upload screen to say so up front instead of offering a button that
   * answers 503.
   */
  aiConfigured: z.boolean(),
});

export type PaperUploadList = z.infer<typeof paperUploadListSchema>;

/**
 * One row in the review screen.
 *
 * `payload` comes back whole — answer key included — and that is right here in a
 * way it is not on any student route. A teacher reviewing a marking scheme
 * cannot approve questions whose answers are hidden from them. The protection is
 * that the route is teacher-only and scoped to uploads they own, not that the
 * field is stripped.
 */
export const extractedQuestionSchema = z.object({
  id: z.string().min(1),
  orderIndex: z.int().nonnegative(),
  printedNumber: z.string().nullable(),
  type: questionTypeSchema,
  difficulty: difficultySchema,
  marks: z.int().positive(),
  confidence: z.number().nullable(),
  note: z.string().nullable(),
  status: extractedQuestionStatusSchema,
  questionId: z.string().nullable(),
  chapter: z.object({ id: z.string(), name: z.string() }).nullable(),
  payload: extractedQuestionPayloadSchema,
});

export type ExtractedQuestion = z.infer<typeof extractedQuestionSchema>;

export const uploadChapterSchema = z.object({
  id: z.string(),
  name: z.string(),
  topics: z.array(z.object({ id: z.string(), name: z.string() })),
});

export const paperUploadDetailSchema = paperUploadSummarySchema.extend({
  notes: z.string().nullable(),
  model: z.string().nullable(),
  /**
   * The subject's chapters, sent with the upload rather than fetched separately.
   *
   * The review screen's main job is re-filing questions into the right chapter,
   * so the picker's options are part of the screen — not a second round trip
   * that leaves every dropdown empty for the first frame.
   */
  chapters: z.array(uploadChapterSchema),
  items: z.array(extractedQuestionSchema),
});

export type PaperUploadDetail = z.infer<typeof paperUploadDetailSchema>;

// ── Reviewing ────────────────────────────────────────────────────────────────

/**
 * A teacher's correction to one extracted question.
 *
 * Every field optional, at least one required — the same shape as profile
 * editing, for the same reason. The common action is changing one dropdown, and
 * a PATCH that demands the whole object turns "this is actually HARD" into a
 * round trip that can silently revert the four fields the caller never thought
 * about.
 */
export const updateExtractedQuestionSchema = z
  .object({
    status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED"]).optional(),
    chapterId: z.string().min(1).max(60).nullable().optional(),
    topicIds: z.array(z.string().min(1).max(60)).max(5).optional(),
    difficulty: difficultySchema.optional(),
    type: questionTypeSchema.optional(),
    marks: z.int().min(1).max(20).optional(),
    body: z.string().trim().min(1).max(10_000).optional(),
    solution: z.string().trim().min(1).max(8000).optional(),
  })
  .check((ctx) => {
    if (Object.values(ctx.value).every((value) => value === undefined)) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value,
        path: [],
        message: "provide at least one field to update",
      });
    }
  });

export type UpdateExtractedQuestionInput = z.infer<typeof updateExtractedQuestionSchema>;

/** Accept or reject in bulk — what a teacher does after skimming the list. */
export const bulkReviewExtractedSchema = z.object({
  itemIds: z.array(z.string().min(1).max(60)).min(1).max(200),
  status: z.enum(["PROPOSED", "ACCEPTED", "REJECTED"]),
});

export type BulkReviewExtractedInput = z.infer<typeof bulkReviewExtractedSchema>;

/**
 * How many rows the bulk review actually changed.
 *
 * Reported rather than assumed equal to the ids sent, because two of them are
 * legitimately skipped: a row already imported is settled, and a row belonging
 * to another teacher's upload is not matched at all. Returning a count lets the
 * caller notice the difference without the server having to say which ids
 * exist.
 */
export const bulkReviewResultSchema = z.object({ updated: z.int().nonnegative() });
export type BulkReviewResult = z.infer<typeof bulkReviewResultSchema>;

// ── Importing ────────────────────────────────────────────────────────────────

/**
 * Commit the accepted questions into the teacher's own bank.
 *
 * `dryRun` defaults to **true**, exactly as bulk import does and for the same
 * reason: checking is the default and writing is the opt-in, because this is an
 * operation people run half-attentively at the end of a long day.
 */
export const importUploadInputSchema = z.object({
  dryRun: z.boolean().default(true),
});

export type ImportUploadInput = z.infer<typeof importUploadInputSchema>;

export const importUploadResultSchema = z.object({
  dryRun: z.boolean(),
  /** Rows marked ACCEPTED, and therefore considered by this run. */
  considered: z.int().nonnegative(),
  valid: z.int().nonnegative(),
  written: z.int().nonnegative(),
  /** Rows an earlier run already imported — skipped, not doubled. */
  alreadyImported: z.int().nonnegative(),
  errors: z.array(
    z.object({
      itemId: z.string(),
      printedNumber: z.string().nullable(),
      issues: z.array(z.object({ path: z.string(), message: z.string() })),
    }),
  ),
});

export type ImportUploadResult = z.infer<typeof importUploadResultSchema>;

export const createUploadResponseSchema = z.object({ uploadId: z.string().min(1) });

// ── The teacher's question bank ──────────────────────────────────────────────

/**
 * Browsing what the uploads produced.
 *
 * This is the "separated by difficulty, chapter and subject" surface, and it is
 * a filter over one table rather than a set of pre-built buckets. Buckets look
 * tidier in a mock-up and break the first time a teacher wants "hard numericals
 * from Electricity worth three marks" — which is the actual question someone
 * building a worksheet asks.
 */
export const teacherBankQuerySchema = z.object({
  subjectId: z.string().min(1).optional(),
  chapterId: z.string().min(1).optional(),
  topicId: z.string().min(1).optional(),
  type: multiValue(questionTypeSchema).optional(),
  difficulty: multiValue(difficultySchema).optional(),
  status: multiValue(questionStatusSchema).optional(),
  marks: z.coerce.number().int().positive().optional(),
  uploadId: z.string().min(1).optional(),
  search: z.string().trim().min(2).max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type TeacherBankQuery = z.infer<typeof teacherBankQuerySchema>;

export const teacherBankQuestionSchema = z.object({
  id: z.string().min(1),
  type: questionTypeSchema,
  body: z.string(),
  marks: z.int().positive(),
  difficulty: difficultySchema,
  bloomLevel: bloomLevelSchema,
  status: questionStatusSchema,
  subject: z.object({ id: z.string(), name: z.string(), code: z.string() }),
  chapter: z.object({ id: z.string(), name: z.string() }),
  topics: z.array(z.string()),
  hasAnswer: z.boolean(),
  subPartCount: z.int().nonnegative(),
  sourceTitle: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type TeacherBankQuestion = z.infer<typeof teacherBankQuestionSchema>;

/**
 * The counts beside the filters.
 *
 * Returned with the page rather than from a second endpoint, because a filter UI
 * that cannot say "Hard (12)" before you click it makes a teacher try every
 * combination to find out which ones have anything behind them.
 *
 * Each facet is counted with the *other* filters applied but not its own, which
 * is what makes the difficulty counts still useful after a difficulty is chosen:
 * a facet that counted itself would always read "Hard (12), Easy (0), Medium (0)"
 * and the teacher could never see what switching would give them.
 */
export const teacherBankFacetsSchema = z.object({
  total: z.int().nonnegative(),
  byDifficulty: z.array(z.object({ difficulty: difficultySchema, count: z.int().nonnegative() })),
  byType: z.array(z.object({ type: questionTypeSchema, count: z.int().nonnegative() })),
  byChapter: z.array(
    z.object({ chapterId: z.string(), chapterName: z.string(), count: z.int().nonnegative() }),
  ),
  byMarks: z.array(z.object({ marks: z.int().positive(), count: z.int().nonnegative() })),
});

export type TeacherBankFacets = z.infer<typeof teacherBankFacetsSchema>;

export const teacherBankResponseSchema = z.object({
  items: z.array(teacherBankQuestionSchema),
  facets: teacherBankFacetsSchema,
  pageInfo: z.object({ hasMore: z.boolean(), nextCursor: z.string().nullable() }),
});

export type TeacherBankResponse = z.infer<typeof teacherBankResponseSchema>;

/**
 * Changing the status of a question a teacher owns.
 *
 * The vocabulary is the shared one; the reach is not. A `PUBLISHED` question
 * with an owner is visible to that teacher's assignments and to nothing else —
 * `STUDENT_VISIBLE_QUESTION` filters on the owner being null, which is what
 * stops this becoming a back door into every student's practice.
 */
export const teacherQuestionStatusSchema = z.object({
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
});

export type TeacherQuestionStatusInput = z.infer<typeof teacherQuestionStatusSchema>;
