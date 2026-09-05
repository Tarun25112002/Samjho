import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The button.
 *
 * One component for the two things a call to action can be — a link that
 * navigates and a button that does something — because the difference is a
 * routing decision, not a visual one, and every codebase that splits them ends
 * up with two that have drifted.
 *
 * ## The variants encode what the app wants
 *
 * `primary` is saffron and there is one of it per screen. That is the rule the
 * palette is built around: orange means "here", and a page with four orange
 * buttons has told the reader nothing. `secondary` is the outlined one for
 * everything else, and `quiet` is for actions that must be available without
 * asking to be noticed.
 *
 * ## Why the primary carries near-black type
 *
 * White on `brand-500` measures 2.8:1 — unreadable. Deepening the orange until
 * white works turns it into a burnt rust that is not the brand. Near-black on
 * saffron is 5.8:1 and keeps the orange exactly as drawn. Every saffron surface
 * in the product follows the same rule.
 */

type Variant = "primary" | "secondary" | "quiet";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-on-brand shadow-brand hover:bg-brand-400 active:bg-brand-600 border border-transparent",
  secondary:
    "bg-card text-text border border-line-strong hover:border-brand-500 hover:bg-brand-50/60",
  quiet: "text-text-soft hover:text-text border border-transparent",
};

const SIZES: Record<Size, string> = {
  // Every size clears 44px, which is the one rule applied to every control in
  // this product without exception — the audience is phone-first.
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-12 px-5 text-ui",
  lg: "min-h-14 px-7 text-base",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-semibold tracking-control transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-55";

function classes(variant: Variant, size: Size, full: boolean, extra?: string): string {
  return [BASE, VARIANTS[variant], SIZES[size], full ? "w-full" : "", extra]
    .filter(Boolean)
    .join(" ");
}

interface Shared {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  ...rest
}: Shared & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className">) {
  return (
    <Link href={href} className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </Link>
  );
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  children,
  type = "button",
  ...rest
}: Shared & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button type={type} className={classes(variant, size, fullWidth, className)} {...rest}>
      {children}
    </button>
  );
}
