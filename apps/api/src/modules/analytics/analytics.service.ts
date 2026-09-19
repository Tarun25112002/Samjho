import {
  learningEventPropsSchema,
  type LearningEventProps,
  type LearningEventType,
  type RecordEventsInput,
} from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";

/**
 * Recording what happened, without ever being the reason something did not.
 *
 * ## Every write here is best-effort, deliberately
 *
 * Failing to record that a student viewed a question must not fail the request
 * that showed it to them. Nothing in the product reads this table at request
 * time, so a lost row costs one data point — while a thrown error would cost a
 * student their answer. `record` therefore catches everything and logs.
 *
 * That is the opposite of the rule the rollups follow (`practice.rollups.ts`
 * insists on running inside the attempt's transaction), and the difference is
 * the point: mastery is part of the answer, analytics is a note about it.
 *
 * ## Ownership is checked, not trusted
 *
 * `recordFromClient` takes ids out of a request body, so it verifies that the
 * session belongs to the caller before storing anything against it. An
 * unverified session id would let one student write rows onto another's
 * timeline — pointless as an attack and corrupting as a bug.
 */

export interface LearningEvent {
  userId: string;
  type: LearningEventType;
  sessionId?: string | null;
  questionId?: string | null;
  props?: LearningEventProps;
}

export const analyticsService = {
  /**
   * Fire and forget. Returns nothing, throws nothing.
   *
   * Callers use `void analyticsService.record(...)` rather than awaiting: the
   * student is waiting on the response and this is a note in a ledger.
   */
  async record(event: LearningEvent): Promise<void> {
    try {
      await prisma.learningEvent.create({ data: toRow(event) });
    } catch (error) {
      logger.warn({ err: error, type: event.type }, "Could not record a learning event");
    }
  },

  /** Several at once, for a service that finished a multi-step action. */
  async recordMany(events: LearningEvent[]): Promise<void> {
    if (events.length === 0) return;

    try {
      await prisma.learningEvent.createMany({ data: events.map(toRow) });
    } catch (error) {
      logger.warn({ err: error, count: events.length }, "Could not record learning events");
    }
  },

  /**
   * Events reported by a browser.
   *
   * Unlike `record`, this one is awaited and returns a count, because the
   * caller is an endpoint that has to answer. It still cannot fail the request:
   * a storage error is logged and reported as zero recorded.
   */
  async recordFromClient(userId: string, input: RecordEventsInput): Promise<number> {
    const sessionIds = [
      ...new Set(
        input.events
          .map((event) => event.sessionId)
          .filter((id): id is string => typeof id === "string"),
      ),
    ];

    const owned = await ownedSessionIds(userId, sessionIds);

    // An event naming a session the caller does not own is dropped rather than
    // rejected. The browser has no way to know a session was deleted between
    // the tab opening and the beacon firing, and answering 403 to a fire-and-
    // forget beacon teaches a client nothing it can act on.
    const rows = input.events
      .filter((event) => event.sessionId === undefined || owned.has(event.sessionId))
      .map((event) =>
        toRow({
          userId,
          type: event.type,
          sessionId: event.sessionId ?? null,
          questionId: event.questionId ?? null,
          props: event.props,
        }),
      );

    if (rows.length === 0) return 0;

    try {
      const result = await prisma.learningEvent.createMany({ data: rows });
      return result.count;
    } catch (error) {
      logger.warn({ err: error, count: rows.length }, "Could not record client learning events");
      return 0;
    }
  },
};

async function ownedSessionIds(userId: string, sessionIds: string[]): Promise<Set<string>> {
  if (sessionIds.length === 0) return new Set();

  const rows = await prisma.practiceSession.findMany({
    where: { userId, id: { in: sessionIds } },
    select: { id: true },
  });

  return new Set(rows.map((row) => row.id));
}

function toRow(event: LearningEvent): Prisma.LearningEventCreateManyInput {
  // Re-parsed rather than cast, so a service that invents a property gets it
  // stripped here instead of writing a column this table promised not to have.
  const props = learningEventPropsSchema.safeParse(event.props ?? {});

  return {
    userId: event.userId,
    type: event.type,
    ...(event.sessionId ? { sessionId: event.sessionId } : {}),
    ...(event.questionId ? { questionId: event.questionId } : {}),
    propsJson: (props.success ? props.data : {}) as unknown as Prisma.InputJsonValue,
  };
}
