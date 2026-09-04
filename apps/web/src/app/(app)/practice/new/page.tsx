import { practiceFiltersQuerySchema, type SubjectDetail } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { ChevronLeft } from "@/components/icons";
import { PracticeSetup } from "@/features/practice/practice-setup";
import { loadSubject } from "@/lib/catalog";
import { requireOnboarded } from "@/lib/me";

export const metadata: Metadata = { title: "Build a practice set" };
export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * The filter builder, pre-filled from the URL.
 *
 * Deep-linkable by design (docs/01 §3): `/practice/new?chapterId=…` is what
 * every "Practise this chapter" button in the app actually is. That is why the
 * filters are parsed here with the shared query schema rather than read ad hoc —
 * a link written on the chapter page and a form submitted on this one produce
 * the same request, validated by the same rules.
 *
 * Unparseable parameters fall back to an empty filter set rather than erroring.
 * A link a student pasted, edited or shared with a typo in it should open the
 * builder, not a five-hundred page.
 */
export default async function PracticeSetupPage({ searchParams }: PageProps) {
  const me = await requireOnboarded();
  const params = await searchParams;

  const parsed = practiceFiltersQuerySchema.safeParse(params);
  const filters = parsed.success ? parsed.data : {};
  const count = Number(typeof params["count"] === "string" ? params["count"] : "") || undefined;

  // The student's own subjects, with their chapters, loaded server-side. Two
  // calls for two subjects, which is cheaper than the alternative: a client
  // fetch every time the subject dropdown changes.
  const subjects = await loadEnrolledSubjects(
    (me.profile?.subjects ?? []).map((subject) => subject.slug),
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-5 py-8 sm:px-8 lg:py-10">
      <header>
        <Link
          href="/practice"
          className="text-text-soft hover:text-text inline-flex min-h-11 items-center gap-1 text-sm font-medium"
        >
          <ChevronLeft className="size-4" />
          Practice
        </Link>
        <h1 className="text-text mt-1 text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] sm:text-4xl">
          Build a set
        </h1>
        <p className="text-text-soft mt-1.5 text-sm">Leave anything blank to include all of it.</p>
      </header>

      {/*
        `unseenOnly` is spread separately rather than defaulted before the
        spread: an absent query parameter parses to `undefined`, and spreading
        that over a default puts the `undefined` back.
      */}
      <PracticeSetup
        subjects={subjects}
        initial={{
          ...filters,
          unseenOnly: filters.unseenOnly ?? false,
          ...(count === undefined ? {} : { count }),
        }}
      />
    </div>
  );
}

/**
 * Load each enrolled subject in full, skipping any that fail.
 *
 * A subject that 404s — deactivated between onboarding and now — drops out of
 * the picker rather than taking the page down with it. The student can still
 * build a set from everything else, which is the outcome that keeps them
 * practising.
 */
async function loadEnrolledSubjects(slugs: string[]): Promise<SubjectDetail[]> {
  const loaded = await Promise.all(
    slugs.map(async (slug) => {
      try {
        return await loadSubject(slug);
      } catch {
        return null;
      }
    }),
  );

  return loaded.filter((subject): subject is SubjectDetail => subject !== null);
}
