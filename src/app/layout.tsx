import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SkillBank - AI Agent Skills Marketplace",
  description: "Discover, install, and manage skills for your AI coding agents. The marketplace for Claude, Codex, and beyond.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
