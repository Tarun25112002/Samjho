import { UserButton } from "@clerk/nextjs";
import Link from "next/link";

import { BottomNav, SideNav } from "@/components/app/app-nav";
import { Wordmark } from "@/components/brand/logo";
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
 *
 * ## The two shapes
 *
 * A rail on a wide screen, a bottom bar on a phone — see `app-nav.tsx` for why
 * the phone gets a bar rather than a menu. The rail is `fixed` and the content
 * is padded past it rather than the two being a flex row, so a long practice
 * result scrolls under a rail that stays put, and the rail never grows a scroll
 * bar of its own.
 *
 * `pb-24` on the content is the height of the bottom bar. Without it the last
 * card on every page sits underneath the navigation, which is the single most
 * common bug in this layout and is invisible on a desktop browser.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireOnboarded();
  const displayName = me.user.name ?? me.user.email;

  return (
    <div className="min-h-screen">
      <a
        href="#content"
        className="bg-brand-500 text-on-brand rounded-control sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:px-4 focus:py-2 focus:font-semibold"
      >
        Skip to content
      </a>

      {/* ── The rail ─────────────────────────────────────────────────────── */}
      <div className="border-line bg-card fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r px-4 py-6 lg:flex">
        <Link href="/home" className="px-3">
          <Wordmark size="sm" />
          <span className="sr-only">Samjho home</span>
        </Link>

        <div className="mt-8 flex-1">
          <SideNav role={me.user.role} />
        </div>

        <div className="border-line flex items-center gap-3 border-t pt-4">
          {/* Clerk owns sign-out, session switching and account management. */}
          <UserButton />
          <span className="text-text-soft min-w-0 flex-1 truncate text-sm">{displayName}</span>
        </div>
      </div>

      {/* ── The phone bar ────────────────────────────────────────────────── */}
      <header className="border-line bg-card/95 sticky top-0 z-40 border-b backdrop-blur-md lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Link href="/home">
            <Wordmark size="sm" />
            <span className="sr-only">Samjho home</span>
          </Link>
          <div className="ml-auto">
            <UserButton />
          </div>
        </div>
      </header>

      <main id="content" className="pb-24 lg:pb-0 lg:pl-60">
        {children}
      </main>

      <BottomNav role={me.user.role} />
    </div>
  );
}
