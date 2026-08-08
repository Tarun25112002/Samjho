import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center gap-6">
      <SignUp />

      {/*
        Shown before the account exists, not after. A parent's address is asked
        for during onboarding, and someone signing their child up should know
        that at the point they decide — not once the account is already created.
      */}
      <p className="text-ink-500 dark:text-ink-300 max-w-sm text-center text-sm text-pretty">
        After signing up you&rsquo;ll be asked for a parent or guardian&rsquo;s email address.
        Samjho is in a closed pilot and every account is treated as belonging to a student under 18.
      </p>
    </div>
  );
}
