import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { requireOnboarded } from "@/lib/me";

/**
 * The signed-in app shell.
 *
 * This layout is where the onboarding gate lives — not in `proxy.ts`. It already
 * has to fetch `/me` to render the user's name, so checking `onboarded` on the
 * way past costs nothing, whereas doing it in middleware would mean an API call
 * on every request in the app.
 *
 * The gate is one-directional and lives in exactly one place, which is what
 * stops it looping: this layout sends un-onboarded users to `/welcome`, and
 * `/welcome` sends onboarded ones to `/home`. Two rules, no overlap.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOnboarded();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-ink-100 dark:border-ink-700 border-b">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-4 text-sm"
        >
          <Link href="/home" className="text-ink-900 dark:text-ink-50 font-semibold tracking-tight">
            Samjho
          </Link>

          <Link href="/home" className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-50">
            Home
          </Link>
          <Link href="/profile" className="text-ink-500 hover:text-ink-900 dark:hover:text-ink-50">
            Profile
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-ink-500 dark:text-ink-300 hidden sm:inline">
              {me.user.name ?? me.user.email}
            </span>
            {/* Clerk owns sign-out, session switching and account management. */}
            <UserButton />
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
