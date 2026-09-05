import { subjectListResponseSchema, type AIStatus } from "@samjho/contracts";
import type { Metadata } from "next";

import { Check, SparkIcon } from "@/components/icons";
import { ProfileForm } from "@/features/profile/profile-form";
import { loadTutorStatus } from "@/lib/ai";
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
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-8 sm:py-8 xl:px-12 xl:py-10">
        <section className="rounded-panel border-line bg-card border p-6 sm:p-8">
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Account details
          </p>
          <p className="text-text mt-2 text-lg font-semibold">
            No student profile is attached to this account.
          </p>
          <p className="text-text-soft mt-2 text-sm leading-relaxed">
            You are signed in as {me.user.email} ({me.user.role}).
          </p>
        </section>
      </div>
    );
  }

  // Both, in parallel: neither needs the other, and awaiting them in sequence
  // would add a round trip to a page that is already two.
  const [{ subjects }, tutor] = await Promise.all([
    apiFetchAuthed(
      `/api/v1/catalog/subjects?board=${profile.board}&classLevel=${String(profile.classLevel)}`,
      subjectListResponseSchema,
      { cache: "no-store" },
    ),
    loadTutorStatus(),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-4 py-6 sm:px-8 sm:py-8 xl:px-12 xl:py-10">
      <header className="border-line border-b pb-6">
        <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
          Account settings
        </p>
        <h1 className="text-text mt-2 text-[1.875rem] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[2.5rem]">
          Your learning profile
        </h1>
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          Class {profile.classLevel} {profile.board} · {me.user.email}
        </p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
        <section aria-labelledby="study-preferences-heading" className="flex flex-col gap-4">
          <div>
            <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
              Study setup
            </p>
            <h2
              id="study-preferences-heading"
              className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]"
            >
              What you are preparing for
            </h2>
            <p className="text-text-soft mt-2 text-sm leading-relaxed">
              Keep your subjects, language, and exam target accurate so your practice stays
              relevant.
            </p>
          </div>
          <ProfileForm profile={profile} subjectOptions={subjects} />
        </section>

        <div className="flex flex-col gap-5 xl:sticky xl:top-6">
          <ConsentPanel
            parentEmail={profile.parentEmail}
            guardianDeclaredAt={profile.guardianDeclaredAt}
            parentConsentAt={profile.parentConsentAt}
            termsAcceptedAt={profile.termsAcceptedAt}
            termsAcceptedVersion={profile.termsAcceptedVersion}
          />

          <TutorAllowance status={tutor} />
        </div>
      </div>
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
      className="rounded-panel border-line bg-card border p-5 sm:p-6"
    >
      <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">Account safety</p>
      <h2 id="consent-heading" className="text-text mt-1 text-xl font-semibold tracking-[-0.02em]">
        Guardian and consent
      </h2>
      <p className="text-text-soft mt-2 text-sm leading-relaxed">
        The details we keep to make sure your account is set up responsibly.
      </p>

      <dl className="divide-line mt-5 divide-y text-sm">
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
    <div className="grid gap-x-4 gap-y-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline">
      <dt className="text-text-soft">{label}</dt>
      <dd className="text-text inline-flex items-center gap-1.5 font-medium sm:justify-self-end sm:text-right">
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

/**
 * Today's tutor allowance, where a student can see it coming.
 *
 * docs/05 §5.1 puts it on this page for one reason: a limit you can plan around
 * feels fair, and the same limit arriving unannounced mid-revision feels
 * punitive. The number is the same either way; only the warning differs.
 *
 * The last line is the part that keeps the promise honest. Running out does not
 * take help away — every question carries a human-written solution, and that is
 * what the tutor falls back to whether the reason is a spent quota or a provider
 * outage. Saying so here means a student who hits the limit already knows what
 * happens next.
 */
function TutorAllowance({ status }: { status: AIStatus }) {
  const { quota } = status;
  const used = Math.min(quota.messagesUsed, quota.messagesLimit);
  const fraction = quota.messagesLimit === 0 ? 0 : used / quota.messagesLimit;

  return (
    <section
      aria-labelledby="tutor-allowance-heading"
      className="rounded-panel border-line bg-card border p-5 sm:p-6"
    >
      <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">AI tutor</p>
      <h2
        id="tutor-allowance-heading"
        className="text-text mt-1 inline-flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]"
      >
        <SparkIcon className="text-brand-600 size-5" />
        Today&rsquo;s allowance
      </h2>

      {status.available ? (
        <>
          <p className="text-text-soft mt-2 text-sm leading-relaxed">
            You have used {used} of {quota.messagesLimit} tutor questions today.
          </p>

          {/* Presentational: the sentence above already says it, and a bar that
              a screen reader also reads out is the same fact twice. */}
          <div
            className="bg-raised mt-4 h-2 w-full overflow-hidden rounded-full"
            aria-hidden="true"
          >
            <div
              className="bg-brand-500 h-full rounded-full transition-[width] duration-300"
              style={{ width: `${String(Math.round(fraction * 100))}%` }}
            />
          </div>

          <p className="text-text-faint mt-3 text-xs leading-relaxed">
            Resets at {formatTime(quota.resetsAt)}.
          </p>
        </>
      ) : (
        <p className="text-text-soft mt-2 text-sm leading-relaxed">
          The AI tutor is switched off on this instance.
        </p>
      )}

      <p className="text-text-faint mt-3 text-xs leading-relaxed">
        Running out never removes help: every question keeps its full written solution and marking
        scheme, and that is what the tutor falls back to.
      </p>
    </section>
  );
}

/** The reset lands at UTC midnight; a student thinks in IST. */
function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    day: "numeric",
    month: "short",
  });
}
