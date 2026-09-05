import { randomBytes } from "node:crypto";

import type { Board, ExamPhase, Language } from "@samjho/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";
import type { ClerkUserSnapshot } from "../../lib/clerk-user.js";

/**
 * Auth/profile data access. Every Prisma call in this module is in this file.
 *
 * Note what is absent: any query touching `subject`. Enrolments here store
 * subject *ids*; turning those into names is the catalog module's job, reached
 * through its service. That costs one extra round trip on `GET /me` and buys a
 * module boundary that is actually true (docs/02 §2).
 */

/**
 * The per-request identity slice. Loaded on **every authenticated request**, so
 * it stays deliberately narrow — no enrolments, no target exam, no join to
 * subjects. Those are for `GET /me`, which is called once per page load.
 */
export const authUserSelect = {
  id: true,
  email: true,
  name: true,
  imageUrl: true,
  role: true,
  status: true,
  lastSeenAt: true,
  studentProfile: { select: { onboardedAt: true } },
  // Two `onboardedAt` timestamps rather than one shared column, because a
  // teacher and a student answer different questions to earn theirs. Both are
  // on the per-request slice for the same reason the student one is: the app
  // shell's redirect decision cannot wait for a second query.
  teacherProfile: { select: { onboardedAt: true } },
} satisfies Prisma.UserSelect;

export type AuthUserRow = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

/** The full profile payload behind `GET /me`. */
export const meSelect = {
  id: true,
  email: true,
  name: true,
  imageUrl: true,
  role: true,
  status: true,
  studentProfile: {
    select: {
      classLevel: true,
      board: true,
      school: true,
      preferredLanguage: true,
      onboardedAt: true,
      parentEmail: true,
      parentConsentAt: true,
      guardianDeclaredAt: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
      targetExams: {
        select: { session: true, phase: true, examDate: true },
        orderBy: [{ session: "asc" }, { phase: "asc" }],
      },
      enrolments: {
        where: { isActive: true },
        select: { subjectId: true },
      },
    },
  },
  teacherProfile: {
    select: {
      school: true,
      subjectsTaught: true,
      onboardedAt: true,
      verifiedAt: true,
      termsAcceptedAt: true,
      termsAcceptedVersion: true,
    },
  },
} satisfies Prisma.UserSelect;

export type MeRow = Prisma.UserGetPayload<{ select: typeof meSelect }>;

export interface TeacherOnboardingWrite {
  userId: string;
  school: string | null;
  subjectsTaught: string | null;
  termsVersion: string;
}

export interface TeacherProfileWrite {
  userId: string;
  school?: string | null;
  subjectsTaught?: string | null;
}

export interface OnboardingWrite {
  userId: string;
  classLevel: number;
  board: Board;
  school: string | null;
  preferredLanguage: Language;
  subjectIds: string[];
  targetExam: { session: string; phase: ExamPhase };
  parentEmail: string;
  termsVersion: string;
}

export interface ProfileWrite {
  userId: string;
  school?: string | null;
  preferredLanguage?: Language;
  subjectIds?: string[];
  targetExam?: { session: string; phase: ExamPhase };
  parentEmail?: string;
}

