import { EXAM_PHASE_LABELS } from "@samjho/contracts";
import type { Metadata } from "next";
import Link from "next/link";

import { requireOnboarded } from "@/lib/me";

export const metadata: Metadata = { title: "Home" };

/**
 * The signed-in landing page.
 *
 * Honest about being a shell: it proves the whole spine works — Clerk session →
 * bearer token → Express → Postgres → back — and shows the student what the
 * system believes about them. Practice, exams and progress fill it in from
 * Phase 5 onward, and pretending otherwise with placeholder charts would just
 * make the empty state harder to read.
 */
export default async function HomePage() {
  const me = await requireOnboarded();
  const profile = me.profile;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="space-y-1">
        <h1 className="text-ink-900 dark:text-ink-50 text-2xl font-semibold tracking-tight">
          {me.user.name ? `Welcome back, ${me.user.name.split(" ")[0]}` : "Welcome back"}
        </h1>
        {profile ? (
          <p className="text-ink-500 dark:text-ink-300 text-sm">
            Class {profile.classLevel} · {profile.board}
            {profile.targetExam
              ? ` · targeting ${EXAM_PHASE_LABELS[profile.targetExam.phase]} ${profile.targetExam.session}`
              : ""}
          </p>
        ) : null}
      </header>

      {/*
        The single largest element on the page, and first (docs/01 §4). A
        student opening the app wants to answer a question, not to read about
        having answered questions — and the two-tap target in docs/00 §5 is
        measured from here.
      */}
      <section
        aria-labelledby="practice-heading"
        className="border-brand-600 flex flex-wrap items-center gap-4 rounded-xl border p-5"
      >
        <div>
          <h2 id="practice-heading" className="text-ink-900 dark:text-ink-50 font-medium">
            Practise now
          </h2>
          <p className="text-ink-500 dark:text-ink-300 mt-1 text-sm">
            Ten questions, immediate feedback, and your mistakes kept for next time.
          </p>
        </div>

        <Link
          href="/practice"
          className="bg-brand-600 ml-auto rounded-lg px-4 py-2 font-medium text-white"
        >
          Start
        </Link>
      </section>

      <section aria-labelledby="subjects-heading" className="space-y-3">
        <h2 id="subjects-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Your subjects
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {profile?.subjects.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.slug}`}
                className="border-ink-100 dark:border-ink-700 hover:border-brand-600 block rounded-xl border p-4 transition-colors"
              >
                <p className="text-ink-900 dark:text-ink-50 font-medium">
                  {subject.name}
                  {subject.variant ? (
                    <span className="text-ink-500 dark:text-ink-300 font-normal">
                      {" "}
                      ({subject.variant})
                    </span>
                  ) : null}
                </p>
                {/* Never "out of 100": 80 for Class 10, 70 for Class 12 Physics. */}
                <p className="text-ink-500 dark:text-ink-300 mt-1 text-sm">
                  Theory paper · {subject.theoryMarks} marks
                </p>
              </Link>
            </li>
          ))}
        </ul>

        {profile?.subjects.length === 0 ? (
          <p className="text-ink-500 dark:text-ink-300 text-sm">
            No subjects selected.{" "}
            <Link href="/profile" className="underline">
              Choose some
            </Link>
            .
          </p>
        ) : null}
      </section>

      <section className="border-ink-100 dark:border-ink-700 rounded-xl border border-dashed p-5">
        <h2 className="text-ink-700 dark:text-ink-100 text-sm font-semibold">What&rsquo;s next</h2>
        <p className="text-ink-500 dark:text-ink-300 mt-2 text-sm text-pretty">
          Practice is live: pick a chapter, answer, and find out why. Your progress figures and the
          full three-hour exam simulation are still being built, so this page is a shell rather than
          a dashboard for now.
        </p>
      </section>
    </main>
  );
}
