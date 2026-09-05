import { requireOnboarded } from "@/lib/me";

/**
 * The focus shell.
 *
 * A route group of its own rather than a variant of `(app)`, because the
 * difference is the *absence* of the app chrome: no nav, no user menu, nothing
 * to click away to. docs/01 §7 puts the practice runner here deliberately — a
 * student who can see the rest of the app mid-set will visit it, and the set
 * they abandon is the one they never come back to.
 *
 * The gate is the same as the app shell's, and has to be: this is still a
 * signed-in, onboarded student's page. Only the chrome is different.
 */
export default async function FocusLayout({ children }: { children: React.ReactNode }) {
  await requireOnboarded();

  return <div className="min-h-dvh bg-page">{children}</div>;
}
