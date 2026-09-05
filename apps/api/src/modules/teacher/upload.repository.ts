import type { ExtractedQuestionPayload } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Data access for paper uploads. Every Prisma call in the upload flow is here.
 *
 * The one shape worth explaining is `uploadDetailSelect`, and specifically what
 * it leaves out: `fileData`. That column holds the base64 of a whole scanned
 * paper — megabytes of it — and it is needed by exactly one code path, the
 * extraction job. Including it in the select the review screen uses would ship
 * those megabytes to the browser on every poll, to render a list of questions
 * that does not contain the file. It is loaded explicitly, by the one caller
 * that needs it, and nowhere else.
 */

export const uploadSummarySelect = {
  id: true,
  title: true,
  sourceKind: true,
  fileName: true,
  status: true,
  error: true,
  extractedCount: true,
  importedCount: true,
  createdAt: true,
  completedAt: true,
  subject: { select: { id: true, name: true, code: true } },
  _count: { select: { items: { where: { status: "ACCEPTED" } } } },
} satisfies Prisma.QuestionPaperUploadSelect;

export type UploadSummaryRow = Prisma.QuestionPaperUploadGetPayload<{
  select: typeof uploadSummarySelect;
}>;

export const uploadDetailSelect = {
  ...uploadSummarySelect,
  notes: true,
  model: true,
  items: {
    orderBy: { orderIndex: "asc" },
    select: {
      id: true,
      orderIndex: true,
      printedNumber: true,
      type: true,
      difficulty: true,
      marks: true,
      confidence: true,
      note: true,
      status: true,
      questionId: true,
      payload: true,
      chapter: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.QuestionPaperUploadSelect;

export type UploadDetailRow = Prisma.QuestionPaperUploadGetPayload<{
  select: typeof uploadDetailSelect;
}>;

export interface CreateUploadInput {
  teacherId: string;
  subjectId: string;
  title: string;
  sourceKind: "PDF" | "IMAGE" | "TEXT";
  fileName: string | null;
  mimeType: string | null;
  byteSize: number | null;
  fileData: string | null;
  rawText: string | null;
  notes: string | null;
}

export interface ExtractionWrite {
  uploadId: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  extractionMs: number;
  items: {
    orderIndex: number;
    printedNumber: string | null;
    type: ExtractedQuestionPayload["type"];
    difficulty: ExtractedQuestionPayload["difficulty"];
    marks: number;
    confidence: number | null;
    note: string | null;
    chapterId: string | null;
    payload: ExtractedQuestionPayload;
  }[];
}

export const uploadRepository = {
  create(input: CreateUploadInput): Promise<{ id: string }> {
    return prisma.questionPaperUpload.create({
      data: {
        teacherId: input.teacherId,
        subjectId: input.subjectId,
        title: input.title,
        sourceKind: input.sourceKind,
        fileName: input.fileName,
        mimeType: input.mimeType,
        byteSize: input.byteSize,
        fileData: input.fileData,
        rawText: input.rawText,
        notes: input.notes,
        status: "UPLOADED",
      },
      select: { id: true },
    });
  },

  listForTeacher(teacherId: string, limit: number): Promise<UploadSummaryRow[]> {
    return prisma.questionPaperUpload.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: uploadSummarySelect,
    });
  },

  /**
   * One upload, scoped to its owner.
   *
   * `teacherId` is part of the `where` rather than checked after loading. The
   * difference matters: a check afterwards is a line someone can delete and the
   * tests still pass, while a query that cannot return another teacher's upload
   * has no such line to delete.
   */
  findForTeacher(teacherId: string, uploadId: string): Promise<UploadDetailRow | null> {
    return prisma.questionPaperUpload.findFirst({
      where: { id: uploadId, teacherId },
      select: uploadDetailSelect,
    });
  },

  /** The extraction job's own read: the file, and nothing the screens need. */
  findForExtraction(uploadId: string): Promise<{
    id: string;
    title: string;
    sourceKind: "PDF" | "IMAGE" | "TEXT";
    fileData: string | null;
    rawText: string | null;
    mimeType: string | null;
    fileName: string | null;
    notes: string | null;
    subject: { id: string; name: string; classLevel: number };
  } | null> {
    return prisma.questionPaperUpload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        title: true,
        sourceKind: true,
        fileData: true,
        rawText: true,
        mimeType: true,
        fileName: true,
        notes: true,
        subject: { select: { id: true, name: true, classLevel: true } },
      },
    });
  },

  /**
   * Claim an upload for extraction.
   *
   * `updateMany` with the status in the `where` rather than `update`, so the
   * transition is a compare-and-set. Two callers racing — a retry arriving while
   * the first attempt is still starting — produce one claim and one no-op
   * instead of two model calls billed for the same paper.
   */
  async claimForExtraction(uploadId: string): Promise<boolean> {
    const claimed = await prisma.questionPaperUpload.updateMany({
      where: { id: uploadId, status: { in: ["UPLOADED", "FAILED"] } },
      data: { status: "EXTRACTING", error: null },
    });
    return claimed.count === 1;
  },

  /**
   * Write the extraction result: the items, the counters, the accounting.
   *
   * One transaction, because a READY upload with no items is a screen that says
   * "0 questions found" about a paper full of them, and the teacher's only
   * recourse is to upload it again.
   */
  async completeExtraction(write: ExtractionWrite): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // A re-run replaces the previous proposals rather than appending to them.
      // Anything already imported is protected by the status filter: those rows
      // are the link between a question in the bank and the paper it came from,
      // and deleting them would orphan that.
      await tx.extractedQuestion.deleteMany({
        where: { uploadId: write.uploadId, status: { not: "IMPORTED" } },
      });

      if (write.items.length > 0) {
        await tx.extractedQuestion.createMany({
          data: write.items.map((item) => ({
            uploadId: write.uploadId,
            orderIndex: item.orderIndex,
            printedNumber: item.printedNumber,
            type: item.type,
            difficulty: item.difficulty,
            marks: item.marks,
            confidence: item.confidence,
            note: item.note,
            chapterId: item.chapterId,
            payload: item.payload as unknown as Prisma.InputJsonValue,
          })),
        });
      }

      await tx.questionPaperUpload.update({
        where: { id: write.uploadId },
        data: {
          status: "READY",
          model: write.model,
          inputTokens: write.inputTokens,
          outputTokens: write.outputTokens,
          extractionMs: write.extractionMs,
          extractedCount: write.items.length,
          completedAt: new Date(),
          // The file is kept: re-running an extraction after a prompt fix must
          // not require the teacher to find the PDF again.
        },
      });
    });
  },

  async failExtraction(uploadId: string, reason: string): Promise<void> {
    await prisma.questionPaperUpload.update({
      where: { id: uploadId },
      data: { status: "FAILED", error: reason.slice(0, 500), completedAt: new Date() },
    });
  },

  /**
   * Time out an extraction this process is no longer running.
   *
   * The job lives in memory, so a deploy or a crash mid-extraction leaves a row
   * stuck in `EXTRACTING` with nothing on its way to finish it. Reaped on read
   * rather than by a sweeper: the only person who cares is the teacher looking
   * at the row, and they are the one making the request that finds it.
   */
  async reapStaleExtraction(uploadId: string, olderThanMs: number): Promise<boolean> {
    const reaped = await prisma.questionPaperUpload.updateMany({
      where: {
        id: uploadId,
        status: "EXTRACTING",
        updatedAt: { lt: new Date(Date.now() - olderThanMs) },
      },
      data: {
        status: "FAILED",
        error: "Reading this paper was interrupted. Try again — the file is still here.",
      },
    });
    return reaped.count === 1;
  },

  /** The chapters and topics the extractor grounds against, and the review UI offers. */
  chaptersForSubject(subjectId: string): Promise<
    {
      id: string;
      slug: string;
      name: string;
      topics: { id: string; slug: string; name: string }[];
    }[]
  > {
    return prisma.chapter.findMany({
      where: { subjectId, isActive: true },
      orderBy: { orderIndex: "asc" },
      select: {
        id: true,
        slug: true,
        name: true,
        topics: {
          orderBy: { orderIndex: "asc" },
          select: { id: true, slug: true, name: true },
        },
      },
    });
  },

  findItem(
    teacherId: string,
    uploadId: string,
    itemId: string,
  ): Promise<{
    id: string;
    status: "PROPOSED" | "ACCEPTED" | "REJECTED" | "IMPORTED";
    payload: Prisma.JsonValue;
  } | null> {
    return prisma.extractedQuestion.findFirst({
      where: { id: itemId, uploadId, upload: { teacherId } },
      select: { id: true, status: true, payload: true },
    });
  },

  async updateItem(itemId: string, data: Prisma.ExtractedQuestionUpdateInput): Promise<void> {
    await prisma.extractedQuestion.update({ where: { id: itemId }, data });
  },

  /**
   * Bulk accept/reject.
   *
   * Ownership is enforced through the relation filter, so an id belonging to
   * another teacher's upload simply is not matched — the call succeeds and
   * reports how many rows it actually touched, rather than leaking through an
   * error message which ids exist.
   */
  async reviewItems(
    teacherId: string,
    uploadId: string,
    itemIds: string[],
    status: "PROPOSED" | "ACCEPTED" | "REJECTED",
  ): Promise<number> {
    const result = await prisma.extractedQuestion.updateMany({
      where: {
        id: { in: itemIds },
        uploadId,
        upload: { teacherId },
        // An imported row is settled. Moving it back to PROPOSED would suggest
        // the question could be un-imported, which it cannot: it is in the bank
        // and may already be in a student's session.
        status: { not: "IMPORTED" },
      },
      data: { status },
    });
    return result.count;
  },

  itemsToImport(uploadId: string): Promise<
    {
      id: string;
      printedNumber: string | null;
      chapterId: string | null;
      payload: Prisma.JsonValue;
    }[]
  > {
    return prisma.extractedQuestion.findMany({
      where: { uploadId, status: "ACCEPTED" },
      orderBy: { orderIndex: "asc" },
      select: { id: true, printedNumber: true, chapterId: true, payload: true },
    });
  },

  countAlreadyImported(uploadId: string): Promise<number> {
    return prisma.extractedQuestion.count({ where: { uploadId, status: "IMPORTED" } });
  },
};
