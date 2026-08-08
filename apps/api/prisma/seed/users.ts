import { createHash } from "node:crypto";

import type { PrismaClient } from "../../src/generated/prisma/client.js";
import { seedId } from "./helpers.js";

/**
 * Demo users, and — more usefully — demo *history*.
 *
 * Seeding three empty accounts would be easy and nearly worthless. Dashboards,
 * weak-topic detection and mistake review are all features whose bugs only
 * appear against real data, and a dashboard developed against an empty state is
 * a dashboard that has only ever been seen in its empty state.
 *
 * So the two students below have opposite shapes: one is doing well and has
 * covered most of the seeded content, the other is struggling and has attempted
 * about half as much. Phase 8's "you are weak at Chemistry" logic has something
 * to be right or wrong about from the day it is written.
 */

const DEMO_STUDENTS = [
  {
    key: "aarav",
    clerkId: "user_seed_aarav_demo",
    email: "aarav.demo@samjho.test",
    name: "Aarav Sharma",
    school: "Delhi Public School, Bengaluru",
    /** Roughly the share of questions this student gets right. */
    accuracy: 0.78,
    /** Share of the available question set they have attempted. */
    coverage: 0.85,
  },
  {
    key: "diya",
    clerkId: "user_seed_diya_demo",
    email: "diya.demo@samjho.test",
    name: "Diya Patel",
    school: "Kendriya Vidyalaya, Pune",
    accuracy: 0.41,
    coverage: 0.45,
  },
] as const;

/**
 * Deterministic pseudo-randomness in [0, 1).
 *
 * The seed must produce the same database every time it runs, so `Math.random`
 * is not available — a student who was weak at Electricity yesterday must still
 * be weak at Electricity after a re-seed, or every screenshot, bug report and
 * test expectation built on the demo data silently rots.
 */
