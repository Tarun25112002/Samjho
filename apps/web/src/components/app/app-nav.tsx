"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";

import { HomeIcon, PenIcon, UserIcon } from "@/components/icons";
import { ClassroomIcon, TeachingIcon } from "@/components/icons";

/**
 * The signed-in navigation, in its two forms.
 *
 * ## Why a bottom bar exists at all
 *
 * docs/07 Q10 puts this audience on phones, and a phone-first study app with its
 * navigation in a menu behind a hamburger is one where a student cannot get from
 * a chapter back to practice without two taps and a decision. Three destinations
 * across the bottom of the screen, reachable by thumb, is what every app these
 * students already use looks like — and it is the right shape here for the
 * boring reason that there are exactly three places to go.
 *
 * The same three items become a rail on a wide screen. One source of truth, two
 * layouts, so a fourth destination cannot appear in one and not the other.
 *
 * ## The active rule
 *
 * `/practice/sessions/x/result` should light up Practice, so a match is a prefix
 * match — except for `/home`, which is a prefix of nothing and must not match
 * everything. Hence the explicit `exact` flag rather than a clever rule.
 */

interface Destination {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  exact?: boolean;
}

const DESTINATIONS: Destination[] = [
  { href: "/home", label: "Home", icon: HomeIcon, exact: true },
  { href: "/practice", label: "Practice", icon: PenIcon },
  { href: "/classroom", label: "Class", icon: ClassroomIcon },
  { href: "/profile", label: "You", icon: UserIcon },
];

const TEACHER_DESTINATIONS: Destination[] = [
  { href: "/teacher", label: "Teaching", icon: TeachingIcon },
];

function destinationsFor(role: "STUDENT" | "TEACHER" | "CONTENT_EDITOR" | "ADMIN") {
  return role === "TEACHER" ? TEACHER_DESTINATIONS : DESTINATIONS;
}

function useActive(): (destination: Destination) => boolean {
  const pathname = usePathname();

  return (destination) =>
    destination.exact === true
      ? pathname === destination.href
      : pathname === destination.href || pathname.startsWith(`${destination.href}/`);
}

/** The desktop rail. */
export function SideNav({ role }: { role: "STUDENT" | "TEACHER" | "CONTENT_EDITOR" | "ADMIN" }) {
  const isActive = useActive();
  const destinations = destinationsFor(role);

  return (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {destinations.map((destination) => {
        const Icon = destination.icon;
        const active = isActive(destination);

        return (
          <Link
            key={destination.href}
            href={destination.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-control flex min-h-11 items-center gap-3 px-3 text-[0.9375rem] font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-text-soft hover:bg-raised hover:text-text",
            ].join(" ")}
          >
            <Icon className="size-5 shrink-0" />
            {destination.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The phone bar.
 *
 * `pb-[env(safe-area-inset-bottom)]` is not decoration: without it the bar sits
 * under the home indicator on every iPhone since the X, and the third tab is the
 * one that becomes unhittable.
 */
export function BottomNav({ role }: { role: "STUDENT" | "TEACHER" | "CONTENT_EDITOR" | "ADMIN" }) {
  const isActive = useActive();
  const destinations = destinationsFor(role);

  return (
    <nav
      aria-label="Main"
      className="border-line bg-card/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto flex max-w-md">
        {destinations.map((destination) => {
          const Icon = destination.icon;
          const active = isActive(destination);

          return (
            <li key={destination.href} className="flex-1">
              <Link
                href={destination.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-medium transition-colors",
                  active ? "text-brand-700" : "text-text-faint",
                ].join(" ")}
              >
                {/* The active pill sits behind the icon rather than under the
                    label, so the target the thumb is aiming at is the thing
                    that changes colour. */}
                <span
                  className={[
                    "rounded-pill grid h-7 w-12 place-items-center transition-colors",
                    active ? "bg-brand-100" : "",
                  ].join(" ")}
                >
                  <Icon className="size-5" />
                </span>
                {destination.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
