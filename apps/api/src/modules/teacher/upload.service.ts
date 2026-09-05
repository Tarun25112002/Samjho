import {
  defaultExpectedTimeSeconds,
  extractedQuestionPayloadSchema,
  isSupportedUploadMimeType,
  publicationBlockers,
  SUPPORTED_UPLOAD_MIME_TYPES,
  writeQuestionInputSchema,
  type BulkReviewExtractedInput,
  type ExtractedQuestion,
  type ExtractedQuestionPayload,
  type ImportUploadInput,
  type ImportUploadResult,
  type PaperUploadDetail,
  type PaperUploadSummary,
  type UpdateExtractedQuestionInput,
  type UploadPaperInput,
  type WriteQuestionInput,
} from "@samjho/contracts";
import type { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import {
  ConflictError,
  NotFoundError,
  ServiceUnavailableError,
  ValidationError,
} from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";
import { aiIsConfigured } from "../ai/provider/registry.js";
import { questionAdminRepository } from "../questions/question.admin.repository.js";
import { hashQuestionContent } from "../questions/question.admin.service.js";
import { extractionService, ExtractionFormatError } from "./extraction.service.js";
import {
  uploadRepository,
  type UploadDetailRow,
  type UploadSummaryRow,
} from "./upload.repository.js";

/**
 * The paper-upload flow: accept a file, read it, let a teacher fix it, import it.
 *
 * ## Why extraction runs in the background
 *
 * Reading a forty-question scanned paper takes a model one to three minutes. An
 * HTTP request that waits for it is a request that dies to a proxy timeout
 * somewhere between the browser, Next's BFF and Express — and the teacher is
 * told the upload failed while the extraction quietly finishes and charges us
 * for output nobody reads.
 *
 * So the upload returns as soon as the file is stored, the job runs detached,
 * and the row's status is what the client polls. That makes `EXTRACTING` a real
 * database state rather than an implementation detail, which is also what makes
 * the failure modes describable: a job that dies with the process leaves a row
 * that says `EXTRACTING` and stops changing, and `reapStaleExtraction` turns
 * that into an honest `FAILED` the next time anyone looks.
 *
 * The job is in-process, and that is a deliberate limit rather than an
 * oversight. A queue would survive restarts and spread work across instances,
 * and this feature does not yet have the volume to justify one. The two things
 * that make the shortcut safe are that the work is idempotent — the file is
 * kept, so re-running is a button — and that its absence is visible rather than
 * silent.
 *
 * ## Why import is a second, explicit step
 *
 * See `upload.schema.ts`. In short: the model transcribes well and *guesses*
 * chapter and difficulty, those two fields drive everything downstream, and a
 * teacher corrects them in seconds.
 */

/** An extraction that has not moved in this long was abandoned by a dead process. */
const STALE_EXTRACTION_MS = 10 * 60 * 1000;

/** Newest first; a teacher does not scroll a year of uploads. */
const UPLOAD_LIST_LIMIT = 50;

export const uploadService = {
  /**
   * Store the paper and start reading it.
   *
   * Returns the id immediately — the client polls the detail endpoint. Refuses
   * up front when no provider is configured, because the alternative is storing
   * a file, marking it FAILED a moment later, and making a configuration
   * problem look like a problem with the teacher's PDF.
   */
  async createUpload(teacherId: string, input: UploadPaperInput): Promise<{ uploadId: string }> {
    if (!aiIsConfigured()) {
      throw new ServiceUnavailableError(
        "Reading papers automatically is not switched on for this server yet. " +
          "You can still write questions by hand.",
      );
    }

    const subject = await prisma.subject.findFirst({
      where: { id: input.subjectId, isActive: true },
      select: { id: true },
    });
    if (!subject) throw new NotFoundError("Subject");

    // A subject with no chapters gives the extractor nothing to file questions
    // into, so every row would come back unfiled and the teacher would do the
    // whole job by hand. Better to say so before spending the model call.
    const chapterCount = await prisma.chapter.count({
      where: { subjectId: subject.id, isActive: true },
    });
    if (chapterCount === 0) {
      throw new ConflictError(
        "That subject has no chapters set up yet, so questions cannot be filed against it.",
      );
    }

    if (input.sourceKind !== "TEXT" && input.mimeType) {
      // The declared kind and the declared type have to agree, or a PDF sent as
      // an IMAGE reaches a provider as an image part and is rejected upstream
      // with an error nobody can act on.
      if (!isSupportedUploadMimeType(input.mimeType)) {
        throw new ValidationError("Request validation failed", [
          {
            path: "body.mimeType",
            message: `${input.mimeType} cannot be read. Upload a PDF, a photo, or paste the text.`,
          },
        ]);
      }

      const expected = SUPPORTED_UPLOAD_MIME_TYPES[input.mimeType];
      if (expected !== input.sourceKind) {
        throw new ValidationError("Request validation failed", [
          { path: "body.sourceKind", message: `a ${input.mimeType} file is a ${expected} upload` },
        ]);
      }
    }

    const upload = await uploadRepository.create({
      teacherId,
      subjectId: subject.id,
      title: input.title,
      sourceKind: input.sourceKind,
      fileName: input.fileName ?? null,
      mimeType: input.mimeType ?? null,
      byteSize:
        input.sourceKind === "TEXT"
          ? (input.text?.length ?? null)
          : Math.floor(((input.fileData?.length ?? 0) * 3) / 4),
      fileData: input.sourceKind === "TEXT" ? null : (input.fileData ?? null),
      rawText: input.sourceKind === "TEXT" ? (input.text ?? null) : null,
      notes: input.notes ?? null,
    });

    void uploadService.runExtraction(upload.id);

    return { uploadId: upload.id };
  },

  /**
   * The background job.
   *
   * Exported rather than private so the retry endpoint can call it, and so a
   * test can await it instead of racing a floating promise.
   *
   * It catches everything. An unhandled rejection here would take down the
   * process for a failure whose correct outcome is one row saying FAILED.
   */
  async runExtraction(uploadId: string): Promise<void> {
    const claimed = await uploadRepository.claimForExtraction(uploadId);
    if (!claimed) return;

    const startedAt = Date.now();

    try {
      const upload = await uploadRepository.findForExtraction(uploadId);
      if (!upload) return;

      const chapters = await uploadRepository.chaptersForSubject(upload.subject.id);

      const content = upload.sourceKind === "TEXT" ? upload.rawText : upload.fileData;
      if (!content) {
        await uploadRepository.failExtraction(
          uploadId,
          "The uploaded file is no longer available.",
        );
        return;
      }

      const outcome = await extractionService.extract({
        subjectName: upload.subject.name,
        classLevel: upload.subject.classLevel,
        chapters: chapters.map((chapter) => ({
          slug: chapter.slug,
          name: chapter.name,
          topics: chapter.topics.map((topic) => ({ slug: topic.slug, name: topic.name })),
        })),
        title: upload.title,
        notes: upload.notes,
        sourceKind: upload.sourceKind,
        content,
        mimeType: upload.mimeType,
        fileName: upload.fileName,
      });

      const chapterIdBySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter.id]));

      await uploadRepository.completeExtraction({
        uploadId,
        model: `${outcome.provider}:${outcome.model}`,
        inputTokens: outcome.inputTokens,
        outputTokens: outcome.outputTokens,
        extractionMs: Date.now() - startedAt,
        items: outcome.questions.map((question, index) => ({
          orderIndex: index,
          printedNumber: question.printedNumber,
          type: question.type,
          difficulty: question.difficulty,
          marks: question.marks,
          confidence: question.confidence,
          note: question.note,
          // A slug the model invented resolves to null rather than failing the
          // row. An unfiled question is one dropdown for the teacher; a failed
          // extraction is the whole paper again.
          chapterId: question.chapterSlug
            ? (chapterIdBySlug.get(question.chapterSlug) ?? null)
            : null,
          payload: question,
        })),
      });

      logger.info(
        {
          uploadId,
          provider: outcome.provider,
          model: outcome.model,
          questions: outcome.questions.length,
          ms: Date.now() - startedAt,
        },
        "Paper extraction complete",
      );
    } catch (error) {
      // The message reaches a teacher, so it says what they can do about it.
      // The diagnosis goes to the log, where someone can act on it.
      logger.error({ err: error, uploadId }, "Paper extraction failed");

      const message =
        error instanceof ExtractionFormatError
          ? "The paper was read but the result could not be understood. Try again, or paste the text instead."
          : "The paper could not be read. This is usually a scan the model could not make out — try a clearer copy, or paste the text.";

      await uploadRepository
        .failExtraction(uploadId, message)
        .catch((failure: unknown) =>
          logger.error({ err: failure, uploadId }, "Could not record extraction failure"),
        );
    }
  },

  async list(teacherId: string): Promise<{ uploads: PaperUploadSummary[]; aiConfigured: boolean }> {
    const rows = await uploadRepository.listForTeacher(teacherId, UPLOAD_LIST_LIMIT);
    return { uploads: rows.map(toSummary), aiConfigured: aiIsConfigured() };
  },

  async get(teacherId: string, uploadId: string): Promise<PaperUploadDetail> {
    // Reaped here, on the read that would otherwise show a spinner for ever.
    await uploadRepository.reapStaleExtraction(uploadId, STALE_EXTRACTION_MS);

    const row = await uploadRepository.findForTeacher(teacherId, uploadId);
    if (!row) throw new NotFoundError("Upload");

    const chapters = await uploadRepository.chaptersForSubject(row.subject.id);

    return {
      ...toSummary(row),
      notes: row.notes,
      model: row.model,
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        topics: chapter.topics.map((topic) => ({ id: topic.id, name: topic.name })),
      })),
      items: row.items.map(toExtractedQuestion),
    };
  },

  /** Re-read a paper: a failed extraction, or a prompt that has since improved. */
  async retry(teacherId: string, uploadId: string): Promise<void> {
    const row = await uploadRepository.findForTeacher(teacherId, uploadId);
    if (!row) throw new NotFoundError("Upload");

    if (row.status === "EXTRACTING") {
      throw new ConflictError("This paper is already being read.");
    }

    if (!aiIsConfigured()) {
      throw new ServiceUnavailableError("Reading papers automatically is not switched on.");
    }

    await uploadService.runExtraction(uploadId);
  },

  /**
   * A teacher's correction to one proposal.
   *
   * The edit is written to `payload` *and* to the denormalised columns, in one
   * update. They are two copies of the same fact — see the schema comment — and
   * an update path that touched only one would leave the review screen filtering
   * on a difficulty the import no longer uses.
   */
  async updateItem(
    teacherId: string,
    uploadId: string,
    itemId: string,
    input: UpdateExtractedQuestionInput,
  ): Promise<void> {
    const item = await uploadRepository.findItem(teacherId, uploadId, itemId);
    if (!item) throw new NotFoundError("Extracted question");

    if (item.status === "IMPORTED") {
      throw new ConflictError(
        "This question is already in your bank. Edit it there — it may be in a student's set.",
      );
    }

    const payload = readPayload(item.payload);
    const data: Prisma.ExtractedQuestionUpdateInput = {};

    if (input.status !== undefined) data.status = input.status;

    if (input.chapterId !== undefined) {
      if (input.chapterId === null) {
        data.chapter = { disconnect: true };
      } else {
        // Checked against the upload's own subject: a chapter id from another
        // subject is a valid foreign key and a silently wrong filing, which is
        // the failure the whole review step exists to catch.
        const chapter = await prisma.chapter.findFirst({
          where: { id: input.chapterId, subject: { paperUploads: { some: { id: uploadId } } } },
          select: { id: true },
        });
        if (!chapter) {
          throw new ValidationError("Request validation failed", [
            { path: "body.chapterId", message: "choose a chapter from this paper's subject" },
          ]);
        }
        data.chapter = { connect: { id: chapter.id } };
      }
    }

    if (input.difficulty !== undefined) {
      data.difficulty = input.difficulty;
      payload.difficulty = input.difficulty;
    }
    if (input.type !== undefined) {
      data.type = input.type;
      payload.type = input.type;
    }
    if (input.marks !== undefined) {
      data.marks = input.marks;
      payload.marks = input.marks;
    }
    if (input.body !== undefined) payload.body = input.body;
    if (input.solution !== undefined) {
      payload.answer = {
        correctValue: payload.answer?.correctValue ?? null,
        explanation: payload.answer?.explanation ?? null,
        markingScheme: payload.answer?.markingScheme ?? null,
        unit: payload.answer?.unit ?? null,
        solution: input.solution,
      };
    }

    data.payload = payload as unknown as Prisma.InputJsonValue;

    await uploadRepository.updateItem(itemId, data);
  },

  async review(
    teacherId: string,
    uploadId: string,
    input: BulkReviewExtractedInput,
  ): Promise<{ updated: number }> {
    const updated = await uploadRepository.reviewItems(
      teacherId,
      uploadId,
      input.itemIds,
      input.status,
    );
    return { updated };
  },

  /**
   * Write the accepted questions into the teacher's own bank.
   *
   * Deliberately the same contract as `question.import.service.ts`: every row is
   * validated before any is written, and the write is all-or-nothing. A partial
   * import leaves a teacher holding a paper with no way to tell which fourteen
   * of its thirty questions landed, and the only remedy is comparing by hand.
   *
   * Unlike bulk import, though, **duplicates are skipped rather than rejected.**
   * The reason is the difference in who is running it: a content editor
   * re-running a file has made a mistake worth stopping for, while a teacher
   * pressing Import twice — or importing, accepting three more, and importing
   * again — is doing something entirely reasonable that must not fail.
   */
  async importAccepted(
    teacherId: string,
    uploadId: string,
    input: ImportUploadInput,
  ): Promise<ImportUploadResult> {
    const upload = await uploadRepository.findForTeacher(teacherId, uploadId);
    if (!upload) throw new NotFoundError("Upload");

    const [items, alreadyImported, chapters] = await Promise.all([
      uploadRepository.itemsToImport(uploadId),
      uploadRepository.countAlreadyImported(uploadId),
      uploadRepository.chaptersForSubject(upload.subject.id),
    ]);

    const fallbackChapterId = chapters[0]?.id ?? null;
    const topicsByChapter = new Map(chapters.map((chapter) => [chapter.id, chapter.topics]));

    const errors: ImportUploadResult["errors"] = [];
    const prepared: {
      itemId: string;
      chapterId: string;
      input: WriteQuestionInput;
      contentHash: string;
    }[] = [];

    for (const item of items) {
      const payload = readPayload(item.payload);
      const chapterId = item.chapterId ?? fallbackChapterId;

      if (!chapterId) {
        errors.push({
          itemId: item.id,
          printedNumber: item.printedNumber,
          issues: [{ path: "chapterId", message: "choose a chapter for this question" }],
        });
        continue;
      }

      const topicIds = (topicsByChapter.get(chapterId) ?? []).map((topic) => topic.id);
      if (topicIds.length === 0) {
        errors.push({
          itemId: item.id,
          printedNumber: item.printedNumber,
          issues: [{ path: "chapterId", message: "that chapter has no topics to file this under" }],
        });
        continue;
      }

      const candidate = toWriteInput(payload, chapterId, topicIds, upload.title);

      // The second parse, against the schema a hand-written question faces.
      // This is the point at which "the model said so" stops being enough.
      const parsed = writeQuestionInputSchema.safeParse(candidate);
      if (!parsed.success) {
        errors.push({
          itemId: item.id,
          printedNumber: item.printedNumber,
          issues: toIssues(parsed.error),
        });
        continue;
      }

      prepared.push({
        itemId: item.id,
        chapterId,
        input: parsed.data,
        contentHash: hashQuestionContent(parsed.data),
      });
    }

    if (errors.length > 0 || input.dryRun) {
      return {
        dryRun: input.dryRun,
        considered: items.length,
        valid: prepared.length,
        written: 0,
        alreadyImported,
        errors,
      };
    }

    // Duplicates against what this teacher already owns. Scoped to their own
    // bank on purpose: a question that also exists in the shared bank is not a
    // duplicate of theirs, and refusing it would make importing a standard
    // board paper impossible.
    const existing = await prisma.question.findMany({
      where: {
        ownerTeacherId: teacherId,
        subjectId: upload.subject.id,
        parentId: null,
        contentHash: { in: prepared.map((row) => row.contentHash) },
      },
      select: { contentHash: true },
    });
    const existingHashes = new Set(existing.map((row) => row.contentHash ?? ""));

    const seen = new Set<string>();
    const toWrite = prepared.filter((row) => {
      if (existingHashes.has(row.contentHash) || seen.has(row.contentHash)) return false;
      seen.add(row.contentHash);
      return true;
    });

    let written = 0;

    await prisma.$transaction(
      async (tx) => {
        for (const row of toWrite) {
          const questionId = await questionAdminRepository.createTree(
            tx,
            {
              input: row.input,
              subjectId: upload.subject.id,
              authorId: teacherId,
              ownerTeacherId: teacherId,
              expectedTimeSeconds:
                row.input.expectedTimeSeconds ?? defaultExpectedTimeSeconds(row.input.marks),
              subPartTimes: row.input.subParts.map(
                (part) => part.expectedTimeSeconds ?? defaultExpectedTimeSeconds(part.marks),
              ),
              contentHash: row.contentHash,
            },
            row.chapterId,
          );

          // Published straight away, and only into this teacher's own bank —
          // `STUDENT_VISIBLE_QUESTION` filters owned questions out of every
          // shared surface, so "published" here means "usable in my classroom",
          // not "live for everyone". The licensing gate still runs below, which
          // is why a question with no solution cannot reach a student's set.
          const blockers = publicationBlockers({
            licenceStatus: row.input.source.licenceStatus,
            hasSolution: Boolean(row.input.answer?.solution),
            isContainer: row.input.subParts.length > 0,
          });

          if (blockers.length === 0) {
            await questionAdminRepository.setStatus(tx, questionId, "PUBLISHED");
          }

          await tx.extractedQuestion.update({
            where: { id: row.itemId },
            data: { status: "IMPORTED", questionId },
          });

          written += 1;
        }

        await tx.questionPaperUpload.update({
          where: { id: uploadId },
          data: {
            status: "IMPORTED",
            importedCount: { increment: written },
            // The file has done its job. Dropping it here is the one place the
            // megabytes are reclaimed, and it is safe because a paper that has
            // been imported is not one anybody re-extracts.
            fileData: null,
          },
        });
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    logger.info({ uploadId, teacherId, written }, "Teacher paper import written");

    return {
      dryRun: false,
      considered: items.length,
      valid: prepared.length,
      written,
      alreadyImported: alreadyImported + (prepared.length - toWrite.length),
      errors: [],
    };
  },
};

/**
 * A proposal, as `writeQuestionInputSchema` wants it.
 *
 * The provenance block is the part worth reading. Every question here came off
 * a paper somebody else printed, so `sourceType` is never `ORIGINAL` and the
 * licence is never assumed clear: `NEEDS_REVIEW` is the honest state for a file
 * a teacher uploaded from their desk, and the attribution names the paper so
 * the record means something later. That is docs/07 R2 applied to the door this
 * feature opens — teachers uploading publisher material at volume is exactly
 * the case the licence column exists for.
 */
function toWriteInput(
  payload: ExtractedQuestionPayload,
  chapterId: string,
  topicIds: string[],
  paperTitle: string,
): Record<string, unknown> {
  const answer = payload.answer
    ? {
        correctValue: payload.answer.correctValue,
        acceptedValues: [],
        tolerance: null,
        unit: payload.answer.unit,
        solution: payload.answer.solution,
        explanation: payload.answer.explanation,
        markingScheme: payload.answer.markingScheme,
      }
    : null;

  return {
    type: payload.type,
    body: payload.body,
    bodyHindi: null,
    marks: payload.marks,
    difficulty: payload.difficulty,
    bloomLevel: payload.bloomLevel,
    expectedTimeSeconds: null,
    chapterId,
    topicIds: topicIds.slice(0, 5),
    options: payload.options,
    assets: [],
    answer,
    source: {
      sourceType: "THIRD_PARTY",
      year: null,
      examSession: null,
      paperCode: null,
      setNumber: null,
      originalQuestionNumber: payload.printedNumber,
      sourceUrl: null,
      licenceStatus: "NEEDS_REVIEW",
      attributionText: `From "${paperTitle}", uploaded by the teacher`,
      reviewNotes: payload.note,
    },
    subParts: payload.subParts.map((part) => ({
      type: part.type,
      body: part.body,
      bodyHindi: null,
      marks: part.marks,
      difficulty: part.difficulty,
      bloomLevel: payload.bloomLevel,
      expectedTimeSeconds: null,
      topicIds: null,
      options: part.options,
      assets: [],
      answer: part.answer
        ? {
            correctValue: part.answer.correctValue,
            acceptedValues: [],
            tolerance: null,
            unit: part.answer.unit,
            solution: part.answer.solution,
            explanation: part.answer.explanation,
            markingScheme: part.answer.markingScheme,
          }
        : null,
    })),
  };
}

/**
 * A stored payload, back as a typed object.
 *
 * Re-parsed rather than cast. The column is `Json`, so its runtime contents are
 * whatever was written — including by a previous version of this code — and a
 * cast would turn that into a type error surfacing three functions away. The
 * parse also re-applies defaults, so a payload written before a field existed
 * comes back complete.
 */
function readPayload(value: Prisma.JsonValue): ExtractedQuestionPayload {
  const parsed = extractedQuestionPayloadSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  // Unreachable unless the column was written by something that bypassed this
  // module. Loud, because silently substituting an empty question would import
  // a blank row into a teacher's bank.
  throw new ConflictError(
    "This extracted question is stored in an old format. Re-read the paper to refresh it.",
  );
}

function toSummary(row: UploadSummaryRow): PaperUploadSummary {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    sourceKind: row.sourceKind,
    fileName: row.fileName,
    status: row.status,
    error: row.error,
    extractedCount: row.extractedCount,
    acceptedCount: row._count.items,
    importedCount: row.importedCount,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

function toExtractedQuestion(row: UploadDetailRow["items"][number]): ExtractedQuestion {
  return {
    id: row.id,
    orderIndex: row.orderIndex,
    printedNumber: row.printedNumber,
    type: row.type,
    difficulty: row.difficulty,
    marks: row.marks,
    confidence: row.confidence,
    note: row.note,
    status: row.status,
    questionId: row.questionId,
    chapter: row.chapter,
    payload: readPayload(row.payload),
  };
}

function toIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
}
