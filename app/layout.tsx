import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "local-lmcanvas",
  description: "Branching AI conversations, stored locally.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-screen bg-zinc-50 text-zinc-900">{children}</body>
    </html>
  );
}
