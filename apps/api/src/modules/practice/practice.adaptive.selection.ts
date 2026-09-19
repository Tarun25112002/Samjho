import { levelsToDifficulties, type NextPick } from "./practice.adaptive.js";

import type { Difficulty, Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import { shuffle } from "../../lib/random.js";
import { STUDENT_VISIBLE_TOP_LEVEL } from "../questions/question.visibility.js";

const ADAPTIVE_WINDOW = 120;

export interface AdaptiveDrawRequest {
  userId: string;
  subjectIds: string[];
  pick: NextPick;
  excludeQuestionIds: string[];
}

export const adaptiveSelection = {
  async draw(request: AdaptiveDrawRequest): Promise<string | null> {
    for (const attempt of buildAttempts(request)) {
      const id = await drawOne(attempt);
      if (id !== null) return id;
    }

    return null;
  },
};

interface DrawAttempt {
  where: Prisma.QuestionWhereInput;
}

function buildAttempts(request: AdaptiveDrawRequest): DrawAttempt[] {
  const difficulties = levelsToDifficulties(request.pick.targetLevel);
  const topicId = request.pick.topicId;

  const base: Prisma.QuestionWhereInput = {
    ...STUDENT_VISIBLE_TOP_LEVEL,
    ...(request.subjectIds.length > 0 ? { subjectId: { in: request.subjectIds } } : {}),
    ...(request.excludeQuestionIds.length > 0 ? { id: { notIn: request.excludeQuestionIds } } : {}),
  };

  const withTopic = (where: Prisma.QuestionWhereInput): Prisma.QuestionWhereInput =>
    topicId === null
      ? where
      : {
          ...where,
          OR: [
            { topics: { some: { topicId } } },
            { subParts: { some: { topics: { some: { topicId } } } } },
          ],
        };

  const attempts: DrawAttempt[] = [];

  for (const difficulty of difficulties) {
    attempts.push({ where: withTopic({ ...base, difficulty }) });
  }

  if (topicId !== null) {
    for (const difficulty of difficulties) {
      attempts.push({ where: { ...base, difficulty } });
    }
  }

  attempts.push({ where: withTopic(base) });
  attempts.push({ where: base });

  return attempts;
}

async function drawOne(attempt: DrawAttempt): Promise<string | null> {
  const rows = await prisma.question.findMany({
    where: attempt.where,
    select: { id: true },
    orderBy: { id: "asc" },
    take: ADAPTIVE_WINDOW,
  });

  if (rows.length === 0) return null;
  return shuffle(rows.map((row) => row.id))[0] ?? null;
}

export function difficultyOrderFor(level: number): Difficulty[] {
  return levelsToDifficulties(level);
}
