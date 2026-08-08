import {
  CURRENT_TERMS_VERSION,
  type MeResponse,
  type OnboardingInput,
  type ProfileUpdateInput,
  type Role,
  type SessionUser,
  type StudentProfile,
  type UserStatus,
} from "@samjho/contracts";

import { fetchClerkUser, toUserSnapshot, type ClerkUserJson } from "../../lib/clerk-user.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { catalogService } from "../catalog/catalog.service.js";
import { authRepository, type AuthUserRow, type MeRow } from "./auth.repository.js";

/**
 * Identity and profile business logic. No Express, no Prisma — this file could
 * be called from a job or a script unchanged, which is what makes it testable
 * without a server.
 */

/** What `req.user` holds once `loadUser` has run. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  imageUrl: string | null;
  role: Role;
  status: UserStatus;
  /** Derived once here, so no caller has to re-derive it. */
  onboarded: boolean;
}

export const authService = {
  /**
   * Turn a verified Clerk id into our own user, creating the row if needed.
   *
   * **Why lazily create at all**, when a `user.created` webhook already does it:
   * because webhook delivery is a promise, not a guarantee. It can be delayed
   * behind a retry, dropped while the endpoint is redeploying, or — in local
   * development — never configured at all, since it needs a public tunnel. Any
   * of those produce "signed up successfully, then everything 500s", which is
   * the worst possible first thirty seconds of a product.
   *
   * So there are two independent paths to the same row and they are idempotent
   * with respect to each other. Belt and braces, deliberately.
   */
  async resolveAuthenticatedUser(clerkUserId: string): Promise<AuthenticatedUser> {
    const existing = await authRepository.findAuthUserByClerkId(clerkUserId);

    if (existing) {
      // Fire-and-forget: nothing downstream reads this, so making the request
      // wait on it would be latency spent for no one's benefit.
      void authRepository
        .touchLastSeen(existing.id, existing.lastSeenAt)
        .catch((error: unknown) => {
          logger.warn({ err: error, userId: existing.id }, "Failed to update lastSeenAt");
        });

      return toAuthenticatedUser(existing);
    }

    logger.info({ clerkUserId }, "No local user for verified token; hydrating from Clerk");
    const snapshot = await fetchClerkUser(clerkUserId);
    const created = await authRepository.upsertFromClerk(snapshot);

    return toAuthenticatedUser(created);
  },

  async getMe(userId: string): Promise<MeResponse> {
    const row = await authRepository.findMe(userId);
    if (!row) throw new NotFoundError("User");
    return toMeResponse(row);
  },

  async completeOnboarding(user: AuthenticatedUser, input: OnboardingInput): Promise<MeResponse> {
    if (user.role !== "STUDENT") {
      // An admin has no StudentProfile and no board exam to sit. Letting them
      // create one would put a phantom student in every cohort aggregate.
      throw new ForbiddenError("Only student accounts have a learning profile");
    }

    const current = await authRepository.findMe(user.id);
    if (!current) throw new NotFoundError("User");

    const profile = current.studentProfile;

    // Re-running onboarding is fine; *changing class level* after the fact is
    // not. Enrolments, mastery rollups and practice history are all scoped to a
    // class, and silently re-pointing them would corrupt every one of them.
    if (profile?.onboardedAt && profile.classLevel !== input.classLevel) {
      throw new ConflictError(
        `This account is already set up for Class ${String(profile.classLevel)}. Contact support to change it.`,
      );
    }

    assertParentEmailIsNotTheStudent(user.email, input.parentEmail);
    await assertSubjectsAreEnrollable(input.subjectIds, input.board, input.classLevel);

    await authRepository.completeOnboarding({
      userId: user.id,
      classLevel: input.classLevel,
      board: input.board,
      school: input.school ?? null,
      preferredLanguage: input.preferredLanguage,
      subjectIds: input.subjectIds,
      targetExam: input.targetExam,
      parentEmail: input.parentEmail.toLowerCase(),
      termsVersion: CURRENT_TERMS_VERSION,
    });

    return authService.getMe(user.id);
  },

  async updateProfile(user: AuthenticatedUser, input: ProfileUpdateInput): Promise<MeResponse> {
    const current = await authRepository.findMe(user.id);
    const profile = current?.studentProfile;

    if (!profile?.onboardedAt) {
      throw new ConflictError("Finish setting up your account before editing it");
    }

    if (input.parentEmail !== undefined) {
      assertParentEmailIsNotTheStudent(user.email, input.parentEmail);
    }

    if (input.subjectIds) {
      await assertSubjectsAreEnrollable(input.subjectIds, profile.board, profile.classLevel);
    }

    await authRepository.updateProfile({
      userId: user.id,
      ...(input.school !== undefined ? { school: input.school } : {}),
      ...(input.preferredLanguage !== undefined
        ? { preferredLanguage: input.preferredLanguage }
        : {}),
      ...(input.subjectIds !== undefined ? { subjectIds: input.subjectIds } : {}),
      ...(input.targetExam !== undefined ? { targetExam: input.targetExam } : {}),
      ...(input.parentEmail !== undefined ? { parentEmail: input.parentEmail.toLowerCase() } : {}),
    });

    return authService.getMe(user.id);
  },

  /** `user.created` / `user.updated` from the Clerk webhook. */
  async syncFromClerk(payload: ClerkUserJson): Promise<void> {
    const snapshot = toUserSnapshot(payload);
    await authRepository.upsertFromClerk(snapshot);
  },

  /** `user.deleted` from the Clerk webhook. */
  async deleteFromClerk(clerkUserId: string): Promise<{ anonymised: boolean }> {
    const result = await authRepository.anonymiseByClerkId(clerkUserId);
    return { anonymised: result !== null };
  },
};

