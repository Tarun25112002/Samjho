import { z } from "zod";

import { importRowErrorSchema } from "../question/import.schema.js";
import { licenceStatusSchema, questionStatusSchema } from "../question/question-enums.js";
import { booleanFlag, pastPaperYearSchema } from "../question/question.schema.js";

/**
 * Previous-year papers: the registry, and the pipeline that fills it.
 *
 * ## What a registry row is for
 *
 * "Add every CBSE paper from 2001" is a content project spanning a few thousand
 * questions, and the first thing a project like that needs is a list of what has
 * *not* been done. A `PastPaper` row is that list entry. It is created empty —
 * year and sitting and nothing else — and fills up as papers are sourced.
 *
 * Which is why coverage is a fraction with a nullable denominator.
 * `printedQuestionCount` is null until a human has the paper in front of them
 * and counts, and "38 of 38" and "12 of unknown" are genuinely different states:
 * the second cannot be called complete, and rounding it to a percentage would
 * invent a number nobody measured.
 *
 * ## Why provenance lives on the paper, not on the row
 *
 * An ingest file carries the paper header once and the questions without it. The
 * service stamps year, session, code, set and licence onto every question it
 * writes. The alternative — provenance repeated per row — is thirty-eight
 * chances for one question to claim it came from a different paper than the file
 * it is in, which is the class of error the provenance fields exist to prevent
 * (docs/07 R2). A row carrying its own `source` is rejected rather than merged.
 */

/**
 * How a paper's content is being reproduced, and therefore what `SourceType`
 * every question from it carries.
 *
 * The three values are the only defensible ones. `ORIGINAL` cannot describe a
 * question taken from a paper, `NCERT` is a different corpus, and `THIRD_PARTY`
 * describes a publisher's book rather than the board's own paper — allowing any
 * of them here would let a file mislabel its own provenance.
 */
export const pastPaperReproductionSchema = z.enum([
  "CBSE_BOARD_PAPER",
  "CBSE_SAMPLE_PAPER",
  "ADAPTED",
]);

export type PastPaperReproduction = z.infer<typeof pastPaperReproductionSchema>;

// ── The registry row ─────────────────────────────────────────────────────────

const paperIdentityShape = {
  year: pastPaperYearSchema,
  /**
   * The sitting as CBSE names it: "March", "February", "May", "Compartment".
   *
   * Free text rather than an enum, because the sitting calendar has already
   * changed twice inside the range this table covers — one March sitting for
   * most of it, a suspended one in 2020, two sittings from 2026 — and an enum
   * would need a migration the next time the board reorganises its year.
   */
  examSession: z.string().trim().min(1).max(40),
  /** CBSE's own paper code, e.g. "30/1/1". Null until someone holds the paper. */
  paperCode: z.string().trim().max(40).nullable().default(null),
  /** The set within a code: "1", "2", "3". Null where the paper had one set. */
  setCode: z.string().trim().max(20).nullable().default(null),
  /** "Delhi", "Outside Delhi", "Foreign" — a real split in the older years. */
  region: z.string().trim().max(40).nullable().default(null),
};

export const writePastPaperInputSchema = z
  .object({
    subjectId: z.string().min(1).max(60),
    ...paperIdentityShape,
    printedQuestionCount: z.int().min(1).max(200).nullable().default(null),
    totalMarks: z.int().min(1).max(200).nullable().default(null),
    /** False for a sitting that never happened — 2021, and half of 2020. */
    wasHeld: z.boolean().default(true),
    sourceUrl: z.url().max(500).nullable().default(null),
    licenceStatus: licenceStatusSchema.default("NEEDS_REVIEW"),
    notes: z.string().trim().max(1000).nullable().default(null),
  })
  .check((ctx) => {
    const value = ctx.value;

    // A permanent hole in the coverage grid with no explanation gets
    // re-investigated by a different person every quarter, and the answer is
    // never in the database.
    if (!value.wasHeld && !value.notes) {
      ctx.issues.push({
        code: "custom",
        input: value.notes,
        path: ["notes"],
        message: "a paper marked as not held must record why",
      });
    }

    if (!value.wasHeld && value.printedQuestionCount !== null) {
      ctx.issues.push({
        code: "custom",
        input: value.printedQuestionCount,
        path: ["printedQuestionCount"],
        message: "a paper that was never held has no questions to count",
      });
    }
  });

