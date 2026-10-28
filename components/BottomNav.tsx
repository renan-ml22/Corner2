'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAcesso } from '@/hooks/useAssinatura'
import { useSeloDeAlunos } from '@/hooks/useSeloDeAlunos'
import { timerEstaAndando } from '@/hooks/useTimerAndando'
import { abaAtiva, descricaoDoSeloDeAlunos, textoDoSeloDeAlunos } from '@/lib/navegacao'
import { TEXTOS } from '@/lib/textos'
import { track } from '@/lib/posthog'
import estilos from './BottomNav.module.css'
import { usePainelAcoes } from './PainelProvider'

const TABS = [
  { href: '/hoje',      label: 'Hoje',      base: 'ph-house' },
  { href: '/plano',     label: 'Plano',     base: 'ph-calendar-dots' },
  { href: '/timer',     label: 'Timer',     base: 'ph-timer' },
  { href: '/progresso', label: 'Progresso', base: 'ph-chart-line-up' },
  { href: '/perfil',    label: 'Perfil',    base: 'ph-user-circle' },
]

/** Só para quem tem o plano Cornerman ou Profissional: fica entre Progresso e Perfil. */
const ABA_ALUNOS = { href: '/alunos', label: 'Alunos', base: 'ph-users-three' }

export default function BottomNav() {
  const pathname = usePathname()
  const { openRegister } = usePainelAcoes()
  const { liberado, pronto } = useAcesso('gestaoDeAlunos')
  // Enquanto não se sabe o plano, a aba não aparece (evita piscar para quem não tem o plano).
  const comAlunos = pronto && liberado
  const parados = useSeloDeAlunos(comAlunos, pathname)

  // O cronômetro ocupa a tela inteira: sem barra de navegação por cima.
  if (pathname.startsWith('/treino')) return null

  const acesa = abaAtiva(pathname)
  const textoDoSelo = textoDoSeloDeAlunos(parados)
  const descricaoDoSelo = descricaoDoSeloDeAlunos(parados)

  const tabBtn = (tab: typeof TABS[0]) => {
    const active = acesa === tab.href
    const selo = tab.href === ABA_ALUNOS.href ? textoDoSelo : null
    return (
      <Link key={tab.href} href={tab.href} aria-current={active ? 'page' : undefined} className={`${estilos.aba} ${active ? estilos.ativa : ''}`} onClick={e => {
        // Com o Timer contando, sair da tela perde a contagem: pergunta antes (o aviso do navegador não vale para navegação interna).
        if (!active && timerEstaAndando() && !window.confirm(TEXTOS.confirmar.sairDoTimer)) { e.preventDefault(); return }
        if (!active) track('tab_changed', { tab_name: tab.href.slice(1) })
      }}>
        <span className={estilos.icone}>
          <i className={active ? `ph-fill ${tab.base}` : `ph ${tab.base}`} />
          {selo && <span className={estilos.selo} aria-hidden="true">{selo}</span>}
        </span>
        <span>{tab.label}</span>
        {selo && descricaoDoSelo && <span className="sr-only">, {descricaoDoSelo}</span>}
      </Link>
    )
  }

  return (
    <nav aria-label="Navegação principal" className={`${estilos.barra} ${comAlunos ? estilos.comAlunos : ''}`}>
      {tabBtn(TABS[0])}
      {tabBtn(TABS[1])}
      <div className={estilos.centro}>
        <button onClick={() => openRegister()} aria-label="Registrar treino" className={estilos.registrar}>
          <i className="ph-bold ph-plus" />
        </button>
      </div>
      {tabBtn(TABS[2])}
      {tabBtn(TABS[3])}
      {comAlunos && tabBtn(ABA_ALUNOS)}
      {tabBtn(TABS[4])}
    </nav>
  )
}
