import { CornerProvider } from "@/components/CornerProvider";
import BottomNav from "@/components/BottomNav";
import AppSheets from "@/components/AppSheets";
import Toast from "@/components/Toast";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CornerProvider>
      <div className="app-main">{children}</div>
      <BottomNav />
      <AppSheets />
      <Toast />
    </CornerProvider>
  );
}
