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
      <header className="border-line bg-card/95 sticky top-0 z-40 border-b backdrop-blur-md">
        <nav
          aria-label="Admin"
          className="mx-auto flex min-h-16 w-full max-w-[90rem] items-center gap-1 px-5 text-sm sm:px-8 xl:px-10"
        >
          <Link href="/admin" className="text-text mr-3 shrink-0 font-semibold tracking-[-0.02em]">
            Samjho <span className="text-text-soft font-normal">Content</span>
          </Link>

          <Link
            href="/admin"
            className="text-text-soft rounded-control px-2.5 py-2 font-medium hover:bg-raised hover:text-text"
          >
            Dashboard
          </Link>
          <Link
            href="/admin/questions"
            className="text-text-soft rounded-control px-2.5 py-2 font-medium hover:bg-raised hover:text-text"
          >
            Questions
          </Link>
          <Link
            href="/admin/past-papers"
            className="text-text-soft rounded-control px-2.5 py-2 font-medium hover:bg-raised hover:text-text"
          >
            Past papers
          </Link>
          <Link
            href="/home"
            className="text-text-soft ml-1 hidden rounded-control px-2.5 py-2 font-medium hover:bg-raised hover:text-text sm:inline-flex"
          >
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
