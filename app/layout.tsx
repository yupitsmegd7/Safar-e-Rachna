import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safar-e-Rachna | A literary journal",
  description: "Poems, essays, reviews, and a daily practice of paying attention.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
