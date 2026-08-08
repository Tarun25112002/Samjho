import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Samjho — CBSE Board Exam Preparation",
    template: "%s · Samjho",
  },
  description:
    "Practise CBSE Class 10 and 12 board questions, understand your mistakes, and rehearse the full 3-hour exam before you sit it.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Deliberately not disabling zoom. Pinch-to-zoom is an accessibility
  // requirement, and students read dense question text on small screens.
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/*
          Inside <body>, not wrapping <html>. Clerk injects script tags and a
          context provider; wrapping the document element instead makes it own
          the <html> render, which fights with Next's own streaming.

          Note there is no `appearance` prop yet. Styling Clerk's components to
          match the product is Phase 3 work, once the design tokens in
          globals.css stop being placeholders.
        */}
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