export const authRepository = {
  findAuthUserByClerkId(clerkId: string): Promise<AuthUserRow | null> {
    return prisma.user.findUnique({ where: { clerkId }, select: authUserSelect });
  },

  findMe(userId: string): Promise<MeRow | null> {
    return prisma.user.findUnique({ where: { id: userId }, select: meSelect });
  },

  /**
   * Create the local row for a Clerk user we have not seen.
   *
   * `upsert` rather than `create` because two requests from a brand-new user can
   * arrive concurrently — the page and its data fetch, say — and both find no
   * row. `create` would make one of them fail on the unique index. The upsert
   * turns that race into a no-op.
   */
  upsertFromClerk(snapshot: ClerkUserSnapshot): Promise<AuthUserRow> {
    return prisma.user.upsert({
      where: { clerkId: snapshot.clerkUserId },
      create: {
        clerkId: snapshot.clerkUserId,
        email: snapshot.email,
        name: snapshot.name,
        imageUrl: snapshot.imageUrl,
      },
      // Clerk owns these three fields; ours is the copy. Role and status are
      // pointedly not in this list — they are our authorization decisions, and
      // a webhook from an identity provider must never be able to move them.
      update: {
        email: snapshot.email,
        name: snapshot.name,
        imageUrl: snapshot.imageUrl,
      },
      select: authUserSelect,
    });
  },

  /**
   * Handle `user.deleted`: anonymise, keep the row.
   *
   * A hard delete would cascade through attempts, mastery rollups and exam
   * history, silently changing every aggregate computed from them — and
   * `SubjectEnrolment.subject` is `onDelete: Restrict`, so parts of it would
   * fail halfway and leave a mess. Anonymising satisfies erasure of personal
   * data while keeping the pseudonymous learning record coherent (docs/06).
   *
   * Returns null when there is nothing to delete, which is normal: Clerk retries
   * webhooks, so the second delivery finds the work already done.
   */
  async anonymiseByClerkId(clerkId: string): Promise<{ id: string } | null> {
    const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } });
    if (!user) return null;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          status: "DELETED",
          // Unique columns must stay unique, so they are replaced rather than
          // nulled. The id is retained inside the placeholder so a support
          // request about a deleted account can still be traced.
          email: `deleted+${user.id}@samjho.invalid`,
          clerkId: `deleted_${user.id}`,
          name: null,
          imageUrl: null,
        },
      }),
      prisma.studentProfile.updateMany({
        where: { userId: user.id },
        data: {
          school: null,
          parentEmail: null,
          parentConsentToken: null,
        },
      }),
    ]);

    return user;
  },

  /**
   * Refresh `lastSeenAt`, but only if it is meaningfully stale.
   *
   * Without the throttle this is a database write on every single authenticated
   * request, for a field nothing reads in real time. Ten minutes of resolution
   * is plenty for "when was this student last active" and reduces the write rate
   * by about three orders of magnitude.
   */
  async touchLastSeen(userId: string, previous: Date | null): Promise<void> {
    const TEN_MINUTES = 10 * 60 * 1000;
    if (previous !== null && Date.now() - previous.getTime() < TEN_MINUTES) return;

    await prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } });
  },

  /**
   * Write the whole onboarding result atomically.
   *
   * One transaction because the halfway states are all wrong: a profile with no
   * enrolments looks onboarded but has nothing to practise, and enrolments with
   * no profile are orphans the UI cannot explain. Either the student is
   * onboarded or they are back on step one.
   *
   * Idempotent by construction — every write is an upsert or a reconcile, so a
   * double-submitted wizard produces exactly the same rows as a single one.
   */
  async completeOnboarding(input: OnboardingWrite): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.studentProfile.findUnique({
        where: { userId: input.userId },
        select: { id: true, onboardedAt: true, parentConsentToken: true },
      });

      const profile = await tx.studentProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          classLevel: input.classLevel,
          board: input.board,
          school: input.school,
          preferredLanguage: input.preferredLanguage,
          onboardedAt: now,
          parentEmail: input.parentEmail,
          parentConsentToken: newConsentToken(),
          guardianDeclaredAt: now,
          termsAcceptedAt: now,
          termsAcceptedVersion: input.termsVersion,
        },
        update: {
          classLevel: input.classLevel,
          board: input.board,
          school: input.school,
          preferredLanguage: input.preferredLanguage,
          // Preserved, not refreshed. A re-submission must not rewrite history:
          // "when did this student onboard" has one true answer.
          onboardedAt: existing?.onboardedAt ?? now,
          parentEmail: input.parentEmail,
          parentConsentToken: existing?.parentConsentToken ?? newConsentToken(),
          guardianDeclaredAt: now,
          termsAcceptedAt: now,
          termsAcceptedVersion: input.termsVersion,
        },
        select: { id: true },
      });

      await reconcileTargetExam(tx, profile.id, input.targetExam);
      await reconcileEnrolments(tx, profile.id, input.subjectIds);
    });
  },

  /**
   * Elevate an account to TEACHER and give it a profile, in one transaction.
   *
   * The role write and the profile write must not be separable. A user with
   * `role: TEACHER` and no `TeacherProfile` is `onboarded: false` forever — the
   * shell sends them to a setup page whose submission is a no-op because they
   * are already a teacher — and a profile with no role is invisible to every
   * authorization check. Both halves or neither.
   *
   * Idempotent: re-submitting the form updates the description and leaves
   * `onboardedAt` where it was, exactly as student onboarding does.
   */
  async completeTeacherOnboarding(input: TeacherOnboardingWrite): Promise<void> {
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.teacherProfile.findUnique({
        where: { userId: input.userId },
        select: { onboardedAt: true },
      });

      await tx.teacherProfile.upsert({
        where: { userId: input.userId },
        create: {
          userId: input.userId,
          school: input.school,
          subjectsTaught: input.subjectsTaught,
          onboardedAt: now,
          termsAcceptedAt: now,
          termsAcceptedVersion: input.termsVersion,
        },
        update: {
          school: input.school,
          subjectsTaught: input.subjectsTaught,
          // Preserved, not refreshed — "when did this teacher join" has one
          // true answer, and a re-submitted form is not a new one.
          onboardedAt: existing?.onboardedAt ?? now,
          termsAcceptedAt: now,
          termsAcceptedVersion: input.termsVersion,
        },
      });

      await tx.user.update({ where: { id: input.userId }, data: { role: "TEACHER" } });
    });
  },

  /** Partial teacher profile edit. Only the fields present are touched. */
  async updateTeacherProfile(input: TeacherProfileWrite): Promise<void> {
    const data: Prisma.TeacherProfileUpdateInput = {};
    if (input.school !== undefined) data.school = input.school;
    if (input.subjectsTaught !== undefined) data.subjectsTaught = input.subjectsTaught;
    if (Object.keys(data).length === 0) return;

    await prisma.teacherProfile.updateMany({ where: { userId: input.userId }, data });
  },

  /**
   * Everything that would make elevating this account to TEACHER a mistake.
   *
   * A teacher account has no practice history, no bookmarks and no mistakes —
   * the teacher surfaces do not render any of it, so a student who converts
   * would not lose the data but would lose every screen that displays it. That
   * is a support ticket, not a feature, so the elevation refuses rather than
   * silently orphaning a term's work.
   *
   * Counted in one round trip rather than three, because this runs on a form
   * submission a person is waiting on.
   */
  async findConversionBlockers(userId: string): Promise<{
    onboardedStudent: boolean;
    practiceSessions: number;
  }> {
    const [profile, practiceSessions] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: { onboardedAt: true },
      }),
      prisma.practiceSession.count({ where: { userId } }),
    ]);

    return {
      onboardedStudent: profile?.onboardedAt != null,
      practiceSessions,
    };
  },

  /** Partial profile edit. Only the fields present are touched. */
  async updateProfile(input: ProfileWrite): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const existing = await tx.studentProfile.findUnique({
        where: { userId: input.userId },
        select: { id: true, parentEmail: true },
      });
      if (!existing) return;

      const data: Prisma.StudentProfileUpdateInput = {};
      if (input.school !== undefined) data.school = input.school;
      if (input.preferredLanguage !== undefined) data.preferredLanguage = input.preferredLanguage;

      if (input.parentEmail !== undefined && input.parentEmail !== existing.parentEmail) {
        data.parentEmail = input.parentEmail;
        // Consent was given by a person at the old address; it does not follow
        // the account to a new one. Clearing it here is what stops "change the
        // parent's email" from being a way to launder an unconsented account.
        data.parentConsentAt = null;
        data.parentConsentToken = newConsentToken();
      }

      if (Object.keys(data).length > 0) {
        await tx.studentProfile.update({ where: { id: existing.id }, data });
      }

      if (input.targetExam) await reconcileTargetExam(tx, existing.id, input.targetExam);
      if (input.subjectIds) await reconcileEnrolments(tx, existing.id, input.subjectIds);
    });
  },
};

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Exactly one target exam per profile for the MVP.
 *
 * The table supports several — a student could reasonably track both the
 * February and May attempts — but the countdown, the revision plan and `GET /me`
 * all assume one, and a UI that shows "your exam" while the database holds two
 * is a bug waiting for a support ticket. When the second-attempt flow is built
 * for real (R12), this reconcile is the one place that has to change.
 */
