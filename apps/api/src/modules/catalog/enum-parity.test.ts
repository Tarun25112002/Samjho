import {
  bloomLevelSchema,
  difficultySchema,
  questionTypeSchema,
  type BloomLevel,
  type Difficulty,
  type QuestionType,
} from "@samjho/contracts";
import { describe, expect, it } from "vitest";

import {
  BloomLevel as PrismaBloomLevel,
  Difficulty as PrismaDifficulty,
  QuestionType as PrismaQuestionType,
} from "../../generated/prisma/enums.js";

/**
 * The database enum and the wire enum must agree.
 *
 * `QuestionType` is declared twice: once in schema.prisma, because Postgres
 * needs a real enum type, and once in @samjho/contracts, because the web app
 * must not import the Prisma client. Neither can be derived from the other —
 * Prisma generates from the schema, and contracts has no database dependency by
 * design.
 *
 * Duplication that cannot be removed has to be *checked*. Without this test,
 * adding a question type to the schema and forgetting contracts produces code
 * that compiles, deploys, and then throws the first time a student opens a
 * question of the new type. These assertions cost microseconds and convert that
 * into a failed build.
 */

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("Prisma ↔ contracts enum parity", () => {
  it("QuestionType matches", () => {
    expect(sorted(Object.keys(PrismaQuestionType))).toEqual(sorted(questionTypeSchema.options));
  });

  it("Difficulty matches", () => {
    expect(sorted(Object.keys(PrismaDifficulty))).toEqual(sorted(difficultySchema.options));
  });

  it("BloomLevel matches", () => {
    expect(sorted(Object.keys(PrismaBloomLevel))).toEqual(sorted(bloomLevelSchema.options));
  });

  it("assigns a Prisma enum value to the contracts type without a cast", () => {
    // Runtime equality is not quite the whole story — the *types* have to line
    // up too, or every service that reads a question from the database has to
    // cast on the way out. These assignments are the compile-time half of the
    // check and would fail to build if the unions diverged.
    const type: QuestionType = PrismaQuestionType.CASE_BASED;
    const difficulty: Difficulty = PrismaDifficulty.HARD;
    const bloom: BloomLevel = PrismaBloomLevel.ANALYSE;

    expect(type).toBe("CASE_BASED");
    expect(difficulty).toBe("HARD");
    expect(bloom).toBe("ANALYSE");
  });
});
