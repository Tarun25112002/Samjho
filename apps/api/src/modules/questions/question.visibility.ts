import type { Prisma } from "../../generated/prisma/client.js";

/**
 * The single definition of "a question a student may be shown".
 *
 * Two independent rules, and both are easy to forget one query at a time:
 *
 *  1. **Published only.** Drafts are half-written by definition, and an
 *     in-review question is one an editor has flagged as wrong.
 *  2. **Not licence-RESTRICTED.** `docs/07` R2 — commercial intent turns
 *     copyright from a portfolio-project footnote into a critical risk, and
 *     `QuestionSource.licenceStatus` exists so a question can be kept for
 *     reference while being unservable. That is only true if *every* query
 *     filters it out.
 *
 * Exported as a constant rather than described in a comment on each repository
 * method, because "remember to add this WHERE clause" is not a control. The one
 * place a new query can go wrong is forgetting to spread this in — which is
 * visible in review in a way a missing predicate buried in a 20-line `where` is
 * not.
 *
 * `NOT: { source: {...} }` rather than `source: { isNot: {...} }`: most
 * questions have no source row at all, and the negated form treats a missing
 * relation as passing, which is what we want. A question with no recorded
 * provenance is a content-quality problem, not a licensing violation.
 *
 * 3. **Its chapter and subject are still active.** Deactivating is the only
 *    "delete" the taxonomy has — the foreign keys are `onDelete: Restrict`, so a
 *    chapter holding questions cannot be removed and an editor withdraws it
 *    instead. Without this clause the chapter would vanish from browsing while
 *    its questions carried on being served by `/questions?chapterId=…` and
 *    picked for practice: withdrawn in the one place a human looks, live
 *    everywhere that matters.
 */
export const STUDENT_VISIBLE_QUESTION: Prisma.QuestionWhereInput = {
  status: "PUBLISHED",
  NOT: { source: { licenceStatus: "RESTRICTED" } },
  chapter: { isActive: true, subject: { isActive: true } },
};

/**
 * Student-visible *and* top-level.
 *
 * Counting sub-parts as questions would tell a student a chapter has 47
 * questions when a paper would call it 38: a case study is one question worth
 * four marks, not three questions. Every count a student sees uses this.
 */
export const STUDENT_VISIBLE_TOP_LEVEL: Prisma.QuestionWhereInput = {
  ...STUDENT_VISIBLE_QUESTION,
  parentId: null,
};
