import {
  CLASS_MIN_ATTEMPTS,
  CLASS_WEAK_SCORE_RATIO,
  type AssignmentItemAnalysis,
  type ClassTopic,
  type ClassroomDiagnostics,
  type ItemAnalysis,
  type MistakeReason,
  type OptionTally,
  type StrugglingStudent,
} from "@samjho/contracts";

import { NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Class diagnostics: what to reteach, and to whom.
 *
 * ## The question this answers, and the one it replaces
 *
 * The assignment report says who finished. This says what went wrong. They look
 * like the same feature and they are not: the first is a register, and the
 * second is the only one that changes what a teacher does on Monday.
 *
 * The product's thesis for students is that a mistake is a first-class object
 * rather than a row in a log (docs/00 §1). This is the same thesis applied to a
 * class. A misconception twelve students share is a first-class object too, it
 * has a shape — usually a single wrong option — and finding it is the difference
 * between reteaching a chapter and correcting one belief.
 *
 * ## Why so much of this happens in memory
 *
 * The aggregates below are computed by pulling a bounded set of attempt rows and
 * folding them, rather than by pushing `groupBy` into Postgres. That is a
 * deliberate trade and it is bounded on purpose: the queries are scoped to one
 * classroom's members and, for item analysis, to the questions in one
 * assignment. A class of forty sitting a twenty-question test is 800 attempt
 * rows.
 *
 * Doing it in SQL would mean a `groupBy` per dimension — option tallies, mistake
 * reasons, per-student rollups, median times — over the same rows, which is five
 * round trips to avoid one fold. The fold also does something SQL is bad at
 * here: `answerJson` is a JSONB document holding an array of chosen option ids,
 * and unnesting that to count distractors is more Postgres than anyone reading
 * this file next year will want to debug.
 *
 * The place this stops being true is a school-wide rollup across many classes at
 * once. That surface does not exist, and when it does it should be built on
 * `groupBy` from the start rather than by widening this.
 *
 * ## The privacy line, restated because this file is where it would erode
 *
 * A teacher gets aggregates plus a per-student mastery figure. They do not get a
 * student's answers. `commonWrongAnswers` returns free text and is the one place
 * that looks like an exception, so it is bounded to answers **more than one
 * student gave** — a repeated wrong answer is a misconception, and a unique one
 * is a person.
 */
export const diagnosticsService = {
  /**
   * Everything the teacher's diagnostics page needs, for one classroom.
   *
   * Scoped to the classroom's own subject throughout. A Science teacher looking
   * at 10B does not want their students' Maths mistakes in the reteach list —
   * they are true, and they are not this teacher's lesson.
   */
  async forClassroom(teacherId: string, classroomId: string): Promise<ClassroomDiagnostics> {
    const classroom = await prisma.classroom.findFirst({
      // `teacherId` in the `where`, not checked afterwards: the same rule the
      // rest of this module follows, and the reason there is no version of this
      // query that returns another teacher's class.
      where: { id: classroomId, teacherId, isArchived: false },
      select: {
        id: true,
        name: true,
        subjectId: true,
        subject: { select: { name: true } },
        members: {
          select: { student: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!classroom) throw new NotFoundError("Classroom");

    const studentIds = classroom.members.map((member) => member.student.id);

    if (studentIds.length === 0) {
      return {
        classroomId: classroom.id,
        classroomName: classroom.name,
        subjectName: classroom.subject.name,
        studentCount: 0,
        activeThisWeek: 0,
        attemptsThisWeek: 0,
        classScoreRatio: null,
        weakestTopics: [],
        strongestTopics: [],
        mistakeReasons: [],
        strugglingStudents: [],
        hardestQuestions: [],
      };
    }

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const inClass = {
      userId: { in: studentIds },
      question: { subjectId: classroom.subjectId },
      // Unscored subjective answers have no defensible score, so they are not
      // folded into a class average that a teacher would read as fact. The same
      // rule the student's own rollups follow.
      isCorrect: { not: null },
    };

    const [attempts, recentActivity, masteryRows, subjectProgress] = await Promise.all([
      prisma.questionAttempt.findMany({
        where: inClass,
        select: {
          userId: true,
          questionId: true,
          isCorrect: true,
          marksAwarded: true,
          marksPossible: true,
          mistakeReason: true,
          timeSpentMs: true,
          answerJson: true,
          attemptedAt: true,
        },
        // Bounded, and the bound is generous: a class of forty with a term of
        // work behind them sits well inside it. Newest first, so if a very
        // active class ever hits the ceiling it is the recent term that shapes
        // the advice rather than an arbitrary slice of history.
        orderBy: { attemptedAt: "desc" },
        take: 20_000,
      }),
      prisma.questionAttempt.groupBy({
        by: ["userId"],
        where: { ...inClass, attemptedAt: { gte: weekAgo } },
        _count: { _all: true },
      }),
      prisma.topicMastery.findMany({
        where: {
          userId: { in: studentIds },
          topic: { chapter: { subjectId: classroom.subjectId } },
          attempted: { gt: 0 },
        },
        select: {
          userId: true,
          attempted: true,
          correct: true,
          marksEarned: true,
          marksPossible: true,
          masteryScore: true,
          topic: {
            select: {
              id: true,
              name: true,
              chapter: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.subjectProgress.findMany({
        where: { userId: { in: studentIds }, subjectId: classroom.subjectId },
        select: {
          userId: true,
          attempted: true,
          masteryScore: true,
          unrepairedMistakes: true,
          lastAttemptedAt: true,
        },
      }),
    ]);

    const topics = foldTopics(masteryRows);
    const ranked = topics
      .filter((topic) => topic.attempts >= CLASS_MIN_ATTEMPTS)
      .sort((left, right) => left.scoreRatio - right.scoreRatio);

    const marksEarned = attempts.reduce((sum, row) => sum + row.marksAwarded, 0);
    const marksPossible = attempts.reduce((sum, row) => sum + row.marksPossible, 0);

    return {
      classroomId: classroom.id,
      classroomName: classroom.name,
      subjectName: classroom.subject.name,
      studentCount: studentIds.length,
      activeThisWeek: recentActivity.length,
      attemptsThisWeek: recentActivity.reduce((sum, row) => sum + row._count._all, 0),
      classScoreRatio: marksPossible > 0 ? marksEarned / marksPossible : null,
      weakestTopics: ranked.slice(0, 8),
      // Reversed rather than re-sorted, and only the ones that are actually good:
      // in a class that is struggling everywhere, the "strongest" topic is still
      // a weak one, and presenting it as a success is a lie a teacher would
      // catch immediately and stop trusting the page over.
      strongestTopics: [...ranked]
        .reverse()
        .filter((topic) => topic.scoreRatio >= CLASS_WEAK_SCORE_RATIO)
        .slice(0, 5),
      mistakeReasons: tallyMistakeReasons(attempts),
      strugglingStudents: strugglingStudents(classroom.members, subjectProgress, masteryRows),
      hardestQuestions: await hardestQuestions(attempts, 8),
    };
  },

  /**
   * Per-question analysis of one assignment.
   *
   * Most useful on a `CURATED` assignment, where every student sat the same
   * questions and the per-item numbers compare directly. On a drawn assignment
   * each student got their own set, so an item's denominator is however many
   * students happened to be given it — still true, and worth far less. The web
   * app says so on the page rather than leaving a teacher to infer it from
   * denominators of 3, 1 and 2.
   */
  async forAssignment(teacherId: string, assignmentId: string): Promise<AssignmentItemAnalysis> {
    const assignment = await prisma.classroomAssignment.findFirst({
      where: { id: assignmentId, classroom: { teacherId } },
      select: {
        id: true,
        title: true,
        sourcePool: true,
        classroom: { select: { _count: { select: { members: true } } } },
        submissions: { select: { studentId: true, sessionId: true } },
      },
    });
    if (!assignment) throw new NotFoundError("Assignment");

    const sessionIds = assignment.submissions.map((submission) => submission.sessionId);

    if (sessionIds.length === 0) {
      return {
        assignmentId: assignment.id,
        title: assignment.title,
        sameQuestionsForEveryone: assignment.sourcePool === "CURATED",
        studentsAttempted: 0,
        studentsInClass: assignment.classroom._count.members,
        items: [],
      };
    }

    // Scoped by session id rather than by student and question, which is what
    // keeps this about *this assignment*. The same student answering the same
    // question in their own practice next week is a different event and must not
    // land in the item analysis for a test they sat on Friday.
    const attempts = await prisma.questionAttempt.findMany({
      where: { practiceSessionId: { in: sessionIds }, isCorrect: { not: null } },
      select: {
        userId: true,
        questionId: true,
        isCorrect: true,
        marksAwarded: true,
        marksPossible: true,
        mistakeReason: true,
        timeSpentMs: true,
        answerJson: true,
      },
    });

    return {
      assignmentId: assignment.id,
      title: assignment.title,
      sameQuestionsForEveryone: assignment.sourcePool === "CURATED",
      studentsAttempted: new Set(attempts.map((row) => row.userId)).size,
      studentsInClass: assignment.classroom._count.members,
      items: await hardestQuestions(attempts, 60),
    };
  },
};

// ── Folding ──────────────────────────────────────────────────────────────────

interface AttemptRow {
  userId: string;
  questionId: string;
  isCorrect: boolean | null;
  marksAwarded: number;
  marksPossible: number;
  mistakeReason: MistakeReason | null;
  timeSpentMs: number;
  answerJson: unknown;
}

interface MasteryRow {
  userId: string;
  attempted: number;
  correct: number;
  marksEarned: number;
  marksPossible: number;
  masteryScore: number;
  topic: { id: string; name: string; chapter: { id: string; name: string } };
}

/**
 * Per-topic class performance, from the students' own mastery rollups.
 *
 * Built on `TopicMastery` rather than on raw attempts, and the reason is that
 * `masteryScore` is recency-weighted: a class that was poor at Trigonometry in
 * July and is fine in September should read as fine, and a lifetime average over
 * attempt rows would read as mediocre forever. That is the same weighting each
 * student sees on their own dashboard, so a teacher and a student looking at the
 * same topic are told the same thing.
 *
 * `studentsStruggling` is counted per student against the same threshold rather
 * than derived from the class average, because the two describe different
 * lessons: a class averaging 55% might be everyone at 55%, which is a reteach,
 * or thirty students at 80% and six at 15%, which is not.
 */
function foldTopics(rows: MasteryRow[]): ClassTopic[] {
  /** The accumulator carries what a `ClassTopic` cannot: a set, and two sums. */
  interface Bucket {
    topicId: string;
    topicName: string;
    chapterId: string;
    chapterName: string;
    students: Set<string>;
    attempts: number;
    struggling: number;
    marksEarned: number;
    marksPossible: number;
  }

  const byTopic = new Map<string, Bucket>();

  for (const row of rows) {
    let bucket = byTopic.get(row.topic.id);

    if (!bucket) {
      bucket = {
        topicId: row.topic.id,
        topicName: row.topic.name,
        chapterId: row.topic.chapter.id,
        chapterName: row.topic.chapter.name,
        students: new Set<string>(),
        attempts: 0,
        struggling: 0,
        marksEarned: 0,
        marksPossible: 0,
      };
      byTopic.set(row.topic.id, bucket);
    }

    bucket.students.add(row.userId);
    bucket.attempts += row.attempted;
    bucket.marksEarned += row.marksEarned;
    bucket.marksPossible += row.marksPossible;
    if (row.masteryScore < CLASS_WEAK_SCORE_RATIO) bucket.struggling += 1;
  }

  return [...byTopic.values()].map((bucket) => ({
    topicId: bucket.topicId,
    topicName: bucket.topicName,
    chapterId: bucket.chapterId,
    chapterName: bucket.chapterName,
    studentsAttempted: bucket.students.size,
    attempts: bucket.attempts,
    scoreRatio: bucket.marksPossible > 0 ? bucket.marksEarned / bucket.marksPossible : 0,
    studentsStruggling: bucket.struggling,
  }));
}

function tallyMistakeReasons(
  rows: { mistakeReason: MistakeReason | null }[],
): { reason: MistakeReason; count: number }[] {
  const counts = new Map<MistakeReason, number>();

  for (const row of rows) {
    if (!row.mistakeReason) continue;
    counts.set(row.mistakeReason, (counts.get(row.mistakeReason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count);
}

/**
 * Students who need attention, worst first.
 *
 * "Worst" is deliberately not the raw mastery score. A student with four
 * attempts and a 20% score is more likely to be a student who has barely started
 * than a student in trouble, and putting them at the top of a teacher's list
 * every week costs the list its credibility. So the ranking is mastery among
 * those with enough work behind them to judge, and students below that floor are
 * kept but sorted after — a teacher still wants to see the name of the person
 * who has done nothing, just not above the person who is failing.
 */
function strugglingStudents(
  members: { student: { id: string; name: string | null; email: string } }[],
  progress: {
    userId: string;
    attempted: number;
    masteryScore: number;
    unrepairedMistakes: number;
    lastAttemptedAt: Date | null;
  }[],
  mastery: MasteryRow[],
): StrugglingStudent[] {
  const progressByUser = new Map(progress.map((row) => [row.userId, row]));

  const weakestByUser = new Map<string, string[]>();
  for (const row of [...mastery].sort((left, right) => left.masteryScore - right.masteryScore)) {
    const list = weakestByUser.get(row.userId) ?? [];
    if (list.length < 3 && row.masteryScore < CLASS_WEAK_SCORE_RATIO) {
      list.push(row.topic.name);
      weakestByUser.set(row.userId, list);
    }
  }

  return members
    .map(({ student }) => {
      const row = progressByUser.get(student.id);
      return {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        masteryScore: row?.masteryScore ?? 0,
        attempted: row?.attempted ?? 0,
        unrepairedMistakes: row?.unrepairedMistakes ?? 0,
        weakestTopics: weakestByUser.get(student.id) ?? [],
        lastActiveAt: row?.lastAttemptedAt?.toISOString() ?? null,
      };
    })
    .filter(
      (student) =>
        student.attempted < CLASS_MIN_ATTEMPTS || student.masteryScore < CLASS_WEAK_SCORE_RATIO,
    )
    .sort((left, right) => {
      const leftJudged = left.attempted >= CLASS_MIN_ATTEMPTS;
      const rightJudged = right.attempted >= CLASS_MIN_ATTEMPTS;
      if (leftJudged !== rightJudged) return leftJudged ? -1 : 1;
      return left.masteryScore - right.masteryScore;
    })
    .slice(0, 12);
}

/**
 * Item analysis over a set of attempts, hardest first.
 *
 * The option tally is the part worth the round trip to fetch question bodies:
 * "nine of the fourteen who missed this chose C" is a fact a teacher can teach
 * from, and no accuracy percentage contains it.
 */
async function hardestQuestions(rows: AttemptRow[], limit: number): Promise<ItemAnalysis[]> {
  const byQuestion = new Map<string, AttemptRow[]>();
  for (const row of rows) {
    const bucket = byQuestion.get(row.questionId);
    if (bucket) bucket.push(row);
    else byQuestion.set(row.questionId, [row]);
  }

  const ranked = [...byQuestion.entries()]
    .map(([questionId, attempts]) => ({ questionId, attempts, ratio: scoreRatio(attempts) }))
    // A question one student answered is not the class's hardest question, it is
    // one student's bad afternoon. Two is a low bar and it removes the noise
    // that would otherwise dominate the top of the list.
    .filter((entry) => entry.attempts.length >= 2)
    .sort((left, right) => left.ratio - right.ratio || right.attempts.length - left.attempts.length)
    .slice(0, limit);

  if (ranked.length === 0) return [];

  const questions = await prisma.question.findMany({
    where: { id: { in: ranked.map((entry) => entry.questionId) } },
    select: {
      id: true,
      body: true,
      type: true,
      difficulty: true,
      marks: true,
      chapter: { select: { name: true } },
      options: {
        select: { id: true, label: true, body: true, isCorrect: true },
        orderBy: { orderIndex: "asc" },
      },
      topics: {
        where: { isPrimary: true },
        select: { topic: { select: { name: true } } },
        take: 1,
      },
    },
  });

  const questionById = new Map(questions.map((question) => [question.id, question]));

  return ranked.flatMap((entry) => {
    const question = questionById.get(entry.questionId);
    // A question deleted between the attempt and this read drops out rather than
    // rendering as a blank row. The ranking above it is unaffected.
    if (!question) return [];

    const attempts = entry.attempts;
    const chosen = countChosenOptions(attempts);

    return [
      {
        questionId: question.id,
        body: question.body,
        type: question.type,
        difficulty: question.difficulty,
        marks: question.marks,
        chapterName: question.chapter?.name ?? null,
        topicName: question.topics[0]?.topic.name ?? null,
        attempted: attempts.length,
        correct: attempts.filter((row) => row.isCorrect === true).length,
        scoreRatio: entry.ratio,
        medianTimeMs: median(attempts.map((row) => row.timeSpentMs)),
        options: question.options.map((option): OptionTally => ({
          optionId: option.id,
          label: option.label,
          body: option.body,
          isCorrect: option.isCorrect,
          chosenBy: chosen.get(option.id) ?? 0,
        })),
        commonWrongAnswers: commonWrongAnswers(attempts),
        mistakeReasons: tallyMistakeReasons(attempts),
      },
    ];
  });
}

function scoreRatio(attempts: AttemptRow[]): number {
  const possible = attempts.reduce((sum, row) => sum + row.marksPossible, 0);
  if (possible === 0) return 0;
  return attempts.reduce((sum, row) => sum + row.marksAwarded, 0) / possible;
}

/**
 * How many students chose each option.
 *
 * `answerJson` is written by the practice service as a `StudentAnswer`, so its
 * shape is known — but it is a JSONB column, and a column that has held one
 * shape since Phase 5 is not a column that has held one shape forever. The
 * narrowing below treats anything unexpected as "no options chosen" rather than
 * throwing: a diagnostics page that 500s because one row from an old import has
 * a null answer is worse than one that under-counts a distractor by one.
 */
function countChosenOptions(attempts: AttemptRow[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const attempt of attempts) {
    const answer = attempt.answerJson;
    if (typeof answer !== "object" || answer === null) continue;

    const optionIds = (answer as { optionIds?: unknown }).optionIds;
    if (!Array.isArray(optionIds)) continue;

    for (const optionId of optionIds) {
      if (typeof optionId !== "string") continue;
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
  }

  return counts;
}

/**
 * Free-text wrong answers more than one student gave.
 *
 * The `count > 1` filter is the privacy line, not a relevance heuristic. Three
 * students writing "9.8" where the answer is "9.8 N" is a misconception about
 * units and a teacher should see it; one student's sentence is that student's
 * work, and this surface does not carry it.
 */
function commonWrongAnswers(attempts: AttemptRow[]): { answer: string; count: number }[] {
  const counts = new Map<string, number>();

  for (const attempt of attempts) {
    if (attempt.isCorrect !== false) continue;

    const answer = attempt.answerJson;
    if (typeof answer !== "object" || answer === null) continue;

    const text = (answer as { text?: unknown }).text;
    if (typeof text !== "string") continue;

    const trimmed = text.trim();
    // The upper bound is what keeps this a "they all wrote 9.8" signal rather
    // than a transcript of long answers. Anything past it is prose, and prose is
    // the student's.
    if (trimmed.length === 0 || trimmed.length > 80) continue;

    const key = trimmed.toLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([answer, count]) => ({ answer, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 5);
}

/** Median, because one student who left the tab open all night is normal. */
function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round(((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2)
    : (sorted[middle] ?? 0);
}
