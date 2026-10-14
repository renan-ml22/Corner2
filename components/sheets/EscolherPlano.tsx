'use client'

import { PLANOS, resumoRounds } from '@/data/planos'
import { usePlano } from '@/hooks/usePlano'
import { useToast } from '@/hooks/useToast'
import { usePainelAcoes } from '../PainelProvider'
import comum from './comum.module.css'
import estilos from './EscolherPlano.module.css'
import SheetFrame from './SheetFrame'
import { TEXTOS } from '@/lib/textos'

/** Lista dos planos de treino; escolher um ativa a semana 1 a partir da próxima segunda-feira. */
export default function EscolherPlano() {
  const { closeSheet } = usePainelAcoes()
  const { planoAtivo, escolherPlano } = usePlano()
  const showToast = useToast()

  const escolher = (id: string, nome: string) => {
    if (planoAtivo?.planoId === id) { closeSheet(); return }
    if (planoAtivo && !window.confirm(TEXTOS.confirmar.trocarPlano(nome))) return
    escolherPlano(id)
    closeSheet()
    showToast(TEXTOS.aviso.planoAtivado(nome))
  }

  return (
    <SheetFrame title="Escolher plano" onClose={closeSheet}>
      <p className={comum.dica}>A semana 1 começa nesta segunda-feira.</p>
      <div className={comum.grade}>
        {PLANOS.map(p => {
          const ativo = planoAtivo?.planoId === p.id
          return (
            <button key={p.id} onClick={() => escolher(p.id, p.nome)} aria-pressed={ativo} className={`${estilos.plano} ${ativo ? estilos.ativo : ''}`}>
              <span className={estilos.linha}>
                <span className={estilos.nome}>{p.nome}</span>
                {ativo
                  ? <span className={estilos.tagAtivo}><i className="ph-fill ph-check-circle" /> Ativo</span>
                  : <span className="nivel-badge">{p.nivelLabel}</span>}
              </span>
              <span className={estilos.resumo}>{p.resumo}</span>
              <span className={estilos.chips}>
                <span className="chip"><i className="ph ph-calendar-blank" /> {p.semanas} semanas</span>
                <span className="chip"><i className="ph ph-repeat" /> {p.diasPorSemana}× por semana</span>
                <span className="chip"><i className="ph ph-timer" /> {resumoRounds(p)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </SheetFrame>
  )
}
