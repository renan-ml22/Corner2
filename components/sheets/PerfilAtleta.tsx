'use client'

import { useState } from 'react'
import { resumoRounds } from '@/data/planos'
import { usePlano } from '@/hooks/usePlano'
import { usePreferencias } from '@/hooks/usePreferencias'
import { useToast } from '@/hooks/useToast'
import { metaInicial, recomendarPlano, type Objetivo } from '@/lib/perfil'
import type { Experiencia, Postura } from '@/lib/tipos'
import { usePainelAcoes } from '../PainelProvider'
import comum from './comum.module.css'
import estilos from './PerfilAtleta.module.css'
import SheetFrame from './SheetFrame'
import Stepper from './Stepper'
import { TEXTOS } from '@/lib/textos'

const EXPERIENCIAS: [Experiencia, string][] = [['nenhuma', 'Nunca treinei'], ['ate1', 'Menos de 1 ano'], ['1a3', '1 a 3 anos'], ['mais3', 'Mais de 3 anos ou já compito']]
const OBJETIVOS: [Objetivo, string, string][] = [
  ['condicionamento', 'Condicionamento', 'Fôlego, resistência e saúde'],
  ['tecnica', 'Técnica', 'Evoluir golpes, defesa e combinações'],
  ['competir', 'Competir', 'Preparar para lutas e sparrings'],
]

const classeOpcao = (ativa: boolean) => `${estilos.opcao} ${ativa ? estilos.ativa : ''}`

/** Perfil de atleta em 5 passos: postura, experiência, objetivo, dias por semana e plano recomendado. */
export default function PerfilAtleta() {
  const { closeSheet, openPlanos } = usePainelAcoes()
  const { atualizarConfig } = usePreferencias()
  const { escolherPlano } = usePlano()
  const showToast = useToast()

  const [passo, setPasso] = useState(0)
  const [postura, setPostura] = useState<Postura>('ortodoxo')
  const [exp, setExp] = useState<Experiencia>('ate1')
  const [obj, setObj] = useState<Objetivo>('tecnica')
  const [dias, setDias] = useState(3)
  const total = 5

  const plano = recomendarPlano(exp, obj)
  const metaFinal = metaInicial(dias, plano)

  const concluir = (abrirLista: boolean) => {
    atualizarConfig({ postura, experiencia: exp, onboardingFeito: true, metaSemanal: metaFinal })
    if (abrirLista) { openPlanos(); return }
    escolherPlano(plano.id)
    closeSheet()
    showToast(TEXTOS.aviso.perfilSalvo(plano.nome))
  }

  return (
    <SheetFrame title="Perfil de atleta" onBack={passo > 0 ? () => setPasso(p => p - 1) : undefined} onClose={closeSheet}>
      <p className={estilos.passo}>Passo {passo + 1} de {total}</p>

      {passo === 0 && (
        <>
          <p className={estilos.pergunta}>Qual é a sua postura? Ela define qual mão fica à frente nas orientações.</p>
          <div className={comum.grade}>
            <button onClick={() => { setPostura('ortodoxo'); setPasso(1) }} className={classeOpcao(postura === 'ortodoxo')}><strong>Ortodoxo</strong><span className={estilos.descricao}>Mão e pé esquerdos à frente (comum em destros)</span></button>
            <button onClick={() => { setPostura('canhoto'); setPasso(1) }} className={classeOpcao(postura === 'canhoto')}><strong>Canhoto</strong><span className={estilos.descricao}>Mão e pé direitos à frente</span></button>
          </div>
        </>
      )}

      {passo === 1 && (
        <>
          <p className={estilos.pergunta}>Há quanto tempo você treina boxe?</p>
          <div className={comum.grade}>
            {EXPERIENCIAS.map(([id, label]) => (
              <button key={id} onClick={() => { setExp(id); setPasso(2) }} className={classeOpcao(exp === id)}><strong>{label}</strong></button>
            ))}
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <p className={estilos.pergunta}>Qual é o seu objetivo principal?</p>
          <div className={comum.grade}>
            {OBJETIVOS.map(([id, label, desc]) => (
              <button key={id} onClick={() => { setObj(id); setPasso(3) }} className={classeOpcao(obj === id)}><strong>{label}</strong><span className={estilos.descricao}>{desc}</span></button>
            ))}
          </div>
        </>
      )}

      {passo === 3 && (
        <>
          <p className={estilos.pergunta}>Quantos dias por semana você consegue treinar?</p>
          <Stepper label="Dias por semana" value={dias} unit="" min={2} max={6} onChange={setDias} />
          <button onClick={() => setPasso(4)} className={`${comum.primario} ${estilos.verPlano}`}>Ver plano recomendado</button>
        </>
      )}

      {passo === 4 && (
        <>
          <p className={estilos.pergunta}>Para o seu perfil, recomendo:</p>
          <div className={estilos.recomendado}>
            <span className={estilos.recomendadoTopo}><strong>{plano.nome}</strong><span className="nivel-badge">{plano.nivelLabel}</span></span>
            <span className={estilos.resumo}>{plano.resumo}</span>
            <span className={estilos.meta}>{plano.semanas} semanas · {plano.diasPorSemana}× por semana · {resumoRounds(plano)}</span>
          </div>
          {dias < plano.diasPorSemana && (
            <p className={estilos.avisoDias}>
              Este plano pede {plano.diasPorSemana}× por semana e você marcou {dias}×. Faça as sessões que der: sua meta semanal ficará em {metaFinal}×.
            </p>
          )}
          <div className={estilos.acoes}>
            <button onClick={() => concluir(false)} className={comum.primario}>Ativar este plano</button>
            <button onClick={() => concluir(true)} className={comum.fantasma}>Ver outros planos</button>
          </div>
        </>
      )}
    </SheetFrame>
  )
}