export type WritePastPaperInput = z.infer<typeof writePastPaperInputSchema>;

export const pastPaperSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  subjectName: z.string().min(1),
  classLevel: z.int(),

  year: z.int(),
  examSession: z.string(),
  paperCode: z.string().nullable(),
  setCode: z.string().nullable(),
  region: z.string().nullable(),

  /** "CBSE 2024 · March · 30/1/1 Set 1" — one string, built server-side once. */
  label: z.string().min(1),

  printedQuestionCount: z.int().nullable(),
  totalMarks: z.int().nullable(),
  wasHeld: z.boolean(),
  sourceUrl: z.string().nullable(),
  licenceStatus: licenceStatusSchema,
  notes: z.string().nullable(),

  /** Top-level questions in the bank filed against this paper, any status. */
  importedQuestions: z.int().nonnegative(),
  /** Of those, the ones a student can actually be shown. */
  publishedQuestions: z.int().nonnegative(),
  /**
   * `importedQuestions / printedQuestionCount`, or null when nobody has counted
   * the printed paper. Null rather than 0 or 1: an unknown denominator makes the
   * fraction unknown, and a coverage bar reading 100% because the denominator
   * defaulted is worse than one reading "not counted".
   */
  coverage: z.number().min(0).max(1).nullable(),

  updatedAt: z.iso.datetime(),
});

export type PastPaper = z.infer<typeof pastPaperSchema>;

