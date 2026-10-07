'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCorner } from './CornerProvider'

const RED = 'oklch(0.63 0.21 25)'
const MUTED = 'var(--color-neutral-400)'

const TABS = [
  { href: '/hoje',      label: 'Hoje',      base: 'ph-house' },
  { href: '/plano',     label: 'Plano',     base: 'ph-calendar-dots' },
  { href: '/progresso', label: 'Progresso', base: 'ph-chart-line-up' },
  { href: '/perfil',    label: 'Perfil',    base: 'ph-user-circle' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { openRegister } = useCorner()

  const tabBtn = (tab: typeof TABS[0]) => {
    const active = pathname.startsWith(tab.href)
    return (
      <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined} style={{ height: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: active ? RED : MUTED, textDecoration: 'none' }}>
        <i className={active ? `ph-fill ${tab.base}` : `ph ${tab.base}`} style={{ fontSize: 24 }} />
        <span style={{ fontSize: 11 }}>{tab.label}</span>
      </Link>
    )
  }

  return (
    <nav aria-label="Navegação principal" style={{ position: 'fixed', left: 0, right: 0, bottom: 0, height: 'calc(70px + max(22px, env(safe-area-inset-bottom)))', padding: '0 12px max(22px, env(safe-area-inset-bottom))', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', alignItems: 'center', background: 'oklch(0.2 0.02 275 / 0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid oklch(1 0 0 / 0.06)', zIndex: 4 }}>
      {tabBtn(TABS[0])}
      {tabBtn(TABS[1])}
      <div style={{ display: 'grid', placeItems: 'center' }}>
        <button onClick={() => openRegister()} aria-label="Registrar treino" style={{ width: 58, height: 58, borderRadius: 20, border: 0, marginTop: -26, cursor: 'pointer', background: 'linear-gradient(145deg, oklch(0.66 0.21 25), oklch(0.55 0.21 25))', color: '#f4f2f2', fontSize: 28, display: 'grid', placeItems: 'center', boxShadow: '0 10px 24px oklch(0.63 0.21 25 / 0.5), inset 0 1px 0 oklch(1 0 0 / 0.25)' }}>
          <i className="ph-bold ph-plus" />
        </button>
      </div>
      {tabBtn(TABS[2])}
      {tabBtn(TABS[3])}
    </nav>
  )
}
