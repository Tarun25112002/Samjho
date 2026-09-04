import { subjectListResponseSchema } from "@samjho/contracts";
import type { Metadata } from "next";

import { Check } from "@/components/icons";
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
      <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8">
        <p className="border-line bg-card rounded-panel text-text-soft border p-6 text-sm">
          This account has no student profile. Signed in as {me.user.email} ({me.user.role}).
        </p>
      </div>
    );
  }

  const { subjects } = await apiFetchAuthed(
    `/api/v1/catalog/subjects?board=${profile.board}&classLevel=${String(profile.classLevel)}`,
    subjectListResponseSchema,
    { cache: "no-store" },
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-9 px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <h1 className="text-text text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          Your profile
        </h1>
        <p className="text-text-soft mt-1.5 text-sm">
          Class {profile.classLevel} {profile.board} · {me.user.email}
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
    </div>
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
 *
 * So the tick is only ever drawn for a thing that genuinely happened. A row
 * without one is not a warning — it is a fact, in the same grey as every other
 * fact on the page.
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
      className="border-line bg-card rounded-panel border p-6"
    >
      <h2 id="consent-heading" className="text-text text-lg font-semibold">
        Guardian and consent
      </h2>

      <dl className="divide-line mt-4 divide-y text-sm">
        <Row
          label="Guardian's email"
          value={parentEmail ?? "Not set"}
          done={parentEmail !== null}
        />
        <Row
          label="You declared a guardian permits this account"
          value={formatDate(guardianDeclaredAt) ?? "No"}
          done={guardianDeclaredAt !== null}
        />
        <Row
          label="Guardian has confirmed directly"
          value={formatDate(parentConsentAt) ?? "Not yet — closed pilot"}
          done={parentConsentAt !== null}
        />
        <Row
          label="Terms accepted"
          value={
            termsAcceptedAt === null
              ? "No"
              : `${formatDate(termsAcceptedAt) ?? ""} (version ${termsAcceptedVersion ?? "unknown"})`
          }
          done={termsAcceptedAt !== null}
        />
      </dl>

      <p className="text-text-faint mt-4 text-xs leading-relaxed">
        Samjho collects no advertising or behavioural-tracking data. During the closed pilot we
        record your declaration rather than contacting your guardian to confirm it.
      </p>
    </section>
  );
}

function Row({ label, value, done }: { label: string; value: string; done: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-text-soft">{label}</dt>
      <dd className="text-text inline-flex items-center gap-1.5 font-medium">
        {done ? <Check className="text-tick-600 size-4" /> : null}
        {value}
      </dd>
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
