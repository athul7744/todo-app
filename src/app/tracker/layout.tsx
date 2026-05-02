import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tracker | Dash.",
};

export default function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
