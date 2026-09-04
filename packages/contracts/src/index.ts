/**
 * @samjho/contracts
 *
 * The single source of truth for everything that crosses the network boundary
 * between apps/web and apps/api.
 *
 * The rule: define a Zod schema, then *derive* the TypeScript type from it with
 * `z.infer`. Never hand-write a type that parallels a schema — the moment those
 * two drift, the compiler stops protecting you and you find out in production.
 *
 * The API validates incoming requests with these schemas at runtime; the web app
 * types its responses from them at compile time. One definition, both jobs.
 */

export * from "./common/envelope.js";
export * from "./common/pagination.js";
export * from "./common/error-codes.js";
export * from "./health/health.schema.js";
export * from "./question/question-enums.js";
export * from "./question/question.schema.js";
export * from "./question/admin.schema.js";
export * from "./question/import.schema.js";
export * from "./exam/exam-enums.js";
export * from "./exam/paper.schema.js";
export * from "./exam/past-paper.schema.js";
export * from "./practice/practice-enums.js";
export * from "./practice/answer.schema.js";
export * from "./practice/session.schema.js";
export * from "./practice/bookmark.schema.js";
export * from "./catalog/subject.schema.js";
export * from "./catalog/chapter.schema.js";
export * from "./catalog/admin.schema.js";
export * from "./classroom/classroom.schema.js";
export * from "./auth/auth-enums.js";
export * from "./auth/me.schema.js";
export * from "./auth/onboarding.schema.js";