export const listPastPapersQuerySchema = z.object({
  subjectId: z.string().min(1).max(60).optional(),
  yearFrom: z.coerce.number().int().min(1990).max(2100).optional(),
  yearTo: z.coerce.number().int().min(1990).max(2100).optional(),
  /** Papers still short of their printed count — the work queue. */
  incompleteOnly: booleanFlag().optional(),
  /** Cancelled sittings are hidden by default; they are not work to be done. */
  includeNotHeld: booleanFlag().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListPastPapersQuery = z.infer<typeof listPastPapersQuerySchema>;

// ── Coverage ─────────────────────────────────────────────────────────────────

export const pastPaperYearCoverageSchema = z.object({
  year: z.int(),
  /** Registered papers for the year, held or not. */
  papers: z.int().nonnegative(),
  /** Of those, sittings that actually happened. */
  held: z.int().nonnegative(),
  importedQuestions: z.int().nonnegative(),
  /** Sum of `printedQuestionCount`, or null while any of them is uncounted. */
  printedQuestions: z.int().nonnegative().nullable(),
});

export type PastPaperYearCoverage = z.infer<typeof pastPaperYearCoverageSchema>;

/**
 * The backlog, per subject, one row per year.
 *
 * The screen that answers "how far through 2001-2026 are we", which is the only
 * honest way to report progress on a project whose finish line is thousands of
 * questions away.
 */
export const pastPaperCoverageSchema = z.object({
  subjectId: z.string().min(1),
  subjectName: z.string().min(1),
  classLevel: z.int(),
  years: z.array(pastPaperYearCoverageSchema),
  totalPapers: z.int().nonnegative(),
  papersWithQuestions: z.int().nonnegative(),
  importedQuestions: z.int().nonnegative(),
});

export type PastPaperCoverage = z.infer<typeof pastPaperCoverageSchema>;

/**
 * The years a student can filter practice by, for one subject.
 *
 * Only years with published questions appear. A chip that produces an empty set
 * is worse than an absent chip: the student concludes the feature is broken
 * rather than that the bank has not reached 2009 yet.
 */
export const pastPaperYearOptionSchema = z.object({
  year: z.int(),
  questionCount: z.int().positive(),
});

export type PastPaperYearOption = z.infer<typeof pastPaperYearOptionSchema>;

// ── Ingest ───────────────────────────────────────────────────────────────────

/**
 * One question as it appears in an ingest file.
 *
 * Loose, for the same reason `importQuestionRowSchema` is loose: the question
 * half of the row is parsed a second time against `writeQuestionInputSchema`, so
 * there is exactly one validator for a question however it entered the system. A
 * strict object here would strip the question before the second parse saw it.
 */
export const ingestPastPaperRowSchema = z.looseObject({
  /**
   * The number as printed on the paper — "12", "31(a)", "36(iii)".
   *
   * Required, unlike the free-form `ref` on a plain import. It is what a student
   * is shown under the question ("CBSE 2024, Q12"), what an editor uses to find
   * the question in the PDF again, and what makes a re-ingest of a corrected
   * file line up against what was written the first time.
   */
  questionNumber: z.string().trim().min(1).max(20),
  /** Chapter slug in the *current* syllabus, not the one the paper was set on. */
  chapter: z.string().trim().min(1).max(120),
  /** Topic slugs. The first is the primary one mastery is attributed to. */
  topics: z.array(z.string().trim().min(1).max(120)).min(1).max(5),
});

export type IngestPastPaperRow = z.infer<typeof ingestPastPaperRowSchema>;

export const ingestPastPaperInputSchema = z.object({
  subjectId: z.string().min(1).max(60),

  /**
   * Which paper this file is. Matched against the registry on identity and
   * created if absent, so a file for a paper nobody registered still lands
   * somewhere — the backlog is a convenience, not a gate.
   */
  paper: z.object({
    ...paperIdentityShape,
    printedQuestionCount: z.int().min(1).max(200).nullable().default(null),
    totalMarks: z.int().min(1).max(200).nullable().default(null),
    sourceUrl: z.url().max(500).nullable().default(null),
  }),

  /**
   * How the content is reproduced. No default: a file that does not say whether
   * it is copying the board's words or rewriting them has not made the decision
   * `licenceStatus` exists to record.
   */
  reproduction: pastPaperReproductionSchema,

  /**
   * The licensing call for this paper, applied to every question in it.
   *
   * Defaults to `NEEDS_REVIEW`, which is also the value that blocks publication
   * — so an ingest that says nothing about licensing produces drafts a human has
   * to clear, rather than live content nobody decided on.
   */
  licenceStatus: licenceStatusSchema.default("NEEDS_REVIEW"),

  /** Overrides the sentence built from the paper header, where one is needed. */
  attributionText: z.string().trim().min(1).max(300).optional(),

  dryRun: z.boolean().default(true),
  status: questionStatusSchema.default("DRAFT"),

  /**
   * Capped at one paper's worth. A CBSE paper is under 40 numbered questions, so
   * 200 leaves room for sub-parts entered as separate rows and still keeps a
   * single transaction bounded.
   */
  rows: z.array(ingestPastPaperRowSchema).min(1).max(200),
});

export type IngestPastPaperInput = z.infer<typeof ingestPastPaperInputSchema>;

/**
 * The outcome of an ingest.
 *
 * The same all-or-nothing contract as a plain import — `written` is every row or
 * none — with the paper it landed against reported back, because the caller of a
 * dry run wants to know *which* registry row their file matched before they
 * write to it. `pastPaperId` is null on a dry run that would have created the
 * paper, the one case where there is no id to report yet.
 */
export const ingestPastPaperResultSchema = z.object({
  dryRun: z.boolean(),
  pastPaperId: z.string().nullable(),
  paperLabel: z.string().min(1),
  /** True when this run creates the registry row rather than reusing one. */
  paperCreated: z.boolean(),
  total: z.int().nonnegative(),
  valid: z.int().nonnegative(),
  written: z.int().nonnegative(),
  /** Questions already filed against this paper before the run. */
  alreadyOnPaper: z.int().nonnegative(),
  printedQuestionCount: z.int().nullable(),
  errors: z.array(importRowErrorSchema),
});

export type IngestPastPaperResult = z.infer<typeof ingestPastPaperResultSchema>;

/**
 * The label a paper is shown under, built in one place.
 *
 * Server-side rather than in the web app because three different surfaces need
 * it — the coverage grid, the provenance line under a question, and the ingest
 * report — and a label assembled independently in each is three chances to
 * render the same paper by two different names.
 */
export function pastPaperLabel(paper: {
  year: number;
  examSession: string;
  paperCode?: string | null;
  setCode?: string | null;
  region?: string | null;
}): string {
  const parts = [`CBSE ${String(paper.year)}`, paper.examSession];

  // The code and the set are one identifier printed on one line of the paper —
  // "30/1/1 Set 1" — so they stay together rather than being separated by the
  // same dot that divides year from session.
  const code = [paper.paperCode, paper.setCode ? `Set ${paper.setCode}` : null]
    .filter(Boolean)
    .join(" ");
  if (code) parts.push(code);

  if (paper.region) parts.push(paper.region);
  return parts.join(" · ");
}
