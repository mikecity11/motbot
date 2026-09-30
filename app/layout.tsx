import type { Metadata } from "next";
import "./globals.css";
import "./super-app.css";
import {MotWalletProvider} from "@/components/dynamic-wallet-provider";

export const metadata: Metadata = {
  title: "MOTBOT — The conversational super-app for Monad",
  description: "Discover and interact with apps across Monad through one voice and text interface.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/motbot-icon-v1.png",
    shortcut: "/brand/motbot-icon-v1.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><MotWalletProvider>{children}</MotWalletProvider></body>
    </html>
  );
}
