'use client'

import { useEffect, useState } from 'react'
import FotoDePerfil from '@/components/FotoDePerfil'
import type { DadosDoAluno } from '@/lib/cornerman/aluno-dados'
import { dadosDoAlunoNoServidor } from '@/lib/cornerman/cliente'
import { NOME_DO_NIVEL_DE_ALUNO } from '@/lib/cornerman/ficha'
import { filtrarTreinos, resumoDosTreinos, treinosPorSemana, type FiltroDeTipo } from '@/lib/cornerman/treinos-do-aluno'
import { formatarDataCurta } from '@/lib/datas'
import { CAT_ICONS, CAT_LABELS, TIPOS } from '@/lib/tipos'
import estilos from './treinos.module.css'

type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronta'; dados: DadosDoAluno }

const FILTROS: { valor: FiltroDeTipo; rotulo: string }[] = [{ valor: 'todos', rotulo: 'Todos' }, ...TIPOS.map(t => ({ valor: t, rotulo: CAT_LABELS[t] }))]

const numero = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`

/** O que o treinador vê do aluno com conta: perfil resumido, os números dos últimos 30 dias, o gráfico por semana e cada treino. */
export default function TreinosDoAluno({ id, nome }: { id: string; nome: string }) {
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [filtro, setFiltro] = useState<FiltroDeTipo>('todos')
  const [hoje] = useState(() => new Date())

  useEffect(() => {
    let ativo = true
    void dadosDoAlunoNoServidor(id).then(r => {
      if (ativo) setCarga(r.ok ? { fase: 'pronta', dados: r.valor } : { fase: 'erro', mensagem: r.erro })
    })
    return () => { ativo = false }
  }, [id, tentativa])

  if (carga.fase === 'carregando') return <div className="skeleton" aria-busy="true" />

  if (carga.fase === 'erro') {
    return (
      <div>
        <p role="alert" className={estilos.erro}>{carga.mensagem}</p>
        <button type="button" className="btn-ghost" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa(n => n + 1) }}>Tentar de novo</button>
      </div>
    )
  }

  const { dados } = carga
  const resumo = resumoDosTreinos(dados.treinos, filtro)
  const semanas = treinosPorSemana(dados.treinos, hoje, filtro)
  const maior = Math.max(1, ...semanas.map(s => s.total))
  const lista = filtrarTreinos(dados.treinos, filtro)

  return (
    <>
      <dl className={`surface-card ${estilos.perfil}`}>
        {dados.foto && <div className={estilos.foto}><FotoDePerfil nome={nome} foto={dados.foto} tamanhoRem={3.4} alt={`Foto da conta de ${nome}`} /></div>}
        {dados.nivel && <div><dt>Nível</dt><dd>{NOME_DO_NIVEL_DE_ALUNO[dados.nivel]}</dd></div>}
        <div>
          <dt>Atleta compatível</dt>
          {dados.estilo
            ? <dd><strong>{dados.estilo.nome}</strong><small>{dados.estilo.estilo} · {dados.estilo.percentual}% de compatibilidade</small></dd>
            : <dd className={estilos.vazio}>Ainda não fez o quiz de estilo.</dd>}
        </div>
        <div>
          <dt>Plano</dt>
          {dados.plano
            ? <dd><strong>{dados.plano.nome}</strong><small>Semana {dados.plano.semana} de {dados.plano.semanas}</small></dd>
            : <dd className={estilos.vazio}>Sem plano ativo.</dd>}
        </div>
      </dl>

      <div className="section-heading"><h2>Últimos 30 dias</h2></div>

      {dados.treinos.length > 0 && (
        <div className={estilos.filtros} role="group" aria-label="Filtrar por tipo de treino">
          {FILTROS.map(f => (
            <button key={f.valor} type="button" className="chip" aria-pressed={filtro === f.valor} onClick={() => setFiltro(f.valor)}>{f.rotulo}</button>
          ))}
        </div>
      )}

      <dl className={estilos.resumo}>
        <div className="surface-card"><dt>Treinos</dt><dd>{resumo.total}</dd></div>
        <div className="surface-card"><dt>Minutos</dt><dd>{resumo.minutos}</dd></div>
        <div className="surface-card"><dt>Esforço médio</dt><dd>{resumo.rpeMedio === null ? '—' : numero(resumo.rpeMedio)}</dd></div>
      </dl>

      {dados.treinos.length === 0 ? (
        <p className={`${estilos.vazio} ${estilos.semTreinos}`}>Nenhum treino nos últimos 30 dias.</p>
      ) : (
        <>
          <section className={`surface-card ${estilos.grafico}`}>
            <h3>Treinos por semana</h3>
            <ul aria-label="Treinos por semana" className={estilos.barras}>
              {semanas.map(s => (
                <li key={s.inicio}>
                  <span className={estilos.valor} aria-hidden="true">{s.total}</span>
                  <span className={estilos.trilho} aria-hidden="true">
                    <span className={`${estilos.barra} ${s.total === 0 ? estilos.zero : ''}`} style={{ height: `${(s.total / maior) * 100}%` }} />
                  </span>
                  <span className={estilos.semana} aria-hidden="true">{s.rotulo}</span>
                  <span className="sr-only">Semana de {s.rotulo}: {plural(s.total, 'treino', 'treinos')}</span>
                </li>
              ))}
            </ul>
            <p className={estilos.nota}>Semanas de segunda a domingo.</p>
          </section>

          {lista.length === 0 ? (
            <p className={`${estilos.vazio} ${estilos.semTreinos}`}>Nenhum treino deste tipo nos últimos 30 dias.</p>
          ) : (
            <ul aria-label="Lista de treinos" className={estilos.treinos}>
              {lista.map(t => (
                <li key={t.data} className="surface-card">
                  <i className={`ph-bold ${CAT_ICONS[t.tipo]}`} aria-hidden="true" />
                  <span className={estilos.textos}>
                    <strong>{CAT_LABELS[t.tipo]}</strong>
                    <small>{formatarDataCurta(new Date(t.data))} · {plural(t.rounds, 'round', 'rounds')} × {numero(t.minPorRound)} min</small>
                  </span>
                  <span className={estilos.esforco}>Esforço {numero(t.rpe)}/10</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
