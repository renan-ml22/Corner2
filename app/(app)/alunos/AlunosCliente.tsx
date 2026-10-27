'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import FotoDePerfil from '@/components/FotoDePerfil'
import { ExigePlano } from '@/components/ConviteAoPlano'
import { listarAlunosNoServidor, type ListaDeAlunos } from '@/lib/cornerman/cliente'
import { NOME_DO_NIVEL_DE_ALUNO, type FichaDeAluno } from '@/lib/cornerman/ficha'
import estilos from './alunos.module.css'

export default function AlunosCliente() {
  return (
    <main className="page-container">
      <header>
        <p className="eyebrow">Treinador</p>
        <h1 className="page-title">Meus Alunos</h1>
      </header>
      <ExigePlano recurso="gestaoDeAlunos">
        <ListaDeAlunos />
      </ExigePlano>
    </main>
  )
}

type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronta'; dados: ListaDeAlunos }

function ListaDeAlunos() {
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [verEncerrados, setVerEncerrados] = useState(false)

  useEffect(() => {
    let ativo = true
    void listarAlunosNoServidor().then(r => {
      if (!ativo) return
      setCarga(r.ok ? { fase: 'pronta', dados: r.valor } : { fase: 'erro', mensagem: r.erro })
    })
    return () => { ativo = false }
  }, [tentativa])

  if (carga.fase === 'carregando') return <div className="skeleton mt-18" aria-busy="true" />

  if (carga.fase === 'erro') {
    return (
      <div className={estilos.aviso}>
        <p role="alert">{carga.mensagem}</p>
        <button type="button" className="btn-ghost" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa(n => n + 1) }}>Tentar de novo</button>
      </div>
    )
  }

  const { alunos, ativos, limite } = carga.dados
  const ativas = alunos.filter(a => a.status !== 'encerrado')
  const encerradas = alunos.filter(a => a.status === 'encerrado')
  const noLimite = ativos >= limite

  return (
    <>
      <div className={`${estilos.topo} mt-18`}>
        <p className={estilos.contador} aria-live="polite">{ativos} de {limite} alunos</p>
        {noLimite
          ? <button type="button" className={`btn-primary ${estilos.novo}`} disabled>Novo aluno</button>
          : <Link href="/alunos/novo" className={`btn-primary ${estilos.novo}`}><i className="ph-bold ph-plus" aria-hidden="true" /> Novo aluno</Link>}
      </div>
      {noLimite && <p className={estilos.limite}>Você chegou ao limite de {limite} alunos. Encerre ou apague uma ficha para cadastrar outro.</p>}

      {alunos.length === 0 && (
        <div className="empty-state">
          <i className="ph-fill ph-users-three" aria-hidden="true" />
          <h2>Você ainda não cadastrou nenhum aluno.</h2>
          <p>Cadastre quem você treina para guardar os dados e as notas de cada um.</p>
        </div>
      )}

      {ativas.length > 0 && (
        <ul className={estilos.lista} aria-label="Alunos">
          {ativas.map(a => <Cartao key={a.id} aluno={a} />)}
        </ul>
      )}

      {encerradas.length > 0 && (
        <section className={estilos.encerrados}>
          <button type="button" className={estilos.alternar} aria-expanded={verEncerrados} onClick={() => setVerEncerrados(v => !v)}>
            <i className={`ph-bold ${verEncerrados ? 'ph-caret-down' : 'ph-caret-right'}`} aria-hidden="true" /> Encerrados ({encerradas.length})
          </button>
          {verEncerrados && (
            <ul className={estilos.lista} aria-label="Fichas encerradas">
              {encerradas.map(a => <Cartao key={a.id} aluno={a} encerrada />)}
            </ul>
          )}
        </section>
      )}
    </>
  )
}

function Cartao({ aluno, encerrada = false }: { aluno: FichaDeAluno; encerrada?: boolean }) {
  const detalhe = [aluno.nivel ? NOME_DO_NIVEL_DE_ALUNO[aluno.nivel] : null, aluno.estilo].filter(Boolean).join(' · ')
  return (
    <li className={`surface-card ${estilos.cartao} ${encerrada ? estilos.encerrada : ''}`}>
      <Link href={`/alunos/${aluno.id}`} className={estilos.cartaoLink}>
        {/* A foto é decorativa aqui: o nome do aluno está escrito ao lado. */}
        <FotoDePerfil nome={aluno.nome} foto={aluno.foto} tamanhoRem={3} alt="" />
        <span className={estilos.textos}>
          <strong>{aluno.nome}</strong>
          {detalhe && <small>{detalhe}</small>}
        </span>
        <span className={estilos.selo}>{encerrada ? 'Encerrada' : aluno.comConta ? 'Com conta' : aluno.status === 'convidado' ? 'Convidado' : 'Ficha manual'}</span>
        <i className={`ph-bold ph-caret-right ${estilos.seta}`} aria-hidden="true" />
      </Link>
    </li>
  )
}
