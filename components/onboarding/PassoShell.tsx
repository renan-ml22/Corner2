import Link from 'next/link'
import type { ReactNode } from 'react'
import estilos from './onboarding.module.css'

export const TOTAL_DE_PASSOS = 4

/** Moldura dos passos do onboarding: voltar, "Passo n de 4", barra de progresso, título e o conteúdo do passo. */
export default function PassoShell({ passo, titulo, subtitulo, voltar, children }: { passo: number; titulo: string; subtitulo?: string; voltar?: string; children: ReactNode }) {
  return (
    <main className={estilos.pagina}>
      <div className={estilos.coluna}>
        <div className={estilos.topo}>
          {voltar && <Link href={voltar} className={estilos.voltar}><i className="ph-bold ph-arrow-left" aria-hidden="true" /> Voltar</Link>}
          <span className={estilos.passo}>Passo {passo} de {TOTAL_DE_PASSOS}</span>
        </div>
        <div className={estilos.barra} aria-hidden="true">
          {Array.from({ length: TOTAL_DE_PASSOS }, (_, i) => <span key={i} className={`${estilos.segmento} ${i < passo ? estilos.segmentoFeito : ''}`} />)}
        </div>
        <header>
          <h1 id="titulo-do-passo" className={estilos.titulo}>{titulo}</h1>
          {subtitulo && <p className={estilos.subtitulo}>{subtitulo}</p>}
        </header>
        {children}
      </div>
    </main>
  )
}
