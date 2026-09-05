"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageHeader, PageShell } from "@/components/ui/page";

/**
 * The tab strip across the teacher workspace.
 *
 * The four destinations sit inside `/teacher` rather than in the app's main
 * rail, and that is a decision about who is looking. The rail is the product's
 * top level — Home, Practice, Class — and a teacher has one entry there. Their
 * four working surfaces belong under it, the way a section's tabs do, so the
 * rail does not grow to eight items for one role.
 *
 * A client component only because the active tab needs the current path. The
 * pages themselves stay server components and fetch their own data.
 */

const TABS = [
  { href: "/teacher", label: "Overview", exact: true },
  { href: "/teacher/classrooms", label: "Classrooms" },
  { href: "/teacher/uploads", label: "Papers" },
  { href: "/teacher/questions", label: "Question bank" },
] as const;

export function TeacherShell({
  title,
  blurb,
  action,
  children,
}: {
  title: string;
  blurb: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();

  const isActive = (tab: (typeof TABS)[number]): boolean =>
    "exact" in tab && tab.exact
      ? pathname === tab.href
      : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

  return (
    <PageShell width="wide">
      {/*
        No rule under this header: the tab strip immediately below draws its
        own, and two hairlines an inch apart read as a mistake rather than as
        structure. It is one of the two stated exceptions on `PageHeader`.
      */}
      <PageHeader
        eyebrow="Teaching space"
        title={title}
        lede={blurb}
        rule={false}
        action={action}
      />

      <nav aria-label="Teaching" className="border-line -mx-1 -mt-1 overflow-x-auto border-b px-1">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const active = isActive(tab);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "inline-flex min-h-11 items-center border-b-2 px-3.5 text-sm font-semibold transition-colors",
                    active
                      ? "border-brand-500 text-text"
                      : "text-text-soft hover:text-text border-transparent",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {children}
    </PageShell>
  );
}
