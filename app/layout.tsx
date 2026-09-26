import type { Metadata } from "next";
import "./globals.css";
import "./super-app.css";

export const metadata: Metadata = {
  title: "MOTBOT — The conversational super-app for Monad",
  description: "Discover and interact with apps across Monad through one voice and text interface.",
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
