import type { ClerkProvider } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type ClerkLocalization = NonNullable<ComponentProps<typeof ClerkProvider>["localization"]>;

/**
 * The words on Clerk's forms.
 *
 * Two reasons this file exists rather than the defaults being left alone.
 *
 * The first is literal: Clerk builds its titles from the application name in its
 * own dashboard, which is stored as `SAMJHO`. "Sign in to SAMJHO" shouts, and
 * nothing else in this product is set in capitals. Overriding the strings is the
 * only way to fix that from code.
 *
 * The second is that these are the first sentences anyone reads. "Welcome back!
 * Please sign in to continue" is what a component library says; the rest of the
 * product tells a student what happens next and why, and the sign-in screen
 * should not be the one page that talks like a vendor.
 *
 * Only the entry steps are overridden. Verification, password reset and MFA keep
 * Clerk's own copy — it is careful, it is translated, and rewriting security
 * instructions to sound friendlier is how people end up locked out.
 */
export const clerkLocalization: ClerkLocalization = {
  // Clerk's default is "Continue" followed by a chevron. The chevron is hidden
  // in the appearance; the verb carries the action on its own.
  formButtonPrimary: "Continue",
  socialButtonsBlockButton: "Continue with {{provider|titleize}}",
  dividerText: "or",

  signIn: {
    start: {
      title: "Welcome back",
      subtitle: "Everything you have practised is where you left it.",
      actionText: "New here?",
      actionLink: "Create an account",
    },
  },

  signUp: {
    start: {
      title: "Create your account",
      subtitle: "Free during the closed pilot. No card, and no ads ever.",
      actionText: "Already have an account?",
      actionLink: "Sign in",
    },
  },
};
