import { z } from "zod";

import { boardSchema, classLevelSchema } from "../question/question-enums.js";

/**
 * Admin taxonomy: creating and editing subjects, chapters and topics.
 *
 * Three rules are encoded here rather than left to the handler, because each one
 * is the kind of thing that is obvious in review and invisible six months later.
 *
 * **1. A slug is a URL, so it is never derived from a rename.** `name` and `slug`
 * are separate fields and updating one does not touch the other. Auto-slugging on
 * every rename means fixing a typo in "Real Numbers" silently 404s every link a
 * teacher pasted into a WhatsApp group, and nobody finds out — the old URL does
 * not error loudly, it just stops existing. Changing a slug therefore has to be
 * asked for explicitly.
 *
 * **2. Deletion is deactivation.** There is no delete input in this file. The
 * foreign keys are `onDelete: Restrict`, so the database will not let a chapter
 * holding questions be removed anyway; `isActive` is the real operation, and it
 * is reversible, which a `DELETE` is not.
 *
 * **3. Ordering is set for a whole list at once, not per row.** See
 * `reorderInputSchema`.
 */

/**
 * Lowercase, hyphenated, no leading/trailing/doubled hyphens.
 *
 * Validated rather than sanitised. Silently rewriting `Real Numbers` to
 * `real-numbers` looks helpful until an editor types a slug, sees a different one
 * appear, and stops trusting the form. Rejecting it with the rule stated is
 * clearer, and `slugify` on the client can still offer a suggestion.
 */
export const slugSchema = z
  .string()
  .min(2)
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "use lowercase letters, numbers and single hyphens — for example class-10-science",
  );

/** A short stable code blueprints reference: "MATH", "SCI", "PHY". */
export const subjectCodeSchema = z
  .string()
  .min(2)
  .max(16)
  .regex(/^[A-Z0-9_]+$/, "use uppercase letters, numbers and underscores — for example SCI");

const nameSchema = z.string().min(2).max(160);

/** CBSE writes syllabuses per academic year: "2025-26". */
export const syllabusYearSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, "use an academic year like 2025-26");

/**
 * Marks are never assumed constant (docs/07 §3): 80 for Class 10, 70 for Class 12
 * Physics. The bound is a sanity check on a typo, not a rule about CBSE.
 */
const marksSchema = z.int().min(1).max(200);

export const createSubjectInputSchema = z.object({
  board: boardSchema.default("CBSE"),
  classLevel: classLevelSchema,
  code: subjectCodeSchema,
  name: nameSchema,
  slug: slugSchema,
  /** Maths Basic vs Standard. Null, not "", for a subject with no variants. */
  variant: z.string().min(1).max(60).nullable().default(null),
  theoryMarks: marksSchema,
  hasPractical: z.boolean().default(false),
  internalMarks: z.int().min(0).max(100).default(0),
  syllabusYear: syllabusYearSchema,
});

export type CreateSubjectInput = z.infer<typeof createSubjectInputSchema>;

/**
 * `board` and `classLevel` are absent on purpose.
 *
 * They are two of the four columns in the subject's uniqueness key, and every
 * chapter, question, enrolment and blueprint below a subject was written on the
 * assumption that they hold. Moving a subject from Class 10 to Class 12 would
 * silently relabel thousands of rows. If that is ever genuinely needed it is a
 * migration, not a PATCH.
 */
export const updateSubjectInputSchema = z
  .object({
    code: subjectCodeSchema,
    name: nameSchema,
    slug: slugSchema,
    variant: z.string().min(1).max(60).nullable(),
    theoryMarks: marksSchema,
    hasPractical: z.boolean(),
    internalMarks: z.int().min(0).max(100),
    syllabusYear: syllabusYearSchema,
    isActive: z.boolean(),
  })
  .partial()
  .check((ctx) => {
    if (Object.keys(ctx.value).length === 0) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value,
        message: "provide at least one field to update",
      });
    }
  });

export type UpdateSubjectInput = z.infer<typeof updateSubjectInputSchema>;

export const createChapterInputSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  /** NCERT's own numbering, which is what students navigate by. */
  ncertChapterNo: z.int().min(1).max(60).nullable().default(null),
  /**
   * "Physics" / "Chemistry" / "Biology" for Class 10 Science; null for Maths.
   *
   * Free text rather than an enum because Class 12 groups by syllabus unit names
   * that differ per subject, and an enum would need editing to add a subject —
   * which is exactly the hard-coded exam structure docs/07 §3 forbids.
   */
  domain: z.string().min(1).max(60).nullable().default(null),
  /** Appended to the end when omitted, which is what "add a chapter" means. */
  orderIndex: z.int().min(0).max(999).optional(),
});

export type CreateChapterInput = z.infer<typeof createChapterInputSchema>;

/**
 * `subjectId` is absent for the same reason `classLevel` is absent above: the
 * questions under a chapter carry their own `subjectId`, so moving the chapter
 * alone would split a chapter from its questions across two subjects.
 */
