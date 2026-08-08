import {
  bloomLevelSchema,
  boardSchema,
  difficultySchema,
  examPhaseSchema,
  languageSchema,
  questionTypeSchema,
  roleSchema,
  userStatusSchema,
  type BloomLevel,
  type Board,
  type Difficulty,
  type ExamPhase,
  type Language,
  type QuestionType,
  type Role,
  type UserStatus,
} from "@samjho/contracts";
import { describe, expect, it } from "vitest";

import {
  BloomLevel as PrismaBloomLevel,
  Board as PrismaBoard,
  Difficulty as PrismaDifficulty,
  ExamPhase as PrismaExamPhase,
  Language as PrismaLanguage,
  QuestionType as PrismaQuestionType,
  Role as PrismaRole,
  UserStatus as PrismaUserStatus,
} from "../generated/prisma/enums.js";

/**
 * The database enum and the wire enum must agree.
 *
 * These enums are declared twice: once in schema.prisma, because Postgres needs
 * a real enum type, and once in @samjho/contracts, because the web app must not
 * import the Prisma client. Neither can be derived from the other — Prisma
 * generates from the schema, and contracts has no database dependency by design.
 *
 * Duplication that cannot be removed has to be *checked*. Without this test,
 * adding a question type to the schema and forgetting contracts produces code
 * that compiles, deploys, and then throws the first time a student opens a
 * question of the new type. These assertions cost microseconds and convert that
 * into a failed build.
 *
 * `Role` is the one that would hurt most. A role present in the database but
 * absent from the contract fails to parse on the way out — and the failure mode
 * of an authorization enum is never a small one.
 */

function sorted(values: readonly string[]): string[] {
  return [...values].sort();
}

describe("Prisma ↔ contracts enum parity", () => {
  it.each([
    ["QuestionType", PrismaQuestionType, questionTypeSchema.options],
    ["Difficulty", PrismaDifficulty, difficultySchema.options],
    ["BloomLevel", PrismaBloomLevel, bloomLevelSchema.options],
    ["Board", PrismaBoard, boardSchema.options],
    ["Role", PrismaRole, roleSchema.options],
    ["UserStatus", PrismaUserStatus, userStatusSchema.options],
    ["Language", PrismaLanguage, languageSchema.options],
    ["ExamPhase", PrismaExamPhase, examPhaseSchema.options],
  ])(
    "%s matches",
    (_name, prismaEnum: Record<string, string>, contractOptions: readonly string[]) => {
      expect(sorted(Object.keys(prismaEnum))).toEqual(sorted(contractOptions));
    },
  );

  it("assigns Prisma enum values to the contracts types without a cast", () => {
    // Runtime equality is not quite the whole story — the *types* have to line
    // up too, or every service that reads from the database has to cast on the
    // way out. These assignments are the compile-time half of the check and
    // would fail to build if the unions diverged.
    const type: QuestionType = PrismaQuestionType.CASE_BASED;
    const difficulty: Difficulty = PrismaDifficulty.HARD;
    const bloom: BloomLevel = PrismaBloomLevel.ANALYSE;
    const board: Board = PrismaBoard.CBSE;
    const role: Role = PrismaRole.CONTENT_EDITOR;
    const status: UserStatus = PrismaUserStatus.SUSPENDED;
    const language: Language = PrismaLanguage.HINDI;
    const phase: ExamPhase = PrismaExamPhase.PHASE_2;

    expect([type, difficulty, bloom, board, role, status, language, phase]).toEqual([
      "CASE_BASED",
      "HARD",
      "ANALYSE",
      "CBSE",
      "CONTENT_EDITOR",
      "SUSPENDED",
      "HINDI",
      "PHASE_2",
    ]);
  });
});
