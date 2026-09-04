import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

/**
 * Samjho's theme for Clerk's hosted components.
 *
 * The root layout has carried a note since Phase 2 saying that styling Clerk was
 * deferred until the design tokens stopped being placeholders. They have, so
 * this is that work.
 *
 * ## Why the form is still Clerk's
 *
 * Rebuilding sign-in with Clerk Elements would buy total control of the markup
 * and cost us password rules, email verification, MFA, bot defence and the OAuth
 * dance — the exact list of things a product holding minors' data should not
 * hand-roll. So the frame around the form is ours and the form is theirs.
 *
 * ## Two kinds of colour, and why they are written differently
 *
 * The surface colours are `var(--color-…)` references. Clerk v7 passes those
 * straight through to CSS, so its card follows the app into dark mode with no
 * second theme object, no flash and nothing to keep in sync.
 *
 * The four *scale* colours — primary, danger, success, warning — are literal
 * hex. Clerk derives hover and pressed shades from them in JavaScript, and it
 * cannot do that arithmetic on a `var()`; a colour it fails to parse is a colour
 * it drops. Those four are the only values in the app duplicated by hand, and
 * each one names the token it came from.
 *
 * ## Why `elements` is short
 *
 * Everything expressible as a variable is a variable. What is left is the two
 * things the variable API has no word for: the 44px minimum touch target this
 * product applies to every control, and the saffron button's shadow.
 */

/** `--color-brand-500`. The saffron fill, not the readable orange. */
const BRAND = "#f47600";
/** `--color-on-brand`. Near-black: white on `brand-500` measures 2.9:1. */
const ON_BRAND = "#16120e";
/** `--color-marker-600`, `--color-tick-600`, `--color-half-600`. */
const MARKER = "#cc003a";
const TICK = "#1b854f";
const HALF = "#b59600";

/**
 * Derived from the provider rather than imported from `@clerk/types`, which is a
 * transitive dependency this app never declared. Reaching into one works today
 * and breaks on whichever pnpm update stops hoisting it.
 */
type ClerkAppearance = NonNullable<ComponentProps<typeof ClerkProvider>["appearance"]>;

export const clerkAppearance: ClerkAppearance = {
  options: {
    // Google first. It is one tap on a phone already signed into a Google
    // account, which describes most of this audience.
    socialButtonsPlacement: "top",
    socialButtonsVariant: "blockButton",
    // The page renders its own wordmark; Clerk's would be the second one.
    logoPlacement: "none",
    // The page supplies the frame, so Clerk's card is flush.
    elevation: "flush",
    animations: false,
  },

  variables: {
    colorPrimary: BRAND,
    colorPrimaryForeground: ON_BRAND,
    colorDanger: MARKER,
    colorSuccess: TICK,
    colorWarning: HALF,

    colorBackground: "var(--color-card)",
    colorForeground: "var(--color-text)",
    colorMuted: "var(--color-raised)",
    colorMutedForeground: "var(--color-text-soft)",
    colorInput: "var(--color-card)",
    colorInputForeground: "var(--color-text)",
    colorBorder: "var(--color-line-strong)",
    colorRing: "var(--color-brand-500)",

    fontFamily: "var(--font-sans)",
    // 15px for labels and helper text. The inputs themselves are pushed back to
    // 16px below: under that, iOS Safari zooms the whole viewport on focus and
    // the student has to pinch back out.
    fontSize: "0.9375rem",
    borderRadius: "0.875rem",
  },

  elements: {
    rootBox: "w-full!",
    cardBox: "w-full! bg-transparent! shadow-none!",
    card: "border-line! bg-card! w-full! gap-4! rounded-[1.5rem]! border! p-5! shadow-lift! sm:p-6!",

    header: "text-left! items-start!",
    headerTitle: "text-[1.7rem]! leading-tight! font-semibold! tracking-[-0.03em]!",
    headerSubtitle: "text-text-soft! mt-1.5! text-sm! leading-relaxed!",

    // 44px is the minimum comfortable touch target, and it is the one rule
    // applied to every control in this product without exception.
    socialButtons: "gap-3!",
    socialButtonsBlockButton:
      "border! border-line-strong! bg-card! hover:bg-raised! min-h-11! rounded-control! shadow-none! transition-colors!",
    socialButtonsBlockButtonText: "text-text! font-semibold!",
    dividerLine: "bg-line!",
    dividerText: "text-text-faint! text-xs! font-medium!",
    formFieldLabel: "text-text! text-sm! font-semibold!",
    formFieldInput:
      "border! border-line-strong! bg-raised! text-text! hover:border-brand-300! focus:border-brand-500! min-h-11! rounded-control! text-base! shadow-none!",
    otpCodeFieldInput: "size-11! text-lg!",

    // The one place the page asks for a shadow: the thing it wants pressed.
    // The trailing chevron goes: "Continue ›" is Clerk's flourish, and an arrow
    // welded to a verb is the one piece of button styling this product does not
    // want to inherit. A descendant selector, not a child one — Clerk nests the
    // icon inside the label span, so `[&>svg]` matches nothing.
    formButtonPrimary:
      "min-h-11! rounded-pill! font-semibold! normal-case! tracking-normal! shadow-brand! [&_svg]:hidden!",

    footer: "bg-raised! mt-2! rounded-control! px-4! py-2.5!",
    footerActionText: "text-text-soft! text-sm!",
    footerActionLink: "text-brand-700! font-semibold! hover:underline!",
    identityPreview: "border-line! bg-raised! rounded-control!",
    identityPreviewText: "text-text!",

    // Belt and braces with `options.logoPlacement`. A second wordmark inside the
    // card is the commonest way a themed Clerk form ends up with two logos.
    logoBox: "hidden!",
  },
};
