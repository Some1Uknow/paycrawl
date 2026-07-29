import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PayCrawl | Paid machine-readable content for agents",
  description:
    "An x402 edge gateway for paid, machine-readable publisher content on Celo.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
