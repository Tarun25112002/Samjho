import { subjectListResponseSchema, type SubjectSummary } from "@samjho/contracts";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Wordmark } from "@/components/brand/logo";
import { WelcomeFlow } from "@/features/onboarding/welcome-flow";
import { apiFetchAuthed } from "@/lib/api-client";
import { loadMe } from "@/lib/me";

export const metadata: Metadata = { title: "Set up your account" };

/** Onboarding state is the whole point of the page; a cached copy is useless. */
export const dynamic = "force-dynamic";

/**
 * The other half of the onboarding gate.
 *
 * `(app)/layout.tsx` sends un-onboarded users here; this page sends onboarded
 * ones back. Two rules that do not overlap, which is what keeps them from
 * ping-ponging.
 *
 * Subject options for **both** class levels are fetched up front rather than
 * re-fetched when the student changes their class. Two parallel requests at page
 * load beat a spinner in the middle of a wizard, and the payload is a handful of
 * rows. It also makes the honest empty state possible: Class 12 currently has no
 * subjects, and the wizard says so rather than showing a loading state that
 * never resolves into anything.
 */
export default async function WelcomePage() {
  const me = await loadMe();
  if (me.onboarded) redirect("/home");

  const [class10, class12] = await Promise.all([loadSubjects(10), loadSubjects(12)]);

  return (
    <main className="min-h-dvh bg-page">
      {/*
        The wordmark is here and nowhere else in this flow. A student arriving
        from sign-up has an account and nothing else — no shell, no navigation,
        nothing to click away to — and four screens with no branding on them read
        like a form someone else built.
      */}
      <div className="border-line bg-card/90 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center px-5 sm:px-8">
          <Wordmark size="sm" tone="brand" />
          <p className="text-text-faint ml-auto hidden text-sm sm:block">
            Set up your revision space
          </p>
        </div>
      </div>

      <div className="ruled-lines min-h-[calc(100dvh-4rem)] px-5 py-10 sm:px-8 sm:py-14 lg:py-20">
        <div className="mx-auto w-full max-w-6xl">
          <WelcomeFlow subjectsByClass={{ "10": class10, "12": class12 }} />
        </div>
      </div>
    </main>
  );
}

async function loadSubjects(classLevel: 10 | 12): Promise<SubjectSummary[]> {
  const response = await apiFetchAuthed(
    `/api/v1/catalog/subjects?board=CBSE&classLevel=${String(classLevel)}`,
    subjectListResponseSchema,
    { cache: "no-store" },
  );
  return response.subjects;
}
