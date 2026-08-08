import Link from "next/link";

/**
 * Shell for Clerk's sign-in and sign-up components.
 *
 * Its only job is to centre them and keep a way back to the marketing page. The
 * forms themselves are Clerk's — credentials, password rules, MFA and the OAuth
 * dance are exactly the things you do not want to hand-roll for a product that
 * holds minors' data.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-16">
      <Link
        href="/"
        className="text-ink-700 dark:text-ink-100 text-xl font-semibold tracking-tight"
      >
        Samjho
      </Link>
      {children}
    </main>
  );
}
