import { subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { ProfileForm } from "@/features/profile/profile-form";
import { apiFetchAuthed } from "@/lib/api-client";
import { requireOnboarded } from "@/lib/me";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await requireOnboarded();
  const profile = me.profile;

  if (!profile) {
    // An admin reaching this page. They have no learning profile by design, and
    // saying so beats rendering an empty form they cannot fill in.
    return (
      <main className="mx-auto max-w-2xl px-6 py-10">
        <p className="text-ink-500 dark:text-ink-300 text-sm">
          This account has no student profile. Signed in as {me.user.email} ({me.user.role}).
        </p>
      </main>
    );
  }

  const { subjects } = await apiFetchAuthed(
    `/api/v1/catalog/subjects?board=${profile.board}&classLevel=${String(profile.classLevel)}`,
    subjectListResponseSchema,
    { cache: "no-store" },
  );

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-10 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          Your profile
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-sm">
          Class {profile.classLevel} · {profile.board} · {me.user.email}
        </p>
      </header>

      <ProfileForm profile={profile} subjectOptions={subjects} />

      <ConsentPanel
        parentEmail={profile.parentEmail}
        guardianDeclaredAt={profile.guardianDeclaredAt}
        parentConsentAt={profile.parentConsentAt}
        termsAcceptedAt={profile.termsAcceptedAt}
        termsAcceptedVersion={profile.termsAcceptedVersion}
      />
    </main>
  );
}

/**
 * What the product actually holds about consent, stated exactly.
 *
 * The temptation is a green tick next to "parental consent" once the box has
 * been ticked. That would be false: a student's declaration is not a guardian's
 * consent, and the schema keeps them in separate columns precisely so this panel
 * can tell the truth. Showing "not yet confirmed" is also the honest prompt for
 * why the closed pilot is time-boxed.
 */
function ConsentPanel({
  parentEmail,
  guardianDeclaredAt,
  parentConsentAt,
  termsAcceptedAt,
  termsAcceptedVersion,
}: {
  parentEmail: string | null;
  guardianDeclaredAt: string | null;
  parentConsentAt: string | null;
  termsAcceptedAt: string | null;
  termsAcceptedVersion: string | null;
}) {
  return (
    <section
      aria-labelledby="consent-heading"
      className="border-ink-100 dark:border-ink-700 space-y-3 rounded-xl border p-5 text-sm"
    >
      <h2 id="consent-heading" className="text-ink-700 dark:text-ink-100 font-semibold">
        Guardian &amp; consent
      </h2>

      <dl className="space-y-2">
        <Row label="Guardian's email" value={parentEmail ?? "Not set"} />
        <Row
          label="You declared a guardian permits this account"
          value={formatDate(guardianDeclaredAt) ?? "No"}
        />
        <Row
          label="Guardian has confirmed directly"
          value={formatDate(parentConsentAt) ?? "Not yet — closed pilot"}
        />
        <Row
          label="Terms accepted"
          value={
            termsAcceptedAt === null
              ? "No"
              : `${formatDate(termsAcceptedAt) ?? ""} (version ${termsAcceptedVersion ?? "unknown"})`
          }
        />
      </dl>

      <p className="text-ink-500 dark:text-ink-300 text-xs text-pretty">
        Samjho collects no advertising or behavioural-tracking data. During the closed pilot we
        record your declaration rather than contacting your guardian to confirm it.
      </p>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-ink-500 dark:text-ink-300">{label}</dt>
      <dd className="text-ink-900 dark:text-ink-50 font-medium">{value}</dd>
    </div>
  );
}

function formatDate(iso: string | null): string | null {
  if (iso === null) return null;
  // en-IN, because the audience is in India and 08/09 means different things in
  // different places.
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