function stableUnitValue(...parts: string[]): number {
  const digest = createHash("sha256").update(parts.join("|")).digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

export interface SeededUsers {
  adminId: string;
  studentIds: string[];
}

export async function seedUsers(prisma: PrismaClient): Promise<SeededUsers> {
  const adminId = seedId("user", "admin");
  const admin = {
    clerkId: "user_seed_admin",
    email: "admin@samjho.test",
    name: "Samjho Admin",
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
  };
  await prisma.user.upsert({
    where: { id: adminId },
    create: { id: adminId, ...admin },
    update: admin,
  });

  const studentIds: string[] = [];

  for (const student of DEMO_STUDENTS) {
    const userId = seedId("user", student.key);
    const base = {
      clerkId: student.clerkId,
      email: student.email,
      name: student.name,
      role: "STUDENT" as const,
      status: "ACTIVE" as const,
    };
    await prisma.user.upsert({
      where: { id: userId },
      create: { id: userId, ...base },
      update: base,
    });

    const profileId = seedId("profile", student.key);
    const profile = {
      userId,
      classLevel: 10,
      board: "CBSE" as const,
      school: student.school,
      preferredLanguage: "ENGLISH" as const,
      onboardedAt: new Date("2026-07-01T00:00:00.000Z"),
      // Demo accounts carry a recorded parental consent because every Class 10
      // user is a minor under the DPDP Act. Seeding them without one would model
      // a state the real signup flow must never produce.
      parentEmail: `parent.${student.key}@samjho.test`,
      parentConsentAt: new Date("2026-07-01T00:00:00.000Z"),
    };
    await prisma.studentProfile.upsert({
      where: { id: profileId },
      create: { id: profileId, ...profile },
      update: profile,
    });

    // Both students are aiming at the February 2027 sitting — the mandatory
    // first attempt under the new two-exam system.
    const targetId = seedId("target", student.key);
    const target = {
      profileId,
      session: "2027",
      phase: "PHASE_1" as const,
      examDate: new Date("2027-02-17T00:00:00.000Z"),
    };
    await prisma.targetExam.upsert({
      where: { id: targetId },
      create: { id: targetId, ...target },
      update: target,
    });

    studentIds.push(userId);
  }

  return { adminId, studentIds };
}

export async function enrolStudents(prisma: PrismaClient, subjectIds: string[]): Promise<void> {
  for (const student of DEMO_STUDENTS) {
    const profileId = seedId("profile", student.key);
    for (const subjectId of subjectIds) {
      const id = seedId("enrol", student.key, subjectId);
      const data = { profileId, subjectId, isActive: true };
      await prisma.subjectEnrolment.upsert({
        where: { id },
        create: { id, ...data },
        update: data,
      });
    }
  }
}

/**
 * Give each demo student a practice history against one subject.
 *
 * Rollups are *recomputed* here rather than incremented. In production
 * `TopicMastery` is maintained incrementally inside the attempt transaction,
 * which is right for one attempt at a time and wrong for a seed: re-running
 * would double every figure. Recomputing from the attempts makes the seed
 * idempotent and, as a side effect, gives us a reference implementation of the
 * rollup to check the incremental version against in Phase 5.
 */
export async function seedPracticeHistory(
  prisma: PrismaClient,
  subject: { id: string; code: string },
): Promise<void> {
  // Only leaf questions are attemptable. Containers hold the stimulus and are
  // never answered directly, so including them would inflate every total.
  const questions = await prisma.question.findMany({
    where: { subjectId: subject.id, isContainer: false, status: "PUBLISHED" },
    select: {
      id: true,
      marks: true,
      chapterId: true,
      topics: { where: { isPrimary: true }, select: { topicId: true } },
    },
    orderBy: { id: "asc" },
  });

  for (const student of DEMO_STUDENTS) {
    const userId = seedId("user", student.key);
    const sessionId = seedId("session", student.key, subject.code);

    const attempted = questions.filter(
      (q) => stableUnitValue("coverage", student.key, q.id) < student.coverage,
    );

    const results = attempted.map((question) => {
      const isCorrect = stableUnitValue("correct", student.key, question.id) < student.accuracy;
      return {
        question,
        isCorrect,
        marksAwarded: isCorrect ? question.marks : 0,
        // 0.6x to 1.6x the marks in minutes — enough spread for the time-per-
        // question charts to have something to show.
        timeSpentMs: Math.round(
          question.marks * 60_000 * (0.6 + stableUnitValue("time", student.key, question.id)),
        ),
      };
    });

    const correct = results.filter((r) => r.isCorrect).length;
    const marksEarned = results.reduce((s, r) => s + r.marksAwarded, 0);
    const marksPossible = results.reduce((s, r) => s + r.question.marks, 0);
    const timeSpentMs = results.reduce((s, r) => s + r.timeSpentMs, 0);

    const session = {
      userId,
      mode: "CUSTOM" as const,
      filtersJson: { subjectId: subject.id, difficulty: ["EASY", "MEDIUM", "HARD"] },
      questionIds: attempted.map((q) => q.id),
      currentIndex: attempted.length,
      status: "COMPLETED" as const,
      startedAt: new Date("2026-07-20T10:00:00.000Z"),
      completedAt: new Date("2026-07-20T11:30:00.000Z"),
      totalQuestions: attempted.length,
      answered: attempted.length,
      correct,
      marksEarned,
      marksPossible,
      timeSpentMs,
    };
    await prisma.practiceSession.upsert({
      where: { id: sessionId },
      create: { id: sessionId, ...session },
      update: session,
    });

    // Rewrite this session's attempts wholesale so a re-run cannot leave
    // attempts behind for questions the student no longer covers.
    await prisma.questionAttempt.deleteMany({ where: { practiceSessionId: sessionId } });
    await prisma.questionAttempt.createMany({
      data: results.map((r) => ({
        id: seedId("attempt", student.key, r.question.id),
        userId,
        questionId: r.question.id,
        questionVersion: 1,
        questionSnapshot: { seeded: true, marks: r.question.marks },
        practiceSessionId: sessionId,
        answerJson: { value: r.isCorrect ? "correct" : "incorrect" },
        isCorrect: r.isCorrect,
        marksAwarded: r.marksAwarded,
        marksPossible: r.question.marks,
        evaluationMode: "AUTO" as const,
        mistakeReason: r.isCorrect ? null : pickMistakeReason(student.key, r.question.id),
        timeSpentMs: r.timeSpentMs,
        attemptedAt: new Date("2026-07-20T10:30:00.000Z"),
      })),
    });

    await recomputeTopicMastery(prisma, userId, results);
    await recomputeMistakeRecords(prisma, userId, subject.id, results);

    const progressId = seedId("progress", student.key, subject.code);
    const progress = {
      userId,
      subjectId: subject.id,
      attempted: attempted.length,
      correct,
      marksEarned,
      marksPossible,
      masteryScore: marksPossible > 0 ? marksEarned / marksPossible : 0,
      unrepairedMistakes: results.length - correct,
      practiceSessions: 1,
      examsCompleted: 0,
      lastAttemptedAt: new Date("2026-07-20T11:30:00.000Z"),
    };
    await prisma.subjectProgress.upsert({
      where: { id: progressId },
      create: { id: progressId, ...progress },
      update: progress,
    });

    // A handful of bookmarks, biased towards questions they got wrong — which
    // is what students actually bookmark.
    const bookmarkable = results.filter((r) => !r.isCorrect).slice(0, 4);
    for (const r of bookmarkable) {
      const id = seedId("bookmark", student.key, r.question.id);
      const data = { userId, questionId: r.question.id, note: "Revisit before the exam" };
      await prisma.bookmark.upsert({ where: { id }, create: { id, ...data }, update: data });
    }
  }
}

const MISTAKE_REASONS = [
  "CONCEPT_NOT_KNOWN",
  "CONCEPT_MISAPPLIED",
  "CALCULATION_ERROR",
  "MISREAD_QUESTION",
  "INCOMPLETE_ANSWER",
  "SILLY_MISTAKE",
] as const;

function pickMistakeReason(studentKey: string, questionId: string) {
  const index = Math.floor(
    stableUnitValue("reason", studentKey, questionId) * MISTAKE_REASONS.length,
  );
  return MISTAKE_REASONS[Math.min(index, MISTAKE_REASONS.length - 1)] ?? "CONCEPT_NOT_KNOWN";
}

interface AttemptResult {
  question: { id: string; marks: number; topics: { topicId: string }[] };
  isCorrect: boolean;
  marksAwarded: number;
}

async function recomputeTopicMastery(
  prisma: PrismaClient,
  userId: string,
  results: AttemptResult[],
): Promise<void> {
  const byTopic = new Map<
    string,
    { attempted: number; correct: number; earned: number; possible: number }
  >();

  for (const result of results) {
    for (const { topicId } of result.question.topics) {
      const current = byTopic.get(topicId) ?? { attempted: 0, correct: 0, earned: 0, possible: 0 };
      current.attempted += 1;
      if (result.isCorrect) current.correct += 1;
      current.earned += result.marksAwarded;
      current.possible += result.question.marks;
      byTopic.set(topicId, current);
    }
  }

  for (const [topicId, stats] of byTopic) {
    const id = seedId("mastery", userId, topicId);
    const data = {
      userId,
      topicId,
      attempted: stats.attempted,
      correct: stats.correct,
      marksEarned: stats.earned,
      marksPossible: stats.possible,
      // The real implementation weights recent attempts more heavily. Every
      // seeded attempt shares one timestamp, so recency weighting collapses to
      // plain accuracy here — correct for this data, not a shortcut to copy.
      masteryScore: stats.possible > 0 ? stats.earned / stats.possible : 0,
      unrepairedMistakes: stats.attempted - stats.correct,
      lastAttemptedAt: new Date("2026-07-20T11:30:00.000Z"),
    };
    await prisma.topicMastery.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
}

async function recomputeMistakeRecords(
  prisma: PrismaClient,
  userId: string,
  subjectId: string,
  results: AttemptResult[],
): Promise<void> {
  const missed = results.filter((r) => !r.isCorrect);
  const keptIds = missed.map((r) => seedId("mistake", userId, r.question.id));

  for (const result of missed) {
    const id = seedId("mistake", userId, result.question.id);
    const data = {
      userId,
      questionId: result.question.id,
      firstMissedAt: new Date("2026-07-20T10:30:00.000Z"),
      lastMissedAt: new Date("2026-07-20T10:30:00.000Z"),
      repairedAt: null,
      repairAttempts: 0,
    };
    await prisma.mistakeRecord.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  // A question the student now gets right must stop appearing in their mistake
  // list on a re-seed.
  //
  // The subject filter is load-bearing, not defensive. This function runs once
  // per subject, and `results` only ever covers the subject being seeded — so
  // an unscoped delete would wipe the previous subject's mistake records on the
  // next call, leaving only whichever subject happened to be seeded last.
  await prisma.mistakeRecord.deleteMany({
    where: {
      userId,
      question: { subjectId },
      id: { notIn: keptIds.length > 0 ? keptIds : ["__none__"] },
    },
  });
}
