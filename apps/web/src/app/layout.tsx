import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import { clerkAppearance } from "@/lib/clerk-appearance";
import { clerkLocalization } from "@/lib/clerk-localization";
import { fontVariables } from "@/lib/fonts";

// Imported here rather than from inside the components that need them.
// `@samjho/ui` is compiled by `tsc`, which cannot emit a `.css` import — and a
// component that silently pulls in 25KB of KaTeX styling is a component that
// fights the app's own bundling. The app decides what CSS it ships.
import "katex/dist/katex.min.css";
import "@samjho/ui/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Samjho — CBSE Board Exam Preparation",
    template: "%s · Samjho",
  },
  description:
    "Practise CBSE Class 10 and 12 board questions, understand your mistakes, and rehearse the full 3-hour exam before you sit it.",
  applicationName: "Samjho",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deliberately not disabling zoom. Pinch-to-zoom is an accessibility
  // requirement, and students read dense question text on small screens.
  maximumScale: 5,
  // Android Chrome paints the address bar with this, so the browser chrome
  // stops being a white bar above a dark page at midnight. Both values are the
  // literal `--color-page` from globals.css; a `var()` here is not resolved,
  // because the tag is read before any stylesheet is.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1814" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
      Two attributes, both load-bearing.

      The font variables go on <html> so `--font-poppins` and
      `--font-source-serif` are in scope for `@theme`'s `--font-sans`, which is
      declared on :root — the same element.

      `data-theme="light"` pins the product to the white ground the brand is
      built on. The dark palette in globals.css is complete and measured, and
      this attribute is the switch that turns it on — but until there is a
      control for it in the app shell, an OS-level dark preference would flip
      half the product into a theme nobody has reviewed. One attribute to remove
      on the day the toggle ships.
    */
    <html lang="en" className={fontVariables} data-theme="light">
      <body>
        {/*
          Inside <body>, not wrapping <html>. Clerk injects script tags and a
          context provider; wrapping the document element instead makes it own
          the <html> render, which fights with Next's own streaming.

          `appearance` is applied once, here, rather than on each <SignIn /> —
          it covers the UserButton and every account-management modal too, and
          those are surfaces nobody remembers to theme individually.
        */}
        <ClerkProvider appearance={clerkAppearance} localization={clerkLocalization}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
