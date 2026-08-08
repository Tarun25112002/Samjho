import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "../../src/generated/prisma/client.js";
import type { SeedQuestion, SeedSubPart } from "./types.js";

/**
 * Deterministic ids for seed rows.
 *
 * Questions have no natural unique key — two questions can legitimately share a
 * chapter, type, marks and even body text. That makes `upsert` impossible unless
 * the seed supplies its own identity, so it does: every seeded row gets an id
 * derived from stable content coordinates rather than a random cuid.
 *
 * Two things fall out of this, both wanted. Re-running the seed updates rows in
 * place instead of duplicating them, which is what "idempotent" has to mean when
 * attempts already reference those ids. And seed data is identifiable at a
 * glance in psql, which matters the first time someone wonders whether a row in
 * production came from a human or from this file.
 */
export function seedId(...parts: string[]): string {
  return ["seed", ...parts].join("-");
}

/**
 * Hash of the meaning-bearing fields only.
 *
 * `Question.contentHash` answers "did this edit change what the question asks?"
 * — the difference between an edit that must bump `version` and invalidate
 * nothing, and one that quietly rewrites the history of every past attempt.
 * Explanations and solutions are excluded on purpose: fixing a typo in a
 * worked solution changes no student's score.
 */
export function contentHash(question: {
  body: string;
  marks: number;
  type: string;
  options?: { label: string; body: string; isCorrect?: boolean }[] | undefined;
  answer?: { correctValue?: string | undefined; acceptedValues?: string[] | undefined } | undefined;
}): string {
  const material = JSON.stringify({
    body: question.body.trim(),
    marks: question.marks,
    type: question.type,
    options: (question.options ?? []).map((o) => ({
      label: o.label,
      body: o.body.trim(),
      isCorrect: o.isCorrect ?? false,
    })),
    correctValue: question.answer?.correctValue ?? null,
    acceptedValues: [...(question.answer?.acceptedValues ?? [])].sort(),
  });
  return createHash("sha256").update(material).digest("hex").slice(0, 32);
}

/** Resolved ids for one subject's curriculum, keyed by slug. */
export interface CurriculumIndex {
  subjectId: string;
  chapterIdBySlug: Map<string, string>;
  topicIdBySlug: Map<string, string>;
}

function requireId(
  index: Map<string, string>,
  slug: string,
  kind: string,
  context: string,
): string {
  const id = index.get(slug);
  if (!id) {
    throw new Error(
      `Seed error in ${context}: unknown ${kind} slug "${slug}". ` +
        `Known: ${[...index.keys()].sort().join(", ")}`,
    );
  }
  return id;
}

/**
 * Write one question — plus its options, answer key, provenance, topic links and
 * any sub-parts — idempotently.
 *
 * Child rows are deleted and rewritten rather than diffed. That is the right
 * trade for a seed: options and topic links have no independent identity worth
 * preserving, and a full rewrite means the database always reflects the file
 * exactly, with no drift from a half-applied earlier run.
 */
