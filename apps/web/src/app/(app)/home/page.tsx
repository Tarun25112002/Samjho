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

      <section aria-labelledby="subjects-heading" className="space-y-3">
        <h2 id="subjects-heading" className="text-ink-700 dark:text-ink-100 text-sm font-semibold">
          Your subjects
        </h2>

        <ul className="grid gap-3 sm:grid-cols-2">
          {profile?.subjects.map((subject) => (
            <li
              key={subject.id}
              className="border-ink-100 dark:border-ink-700 rounded-xl border p-4"
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
          Chapter browsing and question rendering arrive in Phase 3, practice sessions in Phase 5,
          and the full three-hour exam simulation in Phase 6. Your account, subjects and target exam
          are already set up and waiting for them.
        </p>
      </section>
    </main>
  );
}
