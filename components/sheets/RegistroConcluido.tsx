'use client'

import { useToast } from '@/hooks/useToast'
import { cargaDaSessao } from '@/lib/saude'
import { usePainelAcoes, usePainelEstado } from '../PainelProvider'
import animacoes from '../animacoes.module.css'
import comum from './comum.module.css'
import estilos from './RegistroConcluido.module.css'
import SheetFrame from './SheetFrame'
import { TEXTOS } from '@/lib/textos'

/** Último passo do registro: resumo do treino e, se houve pancada forte, o aviso de saúde. */
export default function RegistroConcluido() {
  const { closeSheet } = usePainelAcoes()
  const { rounds, roundMin, rpe, elapsed, ultimoSalvo } = usePainelEstado()
  const showToast = useToast()

  const finish = () => { closeSheet(); showToast(TEXTOS.aviso.treinoSalvo) }
  const cabecaForte = ultimoSalvo?.sparring?.cabeca === 'fortes'
  const numeros = [
    { v: rounds, l: 'rounds' },
    { v: ultimoSalvo ? cargaDaSessao(ultimoSalvo) : rounds * roundMin * rpe, l: 'carga' },
    { v: rpe, l: 'RPE' },
  ]

  return (
    <SheetFrame title="Concluído" onClose={finish}>
      <div className={estilos.topo}>
        <div className={`${estilos.check} ${animacoes.surgir}`}>
          <i className="ph-bold ph-check" />
        </div>
        <h3 className={estilos.titulo}>Treino registrado!</h3>
        <p className={estilos.tempo}>Tempo de treino: {Math.floor(elapsed / 60)} min {String(elapsed % 60).padStart(2, '0')} s</p>
      </div>
      <div className={estilos.numeros}>
        {numeros.map(s => (
          <div key={s.l} className={estilos.numero}>
            <div className={estilos.numeroValor}>{s.v}</div>
            <div className={estilos.numeroRotulo}>{s.l}</div>
          </div>
        ))}
      </div>
      {cabecaForte && (
        <div role="alert" className={estilos.aviso}>
          <i className={`ph-fill ph-first-aid ${estilos.avisoIcone}`} />
          <span>Você levou pancadas fortes na cabeça. Evite sparring pelos próximos 7 dias. Se tiver dor de cabeça persistente, tontura, náusea, visão turva ou confusão, procure atendimento médico.</span>
        </div>
      )}
      <button onClick={finish} className={comum.primario}>Concluir</button>
    </SheetFrame>
  )
}
