'use client'

import { usePainelAcoes, usePainelEstado } from '../PainelProvider'
import { CAT_LABELS, type RegType } from '@/lib/tipos'
import comum from './comum.module.css'
import estilos from './RegistroTipo.module.css'
import SheetFrame from './SheetFrame'

const TIPOS: { id: RegType; icon: string; desc: string }[] = [
  { id: 'tec', icon: 'ph-target',       desc: 'Sombra, manopla, saco' },
  { id: 'con', icon: 'ph-heartbeat',    desc: 'Corda, circuito, corrida' },
  { id: 'spa', icon: 'ph-boxing-glove', desc: 'Rounds com parceiro' },
]

/** Primeiro passo do registro: o que foi treinado. */
export default function RegistroTipo() {
  const { setSheet, closeSheet } = usePainelAcoes()
  const { regType, setRegType } = usePainelEstado()

  return (
    <SheetFrame title="Registrar treino" onClose={closeSheet}>
      <p className={comum.dica}>O que você treinou?</p>
      <div className={comum.grade}>
        {TIPOS.map(t => (
          <button key={t.id} onClick={() => { setRegType(t.id); setSheet('details') }} className={`${estilos.tipo} ${regType === t.id ? estilos.ativo : ''}`}>
            <span className={estilos.icone}><i className={`ph-fill ${t.icon}`} /></span>
            <span className={estilos.texto}>
              <span className={estilos.nome}>{CAT_LABELS[t.id]}</span>
              <span className={estilos.descricao}>{t.desc}</span>
            </span>
            <i className={`ph-bold ph-caret-right ${estilos.seta}`} />
          </button>
        ))}
      </div>
    </SheetFrame>
  )
}