export async function upsertQuestion(
  prisma: PrismaClient,
  question: SeedQuestion,
  index: CurriculumIndex,
  authorId: string,
): Promise<string> {
  const context = `question "${question.key}"`;
  const chapterId = requireId(index.chapterIdBySlug, question.chapter, "chapter", context);
  const isContainer = (question.subParts?.length ?? 0) > 0;

  const id = seedId("q", question.key);

  const base = {
    subjectId: index.subjectId,
    chapterId,
    type: question.type,
    body: question.body,
    marks: question.marks,
    difficulty: question.difficulty,
    bloomLevel: question.bloomLevel,
    expectedTimeSeconds: question.expectedTimeSeconds,
    status: "PUBLISHED" as const,
    isContainer,
    contentHash: contentHash(question),
    authorId,
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  await prisma.question.upsert({
    where: { id },
    create: { id, ...base },
    update: base,
  });

  await writeQuestionChildren(prisma, id, question, index, context);

  for (const [i, subPart] of (question.subParts ?? []).entries()) {
    await upsertSubPart(prisma, subPart, i, {
      parentId: id,
      parentQuestion: question,
      index,
      authorId,
      chapterId,
    });
  }

  // Sub-parts removed from the file must disappear from the database too,
  // otherwise a re-run leaves an orphan that still renders inside the case study.
  const keptSubPartIds = (question.subParts ?? []).map((s) => seedId("q", s.key));
  await prisma.question.deleteMany({
    where: {
      parentId: id,
      id: { notIn: keptSubPartIds.length > 0 ? keptSubPartIds : ["__none__"] },
    },
  });

  return id;
}

async function upsertSubPart(
  prisma: PrismaClient,
  subPart: SeedSubPart,
  position: number,
  ctx: {
    parentId: string;
    parentQuestion: SeedQuestion;
    index: CurriculumIndex;
    authorId: string;
    chapterId: string;
  },
): Promise<void> {
  const id = seedId("q", subPart.key);
  const context = `sub-part "${subPart.key}"`;

  const base = {
    subjectId: ctx.index.subjectId,
    chapterId: ctx.chapterId,
    type: subPart.type,
    body: subPart.body,
    marks: subPart.marks,
    difficulty: ctx.parentQuestion.difficulty,
    bloomLevel: ctx.parentQuestion.bloomLevel,
    expectedTimeSeconds: subPart.expectedTimeSeconds ?? subPart.marks * 60,
    status: "PUBLISHED" as const,
    parentId: ctx.parentId,
    subPartIndex: position,
    // Enforced by a CHECK constraint as well: a sub-part can never be a container.
    isContainer: false,
    contentHash: contentHash(subPart),
    authorId: ctx.authorId,
    publishedAt: new Date("2026-08-01T00:00:00.000Z"),
  };

  await prisma.question.upsert({ where: { id }, create: { id, ...base }, update: base });

  await writeQuestionChildren(
    prisma,
    id,
    {
      ...subPart,
      // Sub-parts inherit the parent's topics unless they declare their own — a
      // case study that spans two topics is normal, and this is where that is
      // expressed.
      topics: subPart.topics ?? ctx.parentQuestion.topics,
      source: ctx.parentQuestion.source,
    },
    ctx.index,
    context,
  );
}

async function writeQuestionChildren(
  prisma: PrismaClient,
  questionId: string,
  question: {
    topics: string[];
    options?: SeedQuestion["options"];
    answer?: SeedQuestion["answer"];
    source: SeedQuestion["source"];
  },
  index: CurriculumIndex,
  context: string,
): Promise<void> {
  await prisma.questionOption.deleteMany({ where: { questionId } });
  if (question.options) {
    await prisma.questionOption.createMany({
      data: question.options.map((option, i) => ({
        questionId,
        label: option.label,
        body: option.body,
        isCorrect: option.isCorrect ?? false,
        orderIndex: i,
      })),
    });
  }

  await prisma.questionTopic.deleteMany({ where: { questionId } });
  if (question.topics.length > 0) {
    await prisma.questionTopic.createMany({
      data: question.topics.map((slug, i) => ({
        questionId,
        topicId: requireId(index.topicIdBySlug, slug, "topic", context),
        isPrimary: i === 0,
      })),
    });
  }

  if (question.answer) {
    const answer = {
      correctValue: question.answer.correctValue ?? null,
      acceptedValues: question.answer.acceptedValues ?? [],
      tolerance: question.answer.tolerance ?? null,
      unit: question.answer.unit ?? null,
      solution: question.answer.solution,
      // Prisma distinguishes a JSON `null` value from a SQL NULL column, so a
      // nullable Json field cannot simply be assigned `null`. `DbNull` is the
      // one that means "no marking scheme"; `JsonNull` would store the JSON
      // literal null, which is a different and much more confusing thing.
      markingScheme: question.answer.markingScheme ?? Prisma.DbNull,
      explanation: question.answer.explanation ?? null,
    };
    await prisma.questionAnswer.upsert({
      where: { questionId },
      create: { questionId, ...answer },
      update: answer,
    });
  } else {
    // Containers hold no answer key. If one existed from an earlier run where
    // this was a flat question, it must go.
    await prisma.questionAnswer.deleteMany({ where: { questionId } });
  }

  const source = {
    sourceType: question.source.sourceType,
    year: question.source.year ?? null,
    examSession: question.source.examSession ?? null,
    originalQuestionNumber: question.source.originalQuestionNumber ?? null,
    licenceStatus: question.source.licenceStatus,
    attributionText: question.source.attributionText ?? null,
  };
  await prisma.questionSource.upsert({
    where: { questionId },
    create: { questionId, ...source },
    update: source,
  });
}
