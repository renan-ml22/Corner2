'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { abaAtiva } from '@/lib/navegacao'
import { track } from '@/lib/posthog'
import estilos from './BottomNav.module.css'
import { usePainelAcoes } from './PainelProvider'

const TABS = [
  { href: '/hoje',      label: 'Hoje',      base: 'ph-house' },
  { href: '/plano',     label: 'Plano',     base: 'ph-calendar-dots' },
  { href: '/progresso', label: 'Progresso', base: 'ph-chart-line-up' },
  { href: '/perfil',    label: 'Perfil',    base: 'ph-user-circle' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const { openRegister } = usePainelAcoes()

  // O cronômetro ocupa a tela inteira: sem barra de navegação por cima.
  if (pathname.startsWith('/treino')) return null

  const acesa = abaAtiva(pathname)

  const tabBtn = (tab: typeof TABS[0]) => {
    const active = acesa === tab.href
    return (
      <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined} className={`${estilos.aba} ${active ? estilos.ativa : ''}`} onClick={() => { if (!active) track('tab_changed', { tab_name: tab.href.slice(1) }) }}>
        <i className={active ? `ph-fill ${tab.base}` : `ph ${tab.base}`} />
        <span>{tab.label}</span>
      </Link>
    )
  }

  return (
    <nav aria-label="Navegação principal" className={estilos.barra}>
      {tabBtn(TABS[0])}
      {tabBtn(TABS[1])}
      <div className={estilos.centro}>
        <button onClick={() => openRegister()} aria-label="Registrar treino" className={estilos.registrar}>
          <i className="ph-bold ph-plus" />
        </button>
      </div>
      {tabBtn(TABS[2])}
      {tabBtn(TABS[3])}
    </nav>
  )
}
