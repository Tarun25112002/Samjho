import type { AnswerTranscription, TranscribeAnswerInput } from "@medhavi/contracts";

import { NotFoundError } from "../../lib/errors.js";
import { prisma } from "../../lib/prisma.js";
import { assertNotRateLimited } from "./ai.quota.js";
import { aiTranscribe } from "./ai.transcribe.js";

/**
 * Transcription, wired to a real question.
 *
 * Thin on purpose. There is no attempt to look up, nothing to write, and no
 * cache — the request is a photograph the server has never seen and will not
 * keep, so there is nothing to key a cache on and nothing to store after.
 *
 * ## What it checks before spending a model call
 *
 * That the question exists and is published. A photograph is a large, slow,
 * expensive request; letting one through against a draft question id would burn
 * a rate-limit slot on an answer the student cannot have been set.
 *
 * ## Why the rate limit is the tutor's
 *
 * Because it is the same budget being spent. `assertNotRateLimited` is the
 * per-user, per-window guard the tutor and the grader already share, and giving
 * photographs their own allowance would mean a student out of tutor messages
 * could still send twenty images — which is the more expensive call of the two.
 */
export const aiTranscribeService = {
  async read(userId: string, input: TranscribeAnswerInput): Promise<AnswerTranscription> {
    const question = await prisma.question.findFirst({
      where: { id: input.questionId, status: "PUBLISHED" },
      select: {
        id: true,
        body: true,
        subject: { select: { name: true, classLevel: true } },
      },
    });

    if (!question) throw new NotFoundError("That question could not be found.");

    assertNotRateLimited(userId);

    return aiTranscribe.read({
      questionId: question.id,
      questionBody: question.body,
      subjectName: question.subject.name,
      classLevel: question.subject.classLevel,
      image: input.image,
    });
  },
};
