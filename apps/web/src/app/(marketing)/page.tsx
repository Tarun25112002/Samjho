import { Show } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";

/**
 * Public entry point.
 *
 * Deliberately plain. The real landing page — SEO subject pages, the pitch to a
 * parent who is the actual buyer (docs/07 R12) — is Phase 9 work, and writing it
 * now would mean writing it twice. What this needs to do today is give a signed
 * -out visitor a way in and a signed-in one a way back.
 */

export const metadata: Metadata = {
  title: "Samjho — CBSE Class 10 & 12 board exam preparation",
};

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-10 px-6 py-16">
      <header className="space-y-4">
        <p className="text-brand-600 text-sm font-medium tracking-wide uppercase">
          CBSE Class 10 · Mathematics &amp; Science
        </p>
        <h1 className="text-ink-900 dark:text-ink-50 text-4xl font-semibold tracking-tight text-balance">
          Practise the questions. Understand the mistakes. Sit the real thing before it counts.
        </h1>
        <p className="text-ink-500 dark:text-ink-300 text-lg text-pretty">
          Filtered practice by chapter, topic and difficulty — and a full three-hour board exam
          simulation with the real paper structure, right down to the internal choices.
        </p>
      </header>

      {/*
        `<Show>` replaced the old `<SignedIn>` / `<SignedOut>` pair in Clerk v7.
        In a Server Component it resolves on the server, so the correct branch is
        in the initial HTML — no flash of the wrong buttons while the client SDK
        boots, which is what the old client-side components produced.
      */}
      <div className="flex flex-wrap items-center gap-3">
        <Show
          when="signed-out"
          fallback={
            <Link
              href="/home"
              className="bg-brand-600 hover:bg-brand-500 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
            >
              Go to your dashboard
            </Link>
          }
        >
          <Link
            href="/sign-up"
            className="bg-brand-600 hover:bg-brand-500 rounded-lg px-5 py-2.5 text-sm font-medium text-white transition-colors"
          >
            Create an account
          </Link>
          <Link
            href="/sign-in"
            className="border-ink-300 dark:border-ink-700 text-ink-700 dark:text-ink-100 hover:border-ink-500 rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
        </Show>
      </div>

      {/*
        Stated up front rather than buried in a policy page. Under the DPDP Act
        essentially every user here is a minor, and a parent reading this page is
        entitled to know the position before their child signs up — not after.
      */}
      <section className="border-ink-100 dark:border-ink-700 space-y-2 rounded-xl border p-5 text-sm">
        <h2 className="text-ink-700 dark:text-ink-100 font-semibold">A note for parents</h2>
        <p className="text-ink-500 dark:text-ink-300">
          Samjho is in a closed pilot. Signing up asks for a parent or guardian&rsquo;s email
          address, and we record that a guardian has permitted the account. There are no advertising
          or behavioural-tracking scripts anywhere in this product, and there will not be.
        </p>
      </section>

      <footer className="text-ink-500 dark:text-ink-300 text-sm">
        <Link href="/status" className="hover:text-ink-700 dark:hover:text-ink-100 underline">
          System status
        </Link>
      </footer>
    </main>
  );
}
