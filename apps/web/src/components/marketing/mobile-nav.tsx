"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ButtonLink } from "@/components/ui/button";

/**
 * The phone menu.
 *
 * A disclosure rather than a full-screen overlay: there are three links and a
 * button, and a takeover for four items is theatre. It pushes the page down
 * instead of covering it, so nothing is hidden behind it and there is no scroll
 * lock to get wrong.
 *
 * `Escape` closes it, and the trigger keeps `aria-expanded` in step — the two
 * things a hand-rolled menu usually misses.
 */
export function MobileNav({
  links,
  signedIn,
}: {
  links: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => {
          setOpen((value) => !value);
        }}
        className="border-line-strong text-text grid size-11 place-items-center rounded-full border"
      >
        <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        <svg
          viewBox="0 0 24 24"
          className="size-5"
          aria-hidden="true"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          {open ? (
            <>
              <path d="M6 6 18 18" />
              <path d="M18 6 6 18" />
            </>
          ) : (
            <>
              <path d="M4 8h16" />
              <path d="M4 16h16" />
            </>
          )}
        </svg>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.nav
            id="site-menu"
            aria-label="Site"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="border-line bg-card absolute inset-x-0 top-full overflow-hidden border-b"
          >
            <ul className="flex flex-col gap-1 px-5 py-4">
              {links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => {
                      setOpen(false);
                    }}
                    className="text-text hover:text-brand-700 flex min-h-11 items-center font-medium"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="pt-2">
                <ButtonLink href={signedIn ? "/home" : "/sign-up"} fullWidth>
                  {signedIn ? "Go to your dashboard" : "Start practising free"}
                </ButtonLink>
              </li>
              {signedIn ? null : (
                <li>
                  <Link
                    href="/sign-in"
                    className="text-text-soft flex min-h-11 items-center justify-center text-sm font-medium"
                  >
                    Sign in
                  </Link>
                </li>
              )}
            </ul>
          </motion.nav>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
