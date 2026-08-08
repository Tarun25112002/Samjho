import type {
  BloomLevel,
  Difficulty,
  LicenceStatus,
  QuestionType,
  SourceType,
} from "../../src/generated/prisma/enums.js";

/**
 * The authoring shape for seed content.
 *
 * This is deliberately *not* the Prisma input type. Writing questions directly
 * as Prisma creates would mean hand-managing foreign keys, nested creates and
 * connect clauses for every one of them — noise that buries the actual content
 * and makes a typo in a chapter id look exactly like a typo in an answer.
 *
 * Instead: content refers to chapters and topics by slug, and the loader
 * resolves them. A wrong slug fails loudly at seed time with the slug in the
 * message, which is the error message you want at 40 questions and desperately
 * want at 4,000.
 */

export interface SeedOption {
  label: string;
  body: string;
  isCorrect?: boolean;
}

export interface SeedAnswer {
  correctValue?: string;
  acceptedValues?: string[];
  tolerance?: number;
  unit?: string;
  solution: string;
  /** Step-by-step marks allocation, mirroring CBSE's own marking schemes. */
  markingScheme?: { step: string; marks: number }[];
  explanation?: string;
}

export interface SeedSource {
  sourceType: SourceType;
  year?: number;
  examSession?: string;
  originalQuestionNumber?: string;
  licenceStatus: LicenceStatus;
  attributionText?: string;
}

/** A sub-part of a case-based or multi-part question. */
export interface SeedSubPart {
  key: string;
  type: QuestionType;
  body: string;
  marks: number;
  /** Sub-parts may sit on a different topic from their parent — real ones do. */
  topics?: string[];
  options?: SeedOption[];
  answer: SeedAnswer;
  expectedTimeSeconds?: number;
}

export interface SeedQuestion {
  /** Stable suffix for the deterministic row id. Never reused, never renumbered. */
  key: string;
  /** Chapter slug within the subject. */
  chapter: string;
  /** Topic slugs; the first is the primary one that mastery is attributed to. */
  topics: string[];
  type: QuestionType;
  body: string;
  marks: number;
  difficulty: Difficulty;
  bloomLevel: BloomLevel;
  expectedTimeSeconds: number;
  options?: SeedOption[];
  /** Containers hold no answer of their own — their sub-parts do. */
  answer?: SeedAnswer;
  source: SeedSource;
  /** Present only on case-based / multi-part containers. */
  subParts?: SeedSubPart[];
}

export interface SeedTopic {
  slug: string;
  name: string;
}

export interface SeedChapter {
  slug: string;
  name: string;
  ncertChapterNo: number;
  /**
   * Physics / Chemistry / Biology for Class 10 Science. Undefined for Maths,
   * which genuinely has no such grouping — see docs/03-data-model.md §2.6.
   */
  domain?: string;
  topics: SeedTopic[];
}
