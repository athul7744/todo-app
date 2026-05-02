import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tracker | Dash.",
  icons: { icon: "/icon-tracker.svg" },
};

export default function TrackerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