async function reconcileTargetExam(
  tx: TransactionClient,
  profileId: string,
  target: { session: string; phase: ExamPhase },
): Promise<void> {
  await tx.targetExam.deleteMany({
    where: { profileId, NOT: { session: target.session, phase: target.phase } },
  });

  await tx.targetExam.upsert({
    where: {
      profileId_session_phase: { profileId, session: target.session, phase: target.phase },
    },
    create: { profileId, session: target.session, phase: target.phase },
    update: {},
  });
}

/**
 * Bring enrolments in line with the selected set.
 *
 * Deselected subjects are deactivated, not deleted. Practice sessions and
 * mastery rows reference the subject, and a student who drops Science in
 * September and picks it up in December should find their history intact.
 */
async function reconcileEnrolments(
  tx: TransactionClient,
  profileId: string,
  subjectIds: string[],
): Promise<void> {
  await tx.subjectEnrolment.updateMany({
    where: { profileId, subjectId: { notIn: subjectIds }, isActive: true },
    data: { isActive: false },
  });

  for (const subjectId of subjectIds) {
    await tx.subjectEnrolment.upsert({
      where: { profileId_subjectId: { profileId, subjectId } },
      create: { profileId, subjectId, isActive: true },
      update: { isActive: true },
    });
  }
}

/**
 * The secret a parent-verification link will carry.
 *
 * Minted at onboarding even though the closed pilot sends no email yet, so that
 * turning the flow on later is a mailer and a route — not a migration plus a
 * backfill across every account that already exists. 32 bytes from a CSPRNG:
 * this is a bearer credential for a consent decision, so `Math.random` would be
 * genuinely unsafe here, not merely untidy.
 */
function newConsentToken(): string {
  return randomBytes(32).toString("base64url");
}
