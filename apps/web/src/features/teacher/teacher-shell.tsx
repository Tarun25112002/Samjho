"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

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
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-8 px-5 py-7 sm:px-8 sm:py-10 xl:px-10">
      <header className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-3xl">
          <p className="text-brand-700 text-xs font-bold tracking-[0.14em] uppercase">
            Teaching space
          </p>
          <h1 className="text-text mt-2 text-[2rem] leading-[1.08] font-semibold tracking-[-0.04em] sm:text-4xl">
            {title}
          </h1>
          <p className="text-text-soft mt-3 max-w-2xl text-sm leading-relaxed">{blurb}</p>
        </div>
        {action}
      </header>

      <nav aria-label="Teaching" className="border-line -mx-1 overflow-x-auto border-b px-1">
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
    </div>
  );
}
