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
  // 4. **It belongs to the shared bank, not to one teacher.**
  //
  //    A teacher's uploaded paper produces real questions, published into their
  //    own bank and drawn for their own classroom's assignments. They have not
  //    been through editorial review, their licensing has not been decided by
  //    anyone whose job that is, and they were transcribed from a scan by a
  //    model. Any one of those is a reason to keep them off open practice; the
  //    three together are the reason this clause is in the shared predicate
  //    rather than added to the practice selector — a question bank that leaks
  //    one classroom's homework to every student in the country is the failure
  //    that would be found last and cost most.
  ownerTeacherId: null,
};

/**
 * The same rules, for questions one teacher owns.
 *
 * Everything `STUDENT_VISIBLE_QUESTION` requires still applies — published,
 * licence-clear, in an active chapter — because a teacher's draft is as
 * half-written as an editor's, and an assignment that materialised one would
 * put it in front of a class.
 *
 * Written as a function rather than a constant, since the owner is a parameter.
 * That is also what makes it impossible to use by accident: there is no value
 * to spread in without saying whose bank you meant.
 */
export function teacherVisibleQuestion(teacherId: string): Prisma.QuestionWhereInput {
  return {
    status: "PUBLISHED",
    NOT: { source: { licenceStatus: "RESTRICTED" } },
    chapter: { isActive: true, subject: { isActive: true } },
    ownerTeacherId: teacherId,
  };
}

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
