import { CornerProvider } from "@/components/CornerProvider";
import BottomNav from "@/components/BottomNav";
import AppSheets from "@/components/AppSheets";
import Toast from "@/components/Toast";
import { getCurrentUser } from "@/lib/dal";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  return (
    <CornerProvider usuario={{ id: user.id, nome: user.name }}>
      <div className="app-main">{children}</div>
      <BottomNav />
      <AppSheets />
      <Toast />
    </CornerProvider>
  );
}
