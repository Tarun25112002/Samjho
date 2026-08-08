import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, describe, expect, it } from "vitest";

import { PrismaClient } from "../generated/prisma/client.js";

/**
 * The database-level integrity rules, tested against a real database.
 *
 * Five CHECK constraints are appended by hand to the initial migration because
 * Prisma's schema language cannot express them. Hand-written SQL in a generated
 * file is fragile: re-running `prisma migrate dev` after a schema change can
 * rewrite that file and silently drop them, and nothing else in the system would
 * notice. This test is what notices.
 *
 * It needs a migrated database — `pnpm --filter @samjho/api db:test:prepare`
 * locally, and a dedicated CI step. If that has not happened, the test fails
 * with an explanation rather than skipping, because a constraint test that
 * quietly skips is worse than no constraint test at all: it reports green.
 */

const databaseUrl = process.env["DATABASE_URL"];
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

afterAll(async () => {
  await prisma.$disconnect();
});

/** Every constraint the migration is expected to have created. */
const EXPECTED_CONSTRAINTS = [
  "exam_attempts_deadline_after_start",
  "question_attempts_exactly_one_session",
  "questions_marks_positive",
  "questions_max_depth_one",
  "questions_subpart_index_present",
] as const;

describe("hand-written CHECK constraints", () => {
  it("all five are present in the database", async () => {
    let rows: { conname: string }[];
    try {
      rows = await prisma.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint
        WHERE contype = 'c' AND connamespace = 'public'::regnamespace
      `;
    } catch (error) {
      throw new Error(
        `Could not reach the test database at ${databaseUrl ?? "(DATABASE_URL unset)"}. ` +
          "Run `pnpm db:up` and `pnpm --filter @samjho/api db:test:prepare` first.",
        { cause: error },
      );
    }

    const found = new Set(rows.map((r) => r.conname));
    const missing = EXPECTED_CONSTRAINTS.filter((name) => !found.has(name));

    expect(
      missing,
      "Constraints are missing from the database. If a migration was regenerated, " +
        "the hand-written CHECK block at the end of it was probably lost.",
    ).toEqual([]);
  });

  /**
   * Each behavioural test builds its own fixtures inside a transaction and lets
   * the constraint violation abort it. Two consequences worth being explicit
   * about.
   *
   * The tests are self-contained, so they pass against an empty database. An
   * earlier version selected a parent row out of the seeded data, which meant
   * that against an unseeded test database the INSERT ... SELECT matched
   * nothing, inserted nothing, violated nothing, and *passed by doing nothing* —
   * a constraint test reporting green while testing zero constraints.
   *
   * And nothing survives. A rejection rolls the transaction back on its own, but
   * the *accepted* case would otherwise commit and leave `ct-subject` behind for
   * the next test to collide with — so the helper throws a sentinel to force a
   * rollback either way, and returns the statement's result.
   */
  class Rollback extends Error {}

  async function withFixtures<T>(statement: (tx: PrismaTx) => Promise<T>): Promise<T> {
    let result!: T;

    await prisma
      .$transaction(async (tx) => {
        await tx.$executeRaw`
        INSERT INTO subjects (id, "classLevel", code, name, slug, "theoryMarks", "syllabusYear", "updatedAt")
        VALUES ('ct-subject', 10, 'CT', 'Constraint Test', 'constraint-test', 80, '2026-27', now())
      `;
        await tx.$executeRaw`
        INSERT INTO chapters (id, "subjectId", name, slug, "orderIndex", "updatedAt")
        VALUES ('ct-chapter', 'ct-subject', 'Chapter', 'chapter', 0, now())
      `;
        await tx.$executeRaw`
        INSERT INTO questions (
          id, "subjectId", "chapterId", type, body, marks, "expectedTimeSeconds",
          "isContainer", "updatedAt"
        )
        VALUES ('ct-container', 'ct-subject', 'ct-chapter', 'CASE_BASED', 'stimulus', 4, 240, true, now())
      `;
        await tx.$executeRaw`
        INSERT INTO users (id, "clerkId", email, "updatedAt")
        VALUES ('ct-user', 'user_ct', 'ct@samjho.test', now())
      `;
        result = await statement(tx);
        throw new Rollback();
      })
      .catch((error: unknown) => {
        if (!(error instanceof Rollback)) throw error;
      });

    return result;
  }

  it("rejects a question that is both a sub-part and a container", async () => {
    // Depth is capped at 1: the renderer and the marks accounting are both
    // written for exactly two levels, and a grandchild would break them.
    await expect(
      withFixtures(
        (tx) =>
          tx.$executeRaw`
          INSERT INTO questions (
            id, "subjectId", "chapterId", type, body, marks, "expectedTimeSeconds",
            "parentId", "subPartIndex", "isContainer", "updatedAt"
          )
          VALUES ('ct-nested', 'ct-subject', 'ct-chapter', 'CASE_BASED', 'nested', 4, 60,
                  'ct-container', 0, true, now())
        `,
      ),
    ).rejects.toThrow(/questions_max_depth_one/);
  });

  it("accepts a legitimate sub-part one level deep", async () => {
    // The mirror of the test above. Without it, a constraint written as
    // `CHECK (false)` would pass every rejection test in this file.
    await expect(
      withFixtures(
        (tx) =>
          tx.$executeRaw`
          INSERT INTO questions (
            id, "subjectId", "chapterId", type, body, marks, "expectedTimeSeconds",
            "parentId", "subPartIndex", "isContainer", "updatedAt"
          )
          VALUES ('ct-subpart', 'ct-subject', 'ct-chapter', 'SHORT_ANSWER', 'part (i)', 2, 60,
                  'ct-container', 0, false, now())
        `,
      ),
    ).resolves.toBe(1);
  });

  it("rejects a question attempt that belongs to neither a session nor an exam", async () => {
    // Every analytics figure assumes exactly one context. An attempt with
    // neither would be counted nowhere; one with both would be counted twice.
    await expect(
      withFixtures(
        (tx) =>
          tx.$executeRaw`
          INSERT INTO question_attempts (
            id, "userId", "questionId", "questionVersion", "questionSnapshot",
            "marksPossible", "updatedAt"
          )
          VALUES ('ct-orphan', 'ct-user', 'ct-container', 1, '{}'::jsonb, 4, now())
        `,
      ),
    ).rejects.toThrow(/question_attempts_exactly_one_session/);
  });

  it("rejects a zero-mark question", async () => {
    await expect(
      withFixtures(
        (tx) =>
          tx.$executeRaw`
          INSERT INTO questions (id, "subjectId", "chapterId", type, body, marks, "expectedTimeSeconds", "updatedAt")
          VALUES ('ct-zero', 'ct-subject', 'ct-chapter', 'MCQ', 'worthless', 0, 60, now())
        `,
      ),
    ).rejects.toThrow(/questions_marks_positive/);
  });

  it("rejects a sub-part with no position among its siblings", async () => {
    // parentId and subPartIndex must be set or unset together, or the renderer
    // has no stable order to lay the sub-parts out in.
    await expect(
      withFixtures(
        (tx) =>
          tx.$executeRaw`
          INSERT INTO questions (
            id, "subjectId", "chapterId", type, body, marks, "expectedTimeSeconds",
            "parentId", "updatedAt"
          )
          VALUES ('ct-unordered', 'ct-subject', 'ct-chapter', 'SHORT_ANSWER', 'part', 2, 60,
                  'ct-container', now())
        `,
      ),
    ).rejects.toThrow(/questions_subpart_index_present/);
  });
});

/** The transactional client Prisma hands to an interactive `$transaction`. */
type PrismaTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
