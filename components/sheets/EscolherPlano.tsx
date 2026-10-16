'use client'

import { useRouter } from 'next/navigation'
import { PLANOS, resumoRounds } from '@/data/planos'
import { useAssinatura } from '@/hooks/useAssinatura'
import { NOME_DO_ACESSO, RECURSO_DO_PLANO_DE_TREINO, recurso } from '@/lib/assinatura/catalogo'
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
  const router = useRouter()
  const { planoDeTreinoLiberado } = useAssinatura()

  const escolher = (id: string, nome: string) => {
    if (planoAtivo?.planoId === id) { closeSheet(); return }
    if (planoAtivo && !window.confirm(TEXTOS.confirmar.trocarPlano(nome))) return
    escolherPlano(id)
    closeSheet()
    showToast(TEXTOS.aviso.planoAtivado(nome))
  }

  // Plano de treino que a assinatura atual não inclui: leva à tela de assinatura em vez de ativá-lo.
  const irParaAssinatura = () => {
    closeSheet()
    router.push('/assinatura')
  }

  return (
    <SheetFrame title="Escolher plano" onClose={closeSheet}>
      <p className={comum.dica}>A semana 1 começa nesta segunda-feira.</p>
      <div className={comum.grade}>
        {PLANOS.map(p => {
          const ativo = planoAtivo?.planoId === p.id
          const liberado = planoDeTreinoLiberado(p.id)
          return (
            <button key={p.id} onClick={() => (liberado ? escolher(p.id, p.nome) : irParaAssinatura())} aria-pressed={ativo} className={`${estilos.plano} ${ativo ? estilos.ativo : ''}`}>
              <span className={estilos.linha}>
                <span className={estilos.nome}>{p.nome}</span>
                {ativo
                  ? <span className={estilos.tagAtivo}><i className="ph-fill ph-check-circle" /> Ativo</span>
                  : !liberado
                    ? <span className={estilos.tagBloqueado}><i className="ph-fill ph-lock-simple" /> Plano {NOME_DO_ACESSO[recurso(RECURSO_DO_PLANO_DE_TREINO[p.id]).nivelMinimo]}</span>
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
