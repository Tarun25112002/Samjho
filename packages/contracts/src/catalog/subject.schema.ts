import { z } from "zod";

import { boardSchema, classLevelSchema } from "../question/question-enums.js";

/**
 * Subject shapes shared by the catalog and the profile.
 *
 * The full catalog — chapters, topics, question counts — lands in Phase 3. This
 * file holds only what the onboarding wizard and the profile page need: enough
 * to render a subject chip and know which paper it corresponds to.
 */

export const subjectSummarySchema = z.object({
  id: z.string().min(1),
  /** Stable short code used by exam blueprints: "MATH", "SCI", "PHY". */
  code: z.string().min(2),
  name: z.string().min(1),
  slug: z.string().min(1),
  /** Maths Basic vs Standard. Null for subjects that have no variants. */
  variant: z.string().nullable(),
  classLevel: z.int(),
  /** 80 for Class 10, 70 for Class 12 Physics — never assume a constant. */
  theoryMarks: z.int(),
});

export type SubjectSummary = z.infer<typeof subjectSummarySchema>;

export const listSubjectsQuerySchema = z.object({
  board: boardSchema.default("CBSE"),
  // Query strings are always strings; coerce first, then hold it to the same
  // 10-or-12 union the rest of the system uses. `z.coerce.number()` alone would
  // happily accept 11.
  classLevel: z.coerce.number().pipe(classLevelSchema),
});

export type ListSubjectsQuery = z.infer<typeof listSubjectsQuerySchema>;

export const subjectListResponseSchema = z.object({
  subjects: z.array(subjectSummarySchema),
});

export type SubjectListResponse = z.infer<typeof subjectListResponseSchema>;
