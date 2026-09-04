import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { requireContentRole } from "@/lib/me";

/**
 * The admin shell.
 *
 * Its own route group rather than a section inside `(app)`, for two reasons.
 * The nav is different — an editor working through a paper does not want the
 * student's chapter links in the way — and, more importantly, the gate is
 * different: `(app)` requires an onboarded student, this requires a content
 * role. Nesting one inside the other would mean every content editor also needs
 * a completed student profile, which is a rule nobody meant to write.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireContentRole();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-line border-b">
        <nav
          aria-label="Admin"
          className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4 text-sm"
        >
          <Link href="/admin" className="text-text font-semibold tracking-tight">
            Samjho <span className="text-text-soft font-normal">content</span>
          </Link>

          <Link href="/admin" className="text-text-soft hover:text-text">
            Dashboard
          </Link>
          <Link href="/admin/questions" className="text-text-soft hover:text-text">
            Questions
          </Link>
          <Link href="/home" className="text-text-soft hover:text-text">
            Student view
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="text-text-soft hidden sm:inline">{me.user.name ?? me.user.email}</span>
            <UserButton />
          </div>
        </nav>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
