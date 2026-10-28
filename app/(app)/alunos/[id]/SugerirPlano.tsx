'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { historicoDeSugestoesNoServidor, sugerirPlanoNoServidor } from '@/lib/cornerman/cliente'
import type { FichaDeAluno } from '@/lib/cornerman/ficha'
import { LIMITE_DA_MENSAGEM, planosSugeriveis, rotuloDoStatusDaSugestao, type SugestaoDaFicha } from '@/lib/cornerman/sugestao'
import { formatarDataCurta } from '@/lib/datas'
import { TEXTOS } from '@/lib/textos'
import estilos from './sugestao.module.css'

type Carga = { fase: 'carregando' } | { fase: 'erro'; mensagem: string } | { fase: 'pronta'; sugestoes: SugestaoDaFicha[] }

const PLANOS = planosSugeriveis()
const PLANOS_DE_TREINO = PLANOS.filter(p => !p.id.startsWith('atleta-'))
const TREINOS_DE_ATLETAS = PLANOS.filter(p => p.id.startsWith('atleta-'))

/** Aba "Plano sugerido" da ficha: escolher um plano e mandar ao aluno, e o histórico do que já foi sugerido. */
export default function SugerirPlano({ ficha }: { ficha: FichaDeAluno }) {
  const avisar = useToast()
  const idDoCampo = useId()
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)
  const [planoId, setPlanoId] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const emAndamento = useRef(false)

  useEffect(() => {
    let ativo = true
    void historicoDeSugestoesNoServidor(ficha.id).then(r => {
      if (ativo) setCarga(r.ok ? { fase: 'pronta', sugestoes: r.valor } : { fase: 'erro', mensagem: r.erro })
    })
    return () => { ativo = false }
  }, [ficha.id, tentativa])

  const vinculada = ficha.comConta && ficha.status === 'ativo'
  const encerrada = ficha.status === 'encerrado'
  const pendente = carga.fase === 'pronta' ? carga.sugestoes.find(s => s.status === 'pendente') : undefined

  const enviar = async () => {
    // Um pedido de cada vez, mesmo com clique duplo: o botão desliga, e a barreira vale até o pedido terminar.
    if (emAndamento.current || planoId === '') return
    emAndamento.current = true
    setOcupado(true)
    setErro(null)
    const r = await sugerirPlanoNoServidor(ficha.id, { planoId, mensagem })
    emAndamento.current = false
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    avisar(r.valor.status === 'pendente' ? TEXTOS.aviso.sugestaoEnviada : TEXTOS.aviso.sugestaoRegistrada)
    setCarga({ fase: 'pronta', sugestoes: r.valor.sugestoes })
    setPlanoId('')
    setMensagem('')
  }

  return (
    <>
      {encerrada ? (
        <p className={`surface-card ${estilos.aviso}`}>Esta ficha está encerrada. Reabra a ficha, na Visão geral, para sugerir um plano.</p>
      ) : (
        <form className={`surface-card form-card ${estilos.formulario}`} onSubmit={e => { e.preventDefault(); void enviar() }}>
          <p className={estilos.explicacao}>
            {vinculada
              ? `${ficha.nome} vê um aviso na tela Hoje e escolhe se aceita. Só existe uma sugestão por vez: enviar outra substitui a que está esperando.`
              : `${ficha.nome} ainda não tem conta no Corner, então a sugestão fica só registrada no histórico desta ficha.`}
          </p>

          <label htmlFor={`${idDoCampo}-plano`} className={estilos.rotulo}>Plano</label>
          <select id={`${idDoCampo}-plano`} className="field-input" value={planoId} onChange={e => setPlanoId(e.target.value)}>
            <option value="">Escolha um plano</option>
            <optgroup label="Planos de treino">
              {PLANOS_DE_TREINO.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </optgroup>
            <optgroup label="Treinos no estilo de atletas">
              {TREINOS_DE_ATLETAS.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </optgroup>
          </select>

          <label htmlFor={`${idDoCampo}-mensagem`} className={estilos.rotulo}>Mensagem (opcional)</label>
          <textarea
            id={`${idDoCampo}-mensagem`} className="field-input" rows={4} value={mensagem}
            onChange={e => setMensagem(e.target.value)} maxLength={LIMITE_DA_MENSAGEM}
            placeholder="Ex.: Comece por este plano e me conte como foi a primeira semana."
          />
          <span className={estilos.contador}>{mensagem.length}/{LIMITE_DA_MENSAGEM}</span>

          {pendente && vinculada && <p className={estilos.aviso}>Já há uma sugestão esperando resposta ({pendente.planoNome}). Enviar esta a substitui.</p>}
          {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
          <button type="submit" className="btn-primary" disabled={planoId === '' || ocupado}>
            {ocupado ? 'Enviando…' : vinculada ? 'Enviar sugestão' : 'Registrar sugestão'}
          </button>
        </form>
      )}

      <div className="section-heading"><h2>Histórico</h2></div>
      {carga.fase === 'carregando' && <div className="skeleton" aria-busy="true"><span className="sr-only">Carregando as sugestões…</span></div>}
      {carga.fase === 'erro' && (
        <div>
          <p role="alert" className={estilos.erro}>{carga.mensagem}</p>
          <button type="button" className="btn-ghost" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa(n => n + 1) }}>Tentar de novo</button>
        </div>
      )}
      {carga.fase === 'pronta' && (carga.sugestoes.length === 0
        ? <p className={estilos.vazio}>Nenhuma sugestão ainda.</p>
        : (
          <ul aria-label="Histórico de sugestões" className={estilos.historico}>
            {carga.sugestoes.map(s => (
              <li key={s.id} className="surface-card">
                <div className={estilos.linha}>
                  <strong>{s.planoNome}</strong>
                  <span className={`${estilos.status} ${estilos[s.status] ?? ''}`}>{rotuloDoStatusDaSugestao(s.status)}</span>
                </div>
                <small>
                  Enviada em {formatarDataCurta(new Date(s.criadaEm))}
                  {s.respondidaEm && (s.status === 'aceita' || s.status === 'recusada') ? ` · respondida em ${formatarDataCurta(new Date(s.respondidaEm))}` : ''}
                </small>
                {s.mensagem && <p className={estilos.mensagem}>{s.mensagem}</p>}
              </li>
            ))}
          </ul>
        ))}
    </>
  )
}
