'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import AtletaAvatar from '@/components/AtletaAvatar'
import TreinarComoAtleta from '@/components/TreinarComoAtleta'
import { PERGUNTAS } from '@/data/quiz'
import { useQuiz } from '@/hooks/useQuiz'
import { resultadoDoQuiz, serializarRespostas, type Compatibilidade } from '@/lib/quiz'
import estilos from './quiz.module.css'

type Direcao = 'avancar' | 'voltar'

function CartaoDoAtleta({ c, destaque }: { c: Compatibilidade; destaque: boolean }) {
  return (
    <article className={`surface-card ${estilos.atleta} ${destaque ? estilos.destaque : ''}`} aria-label={`${c.atleta.nome}, ${c.percentual}% de compatibilidade`}>
      <div className={estilos.atletaTopo}>
        <AtletaAvatar atleta={c.atleta} grande={destaque} />
        <div>
          <p className={estilos.compat}>{c.percentual}% de compatibilidade</p>
          <h2>{c.atleta.nome}</h2>
          <p className={estilos.estilo}>{c.atleta.estilo}</p>
        </div>
      </div>
      <p className={estilos.descricao}>{c.atleta.descricao}</p>
      {destaque && (
        <ul className={estilos.chips} aria-label="Características do estilo">
          {c.atleta.caracteristicas.map(x => <li key={x} className="chip">{x}</li>)}
        </ul>
      )}
      <div className={estilos.acoes}>
        <TreinarComoAtleta atleta={c.atleta} />
        <Link href={`/atletas/${c.atleta.id}`} className="btn-ghost">Ver estilo e plano <i className="ph-bold ph-caret-right" aria-hidden="true" /></Link>
      </div>
    </article>
  )
}

function Resultado({ respostas }: { respostas: number[] }) {
  const resultado = resultadoDoQuiz(respostas)
  if (!resultado) return null

  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Resultado do quiz</p>
        <h1 className="page-title">Seu estilo de luta</h1>
        <p className="muted-copy">Pelas suas respostas, estes são os dois atletas com o estilo mais parecido com o seu.</p>
      </header>

      <div className={estilos.resultado}>
        <CartaoDoAtleta c={resultado.primeiro} destaque />
        <CartaoDoAtleta c={resultado.segundo} destaque={false} />
      </div>

      <Link href="/quiz" className={`btn-ghost ${estilos.refazer}`}><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true" /> Refazer o quiz</Link>
      <p className={`muted-copy ${estilos.aviso}`}>É um quiz de diversão, baseado no estilo de luta de cada atleta. O Corner não tem vínculo com eles.</p>
    </main>
  )
}

export default function QuizCliente({ respostasIniciais }: { respostasIniciais: number[] | null }) {
  const router = useRouter()
  const [, guardarQuiz] = useQuiz()
  const [respostas, setRespostas] = useState<number[]>([])
  const [passo, setPasso] = useState(0)
  const [direcao, setDirecao] = useState<Direcao>('avancar')
  const [enviando, setEnviando] = useState(false)
  const titulo = useRef<HTMLHeadingElement>(null)
  const primeiraVez = useRef(true)

  // A cada pergunta nova o foco vai para o título dela, para o leitor de tela anunciar a pergunta.
  useEffect(() => {
    if (primeiraVez.current) { primeiraVez.current = false; return }
    titulo.current?.focus()
  }, [passo])

  if (respostasIniciais) return <Resultado respostas={respostasIniciais} />

  const pergunta = PERGUNTAS[passo]
  const ultima = passo === PERGUNTAS.length - 1

  const escolher = (indice: number) => {
    if (enviando) return
    const proximas = [...respostas]
    proximas[passo] = indice
    setRespostas(proximas)
    if (ultima) {
      setEnviando(true)
      // Só quem acabou de responder guarda: abrir o resultado de outra pessoa pelo endereço não troca as suas respostas.
      guardarQuiz(serializarRespostas(proximas))
      router.push(`/quiz?r=${serializarRespostas(proximas)}`)
      return
    }
    setDirecao('avancar')
    setPasso(passo + 1)
  }

  // Se o envio da última resposta demorar (rede ruim), voltar não pode deixar as opções desabilitadas para sempre.
  const voltar = () => { setEnviando(false); setDirecao('voltar'); setPasso(passo - 1) }

  return (
    <main className="page-container">
      <header>
        {passo === 0
          ? <Link href="/plano" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Voltar</Link>
          : <button type="button" className={`link-muted ${estilos.voltar}`} onClick={voltar}><i className="ph-bold ph-caret-left" aria-hidden="true" /> Pergunta anterior</button>}
        <p className="eyebrow mt-18">Quiz de estilo</p>
      </header>

      <div className={estilos.progresso}>
        <span>Pergunta {passo + 1} de {PERGUNTAS.length}</span>
        <span>{pergunta.assunto}</span>
      </div>
      <div className="progress-bar" role="progressbar" aria-label="Progresso do quiz" aria-valuemin={1} aria-valuemax={PERGUNTAS.length} aria-valuenow={passo + 1}>
        <span style={{ width: `${((passo + 1) / PERGUNTAS.length) * 100}%` }} />
      </div>

      <section key={passo} className={`${estilos.pergunta} ${direcao === 'avancar' ? estilos.entraDireita : estilos.entraEsquerda}`}>
        <h1 ref={titulo} tabIndex={-1} className={estilos.titulo}>{pergunta.pergunta}</h1>
        <ul className={estilos.opcoes}>
          {pergunta.opcoes.map((o, i) => (
            <li key={o.id}>
              <button type="button" className={`surface-card ${estilos.opcao} ${respostas[passo] === i ? estilos.escolhida : ''}`} aria-pressed={respostas[passo] === i} disabled={enviando} onClick={() => escolher(i)}>
                <span className={estilos.icone} aria-hidden="true"><i className={`ph-fill ${o.icone}`} /></span>
                <span>{o.texto}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
