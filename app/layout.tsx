import type { Metadata, Viewport } from "next";
import "./globals.css";
import { CornerProvider } from "@/components/CornerProvider";
import BottomNav from "@/components/BottomNav";
import AppSheets from "@/components/AppSheets";
import Toast from "@/components/Toast";

export const metadata: Metadata = {
  title: "Corner",
  description: "Seu treino de boxe, planejado entre rounds.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Corner",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0f17",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/regular/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/fill/style.css" />
        <link rel="stylesheet" href="https://unpkg.com/@phosphor-icons/web@2.1.1/src/bold/style.css" />
      </head>
      <body>
        <CornerProvider>
          <div className="app-main">{children}</div>
          <BottomNav />
          <AppSheets />
          <Toast />
        </CornerProvider>
      </body>
    </html>
  );
}
