import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";

import { AuthAside } from "@/components/auth/auth-aside";
import { AuthFormColumn } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Create an account" };

export default function SignUpPage() {
  return (
    <>
      <AuthAside
        eyebrow="Practice the real paper"
        headline="Practise the paper you are actually going to sit."
        note="Signing up asks for a parent or guardian's email address. Samjho carries no advertising and no behavioural tracking, and every account is treated as belonging to a student under 18."
      />

      <AuthFormColumn
        mobileHeadline="Class 10 Maths and Science, on the CBSE pattern"
        context="A private revision desk in a few calm steps. A parent or guardian’s email comes next."
      >
        <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
      </AuthFormColumn>
    </>
  );
}
