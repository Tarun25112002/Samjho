import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthAside } from "@/components/auth/auth-aside";
import { AuthFormColumn } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The `[[...sign-in]]` optional catch-all is required, not decorative: Clerk
 * routes its own sub-steps (verification, password reset, MFA challenge) as
 * child paths of this one. A plain `page.tsx` renders the first step and then
 * 404s on the second.
 */
export default function SignInPage() {
  return (
    <>
      <AuthAside
        eyebrow="Your revision desk"
        headline="Getting it wrong is the part that teaches."
        note="Everything you have practised is where you left it — including the questions you got wrong and haven't beaten yet."
      />

      <AuthFormColumn
        mobileHeadline="Pick up where you left off"
        context="Your saved practice, mistakes and progress are right where you left them."
      >
        <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
      </AuthFormColumn>
    </>
  );
}
