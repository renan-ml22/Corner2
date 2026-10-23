import { CornerProvider } from '@/components/CornerProvider'
import { getCurrentUser } from '@/lib/dal'

/** Passos 2 a 4 do onboarding: exigem login (a conta foi criada no passo 1) e usam os mesmos dados do app. */
export default async function PassosLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  return <CornerProvider usuario={{ id: user.id, nome: user.name }}>{children}</CornerProvider>
}