/**
 * A student naming their own address as their guardian's defeats the entire
 * point of the field — and it is the first thing a fourteen-year-old will try.
 * Cheap to check, and the check is the only thing standing between "parental
 * consent" and "a second copy of the student's email".
 */
function assertParentEmailIsNotTheStudent(studentEmail: string, parentEmail: string): void {
  if (studentEmail.trim().toLowerCase() === parentEmail.trim().toLowerCase()) {
    throw new ValidationError("Request validation failed", [
      {
        path: "body.parentEmail",
        message: "use a parent or guardian's email, not your own",
      },
    ]);
  }
}

async function assertSubjectsAreEnrollable(
  subjectIds: string[],
  board: StudentProfile["board"],
  classLevel: number,
): Promise<void> {
  const { missingIds } = await catalogService.resolveEnrollable({ subjectIds, board, classLevel });

  if (missingIds.length > 0) {
    throw new ValidationError("Request validation failed", [
      {
        path: "body.subjectIds",
        message: `not available for Class ${String(classLevel)} ${board}: ${missingIds.join(", ")}`,
      },
    ]);
  }
}

export function toAuthenticatedUser(row: AuthUserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    imageUrl: row.imageUrl,
    role: row.role,
    status: row.status,
    onboarded: isOnboarded(row.role, row.studentProfile?.onboardedAt ?? null),
  };
}

/**
 * Only students onboard. An admin or content editor has no class, no board and
 * no subjects, so gating them behind a student wizard would lock them out of
 * their own tools — with a redirect loop, since the wizard would have nothing
 * valid to submit.
 */
function isOnboarded(role: Role, onboardedAt: Date | null): boolean {
  if (role !== "STUDENT") return true;
  return onboardedAt !== null;
}

function toSessionUser(row: MeRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    imageUrl: row.imageUrl,
    role: row.role,
    status: row.status,
  };
}

async function toMeResponse(row: MeRow): Promise<MeResponse> {
  const profile = row.studentProfile;

  if (!profile) {
    return {
      user: toSessionUser(row),
      profile: null,
      onboarded: isOnboarded(row.role, null),
    };
  }

  // The cross-module hop: enrolments hold ids, and only the catalog module
  // turns ids into subjects.
  const subjects = await catalogService.listByIds(
    profile.enrolments.map((enrolment) => enrolment.subjectId),
  );

  const target = profile.targetExams[0] ?? null;

  return {
    user: toSessionUser(row),
    profile: {
      classLevel: toClassLevel(profile.classLevel),
      board: profile.board,
      school: profile.school,
      preferredLanguage: profile.preferredLanguage,
      onboardedAt: toIso(profile.onboardedAt),
      parentEmail: profile.parentEmail,
      guardianDeclaredAt: toIso(profile.guardianDeclaredAt),
      parentConsentAt: toIso(profile.parentConsentAt),
      termsAcceptedAt: toIso(profile.termsAcceptedAt),
      termsAcceptedVersion: profile.termsAcceptedVersion,
      targetExam: target
        ? { session: target.session, phase: target.phase, examDate: toIso(target.examDate) }
        : null,
      subjects,
    },
    onboarded: isOnboarded(row.role, profile.onboardedAt),
  };
}

function toIso(value: Date | null): string | null {
  return value === null ? null : value.toISOString();
}

/**
 * `StudentProfile.classLevel` is an `Int` in the database but a `10 | 12` union
 * on the wire, because only those two sit board exams. Narrowing has to be a
 * real check rather than a cast: a cast would let an 11 through and produce a
 * response the web app's own schema then refuses to parse — a confusing failure
 * two layers from its cause.
 */
function toClassLevel(value: number): 10 | 12 {
  if (value === 10 || value === 12) return value;
  throw new Error(`Student profile has unsupported class level ${String(value)}`);
}
