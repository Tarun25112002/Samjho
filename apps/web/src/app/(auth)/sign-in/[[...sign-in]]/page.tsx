import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The `[[...sign-in]]` optional catch-all is required, not decorative: Clerk
 * routes its own sub-steps (verification, password reset, MFA challenge) as
 * child paths of this one. A plain `page.tsx` renders the first step and then
 * 404s on the second.
 */
export default function SignInPage() {
  return <SignIn />;
}
