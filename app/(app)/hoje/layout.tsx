import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hoje · Corner",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
