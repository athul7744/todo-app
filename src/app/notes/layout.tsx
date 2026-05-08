import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notes | Dash.",
  icons: { icon: "/icon-notes.svg" },
};

export default function NotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}