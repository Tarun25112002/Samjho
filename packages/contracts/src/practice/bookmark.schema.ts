import { z } from "zod";

import { studentQuestionSchema } from "../question/question.schema.js";

/**
 * Saved questions.
 *
 * Small enough to look like it did not need its own contract, and it does: a
 * bookmark is one of the six things a practice set can be drawn from, so its
 * question id has to mean the same thing here as it does in the selection
 * service. Defining the shape once is what makes "practise my bookmarks" a
 * filter rather than a feature.
 */

export const createBookmarkSchema = z.object({
  questionId: z.string().min(1).max(60),
  /** A student's own words about why they saved it. */
  note: z.string().trim().max(500).nullable().default(null),
});

export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;

export const bookmarkSchema = z.object({
  id: z.string().min(1),
  questionId: z.string().min(1),
  note: z.string().nullable(),
  createdAt: z.iso.datetime(),
});

export type Bookmark = z.infer<typeof bookmarkSchema>;

/** The list view, where a student is choosing what to revisit. */
export const bookmarkWithQuestionSchema = bookmarkSchema.extend({
  question: studentQuestionSchema,
});

export type BookmarkWithQuestion = z.infer<typeof bookmarkWithQuestionSchema>;

/**
 * Toggling returns the new state rather than 204.
 *
 * The bookmark button is optimistic, so the client already believes it knows the
 * answer. Returning it lets the client reconcile instead of guess — which
 * matters on the one path that actually happens: two tabs open on the same
 * question.
 */
export const bookmarkStateSchema = z.object({
  questionId: z.string().min(1),
  bookmarked: z.boolean(),
  note: z.string().nullable(),
});

export type BookmarkState = z.infer<typeof bookmarkStateSchema>;
