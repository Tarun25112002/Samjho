import {
  aiActionSchema,
  aiContextSchema,
  aiRoleSchema,
  bloomLevelSchema,
  boardSchema,
  conversationStatusSchema,
  difficultySchema,
  evaluationModeSchema,
  examPhaseSchema,
  languageSchema,
  mistakeReasonSchema,
  practiceModeSchema,
  questionTypeSchema,
  roleSchema,
  sessionStatusSchema,
  userStatusSchema,
  type AIAction,
  type AIContext,
  type AIRole,
  type BloomLevel,
  type Board,
  type ConversationStatus,
  type Difficulty,
  type EvaluationMode,
  type ExamPhase,
  type Language,
  type MistakeReason,
  type PracticeMode,
  type QuestionType,
  type Role,
  type SessionStatus,
  type UserStatus,
} from "@samjho/contracts";
import { describe, expect, it } from "vitest";

import {
  AIAction as PrismaAIAction,
  AIContext as PrismaAIContext,
  AIRole as PrismaAIRole,
  BloomLevel as PrismaBloomLevel,
  Board as PrismaBoard,
  ConversationStatus as PrismaConversationStatus,
  Difficulty as PrismaDifficulty,
  EvaluationMode as PrismaEvaluationMode,
  ExamPhase as PrismaExamPhase,
  Language as PrismaLanguage,
  MistakeReason as PrismaMistakeReason,
  PracticeMode as PrismaPracticeMode,
  QuestionType as PrismaQuestionType,
  Role as PrismaRole,
  SessionStatus as PrismaSessionStatus,
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
    ["PracticeMode", PrismaPracticeMode, practiceModeSchema.options],
    ["SessionStatus", PrismaSessionStatus, sessionStatusSchema.options],
    ["EvaluationMode", PrismaEvaluationMode, evaluationModeSchema.options],
    ["MistakeReason", PrismaMistakeReason, mistakeReasonSchema.options],
    ["AIContext", PrismaAIContext, aiContextSchema.options],
    ["AIRole", PrismaAIRole, aiRoleSchema.options],
    ["AIAction", PrismaAIAction, aiActionSchema.options],
    ["ConversationStatus", PrismaConversationStatus, conversationStatusSchema.options],
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
    const mode: PracticeMode = PrismaPracticeMode.MISTAKE_REVIEW;
    const session: SessionStatus = PrismaSessionStatus.COMPLETED;
    const evaluation: EvaluationMode = PrismaEvaluationMode.PENDING;
    const reason: MistakeReason = PrismaMistakeReason.CALCULATION_ERROR;
    const aiContext: AIContext = PrismaAIContext.REVIEW;
    const aiRole: AIRole = PrismaAIRole.ASSISTANT;
    const aiAction: AIAction = PrismaAIAction.STEP_BY_STEP;
    const conversation: ConversationStatus = PrismaConversationStatus.ARCHIVED;

    expect([
      type,
      difficulty,
      bloom,
      board,
      role,
      status,
      language,
      phase,
      mode,
      session,
      evaluation,
      reason,
      aiContext,
      aiRole,
      aiAction,
      conversation,
    ]).toEqual([
      "CASE_BASED",
      "HARD",
      "ANALYSE",
      "CBSE",
      "CONTENT_EDITOR",
      "SUSPENDED",
      "HINDI",
      "PHASE_2",
      "MISTAKE_REVIEW",
      "COMPLETED",
      "PENDING",
      "CALCULATION_ERROR",
      "REVIEW",
      "ASSISTANT",
      "STEP_BY_STEP",
      "ARCHIVED",
    ]);
  });
});
