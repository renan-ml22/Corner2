'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import SheetFrame from '@/components/sheets/SheetFrame'
import { CATEGORIAS, exerciciosDaCategoria, type CategoriaDeExercicio, type Exercicio } from '@/data/exercicios'
import { NIVEL_LABEL } from '@/data/planos'
import { track } from '@/lib/posthog'
import { aoTeclarNoGrupo } from '@/lib/teclado'
import estilos from './exercicios.module.css'

export default function ExerciciosCliente() {
  const [categoria, setCategoria] = useState<CategoriaDeExercicio>(CATEGORIAS[0].id)
  const [aberto, setAberto] = useState<Exercicio | null>(null)
  const abridor = useRef<HTMLElement | null>(null)
  const exercicios = exerciciosDaCategoria(categoria)
  const atual = CATEGORIAS.find(c => c.id === categoria) ?? CATEGORIAS[0]

  // Ao fechar o painel, o foco volta para o cartão que o abriu.
  useEffect(() => {
    if (aberto !== null) return
    const el = abridor.current
    abridor.current = null
    if (el && el.isConnected) el.focus()
  }, [aberto])

  const abrir = (e: Exercicio, origem: HTMLElement) => {
    abridor.current = origem
    setAberto(e)
    track('sheet_opened', { sheet_name: 'exercicio' })
  }

  return (
    <main className="page-container">
      <header>
        <Link href="/plano" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar</Link>
        <p className="eyebrow mt-18">Aprenda e revise</p>
        <h1 className="page-title">Exercícios</h1>
        <p className="muted-copy">Vinte exercícios de boxe, com dicas e os erros mais comuns de cada um.</p>
      </header>

      <div className={estilos.abas} role="tablist" aria-label="Categorias de exercícios" onKeyDown={e => aoTeclarNoGrupo(e, 'tab')}>
        {CATEGORIAS.map(c => (
          <button
            key={c.id}
            type="button"
            role="tab"
            id={`aba-${c.id}`}
            aria-selected={categoria === c.id}
            aria-controls="painel-exercicios"
            tabIndex={categoria === c.id ? 0 : -1}
            className={categoria === c.id ? estilos.ativa : ''}
            onClick={() => setCategoria(c.id)}
          >
            <i className={`ph ${c.icone}`} aria-hidden="true" /> {c.nome}
          </button>
        ))}
      </div>

      <div role="tabpanel" id="painel-exercicios" aria-labelledby={`aba-${categoria}`}>
        <ul className={estilos.lista}>
          {exercicios.map(e => (
            <li key={e.id}>
              <button type="button" className={`surface-card ${estilos.cartao}`} aria-haspopup="dialog" onClick={ev => abrir(e, ev.currentTarget)}>
                <span className={estilos.icone} aria-hidden="true"><i className={`ph-fill ${atual.icone}`} /></span>
                <span className={estilos.nome}>{e.nome}</span>
                <span className="nivel-badge">{NIVEL_LABEL[e.nivel]}</span>
                <i className={`ph-bold ph-caret-right ${estilos.seta}`} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>

      {aberto && (
        <SheetFrame title={aberto.nome} onClose={() => setAberto(null)}>
          <div className={estilos.detalhe}>
            <p className={estilos.meta}>
              <span className="nivel-badge">{NIVEL_LABEL[aberto.nivel]}</span>
              <span>{atual.nome}</span>
            </p>
            <p className={estilos.descricao}>{aberto.descricao}</p>

            <h3 className={estilos.subtitulo}>Dicas</h3>
            <ul className={`${estilos.itens} ${estilos.dicas}`}>
              {aberto.dicas.map(d => <li key={d}><i className="ph-fill ph-check-circle" aria-hidden="true" /><span>{d}</span></li>)}
            </ul>

            <h3 className={estilos.subtitulo}>Erros comuns</h3>
            <ul className={`${estilos.itens} ${estilos.erros}`}>
              {aberto.errosComuns.map(d => <li key={d}><i className="ph-fill ph-x-circle" aria-hidden="true" /><span>{d}</span></li>)}
            </ul>

            <p className={estilos.video}>
              <i className="ph-fill ph-video-camera" aria-hidden="true" />
              <span><strong>Em breve: vídeo</strong><small>Vamos gravar a execução de cada exercício.</small></span>
            </p>
          </div>
        </SheetFrame>
      )}
    </main>
  )
}
