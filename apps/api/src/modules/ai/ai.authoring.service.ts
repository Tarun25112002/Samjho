import {
  importQuestionsInputSchema,
  type DraftedQuestions,
  type DraftQuestionsInput,
} from "@medhavi/contracts";

import { NotFoundError, ValidationError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { questionImportService } from "../questions/question.import.service.js";
import { aiAuthoring } from "./ai.authoring.js";
import { assertNotRateLimited } from "./ai.quota.js";

/**
 * Drafting questions, and then checking them the way a human's are checked.
 *
 * ## The shape of this service is the point
 *
 * It resolves the brief, calls the model, and then hands the result straight to
 * `questionImportService.importQuestions` **in dry-run mode**. There is no
 * bespoke validation here and there is no write. What comes back is the
 * ordinary import report, so a generated MCQ with two correct options is
 * rejected by exactly the code that rejects a hand-typed one, with exactly the
 * same message.
 *
 * Writing them is a second call, made by an editor, to the endpoint that
 * already exists. That separation is what keeps "a model wrote this" from ever
 * meaning "a model published this".
 *
 * ## Why the existing bank is read first
 *
 * Because a model asked for three questions on Quadratic Equations writes the
 * three most obvious ones, and the bank already has them. Showing it what is
 * there turns a generator into something that fills gaps.
 */

/** Enough to steer away from duplicates without paying for the whole chapter. */
const EXISTING_SAMPLE = 25;

export const aiAuthoringService = {
  async draft(userId: string, input: DraftQuestionsInput): Promise<DraftedQuestions> {
    const chapter = await prisma.chapter.findFirst({
      where: { subjectId: input.subjectId, slug: input.chapter },
      select: {
        id: true,
        name: true,
        slug: true,
        subject: { select: { name: true, classLevel: true } },
        topics: { select: { id: true, name: true, slug: true } },
      },
    });

    if (!chapter) {
      throw new NotFoundError(`No chapter "${input.chapter}" in that subject.`);
    }

    const bySlug = new Map(chapter.topics.map((topic) => [topic.slug, topic]));
    const topics = input.topics.map((slug) => bySlug.get(slug));

    // Resolved here rather than left to the import's per-row errors, because a
    // mistyped topic slug would otherwise cost a model call before it surfaced
    // — and it is the same message either way.
    const unknown = input.topics.filter((slug) => !bySlug.has(slug));
    if (unknown.length > 0) {
      throw new ValidationError(
        "That brief names topics that are not in this chapter.",
        unknown.map((slug) => ({
          path: "topics",
          message: `unknown topic slug "${slug}" in chapter "${chapter.slug}"`,
        })),
      );
    }

    const topicIds = topics.map((topic) => topic?.id ?? "");

    const existing = await prisma.question.findMany({
      where: {
        status: { in: ["PUBLISHED", "DRAFT"] },
        topics: { some: { topicId: { in: topicIds } } },
      },
      select: { body: true },
      orderBy: { createdAt: "desc" },
      take: EXISTING_SAMPLE,
    });

    assertNotRateLimited(userId);

    const drafted = await aiAuthoring.draft({
      subjectName: chapter.subject.name,
      classLevel: chapter.subject.classLevel,
      chapterName: chapter.name,
      chapterSlug: chapter.slug,
      topicNames: topics.map((topic) => topic?.name ?? ""),
      topicSlugs: input.topics,
      type: input.type,
      difficulty: input.difficulty,
      marks: input.marks,
      count: input.count,
      notes: input.notes,
      existingBodies: existing.map((question) => question.body),
    });

    if (drafted.rows.length === 0) {
      return {
        rows: [],
        validation: { dryRun: true, total: 0, valid: 0, written: 0, errors: [] },
        generated: drafted.generated,
        caveat: drafted.caveat,
      };
    }

    // The same validator, the same messages, nothing written. `dryRun` is
    // passed explicitly even though it is the schema's default, because this is
    // the one line in the file that must never be changed by accident.
    const validation = await questionImportService.importQuestions(
      importQuestionsInputSchema.parse({
        subjectId: input.subjectId,
        dryRun: true,
        status: "DRAFT",
        rows: drafted.rows,
      }),
      userId,
    );

    return {
      rows: drafted.rows,
      validation,
      generated: drafted.generated,
      caveat: drafted.caveat,
    };
  },
};