export const updateChapterInputSchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    ncertChapterNo: z.int().min(1).max(60).nullable(),
    domain: z.string().min(1).max(60).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .check((ctx) => {
    if (Object.keys(ctx.value).length === 0) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value,
        message: "provide at least one field to update",
      });
    }
  });

export type UpdateChapterInput = z.infer<typeof updateChapterInputSchema>;

export const createTopicInputSchema = z.object({
  name: nameSchema,
  slug: slugSchema,
  orderIndex: z.int().min(0).max(999).optional(),
});

export type CreateTopicInput = z.infer<typeof createTopicInputSchema>;

export const updateTopicInputSchema = z
  .object({
    name: nameSchema,
    slug: slugSchema,
    isActive: z.boolean(),
  })
  .partial()
  .check((ctx) => {
    if (Object.keys(ctx.value).length === 0) {
      ctx.issues.push({
        code: "custom",
        input: ctx.value,
        message: "provide at least one field to update",
      });
    }
  });

export type UpdateTopicInput = z.infer<typeof updateTopicInputSchema>;

/**
 * Reordering: the complete list of ids, in the order they should appear.
 *
 * The alternative — `PATCH /chapters/:id { orderIndex }` per row — is how
 * ordering bugs happen. Dragging chapter 7 to position 2 is five row updates,
 * and between the first and the last the list has duplicate indexes; a reader
 * hitting that window sees chapters in an order that does not exist. Worse, if
 * the third request fails the list stays wrong with nothing to indicate it.
 *
 * Sending the whole order makes it one transaction with one meaning, and lets
 * the server reject a list that is missing an id or contains one from another
 * subject — neither of which is detectable one row at a time.
 */
export const reorderInputSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(999),
});

export type ReorderInput = z.infer<typeof reorderInputSchema>;

/**
 * What an editor sees, which is not what a student sees.
 *
 * Inactive rows and question counts that include drafts are the whole point of
 * an admin view: an editor needs to know a chapter has 14 unpublished questions
 * before withdrawing it, and a student must never learn that drafts exist.
 * Distinct schemas rather than a flag on the student one, for the same reason
 * `StudentQuestion` has no `answer` property.
 */
export const adminTopicSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  orderIndex: z.int(),
  isActive: z.boolean(),
  questionCount: z.int().nonnegative(),
});

export type AdminTopic = z.infer<typeof adminTopicSchema>;

export const adminChapterSchema = z.object({
  id: z.string().min(1),
  subjectId: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  orderIndex: z.int(),
  ncertChapterNo: z.int().nullable(),
  domain: z.string().nullable(),
  isActive: z.boolean(),
  /** Every question, drafts included. */
  questionCount: z.int().nonnegative(),
  publishedQuestionCount: z.int().nonnegative(),
  topics: z.array(adminTopicSchema),
});

export type AdminChapter = z.infer<typeof adminChapterSchema>;

export const adminSubjectSchema = z.object({
  id: z.string().min(1),
  board: boardSchema,
  classLevel: z.int(),
  code: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  variant: z.string().nullable(),
  theoryMarks: z.int(),
  hasPractical: z.boolean(),
  internalMarks: z.int(),
  syllabusYear: z.string().min(1),
  isActive: z.boolean(),
  orderIndex: z.int(),
  chapterCount: z.int().nonnegative(),
  questionCount: z.int().nonnegative(),
});

export type AdminSubject = z.infer<typeof adminSubjectSchema>;

export const adminSubjectListResponseSchema = z.object({
  subjects: z.array(adminSubjectSchema),
});

export type AdminSubjectListResponse = z.infer<typeof adminSubjectListResponseSchema>;

export const adminChapterListResponseSchema = z.object({
  chapters: z.array(adminChapterSchema),
});

export type AdminChapterListResponse = z.infer<typeof adminChapterListResponseSchema>;

/**
 * Admin listing shows inactive rows by default — hiding them is how an editor
 * ends up recreating a chapter that already exists and hitting a slug conflict
 * they cannot see the cause of.
 */
/**
 * A boolean that survives being parsed twice.
 *
 * Query strings only carry text, so this has to accept `"true"`. But `validate()`
 * *replaces* `req.query` with the parsed output before the handler runs, and the
 * handler parses again to recover the type (see `parseBody`'s reasoning). A
 * schema that only accepts strings would reject its own output on that second
 * pass — a 400 on a request that was perfectly valid. Accepting both makes the
 * parse idempotent, which is a property any schema sitting behind that
 * middleware needs.
 */
export const booleanFlagSchema = z
  .union([z.boolean(), z.enum(["true", "false"]).transform((value) => value === "true")])
  .default(true);

export const adminListSubjectsQuerySchema = z.object({
  board: boardSchema.optional(),
  classLevel: z.coerce.number().pipe(classLevelSchema).optional(),
  includeInactive: booleanFlagSchema,
});

export type AdminListSubjectsQuery = z.infer<typeof adminListSubjectsQuerySchema>;
