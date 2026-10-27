'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ExigePlano } from '@/components/ConviteAoPlano'
import FormularioDeAluno from '@/components/FormularioDeAluno'
import FotoDePerfil from '@/components/FotoDePerfil'
import { useToast } from '@/hooks/useToast'
import {
  apagarAlunoNoServidor, atualizarAlunoNoServidor, lerAlunoNoServidor, type RespostaDaApi,
} from '@/lib/cornerman/cliente'
import { LIMITES_DA_FICHA, NOME_DO_NIVEL_DE_ALUNO, hrefDeTelefone, type DadosDaFicha, type FichaDeAluno } from '@/lib/cornerman/ficha'
import { aoTeclarNoGrupo } from '@/lib/teclado'
import { TEXTOS } from '@/lib/textos'
import ConviteDaFicha from './ConviteDaFicha'
import estilos from './ficha.module.css'

export default function FichaCliente({ id }: { id: string }) {
  return (
    <main className="page-container">
      <header>
        <Link href="/alunos" className="link-muted"><i className="ph-bold ph-caret-left" aria-hidden="true" /> Meus alunos</Link>
      </header>
      <ExigePlano recurso="gestaoDeAlunos">
        <Ficha id={id} />
      </ExigePlano>
    </main>
  )
}

type Carga = { fase: 'carregando' } | { fase: 'naoEncontrada'; mensagem: string } | { fase: 'erro'; mensagem: string } | { fase: 'pronta'; ficha: FichaDeAluno; convite: { expiraEm: string } | null }
type Aba = 'geral' | 'notas'

function Ficha({ id }: { id: string }) {
  const [carga, setCarga] = useState<Carga>({ fase: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    void lerAlunoNoServidor(id).then(r => {
      if (!ativo) return
      if (r.ok) setCarga({ fase: 'pronta', ficha: r.valor.aluno, convite: r.valor.convite })
      else setCarga(r.status === 404 ? { fase: 'naoEncontrada', mensagem: r.erro } : { fase: 'erro', mensagem: r.erro })
    })
    return () => { ativo = false }
  }, [id, tentativa])

  if (carga.fase === 'carregando') return <div className="skeleton mt-18" aria-busy="true" />

  if (carga.fase === 'naoEncontrada') {
    return (
      <div className={estilos.naoEncontrada}>
        <p role="alert">{carga.mensagem}</p>
        <Link href="/alunos" className="btn-ghost">Voltar para Meus Alunos</Link>
      </div>
    )
  }

  if (carga.fase === 'erro') {
    return (
      <div className={estilos.naoEncontrada}>
        <p role="alert">{carga.mensagem}</p>
        <button type="button" className="btn-ghost" onClick={() => { setCarga({ fase: 'carregando' }); setTentativa(n => n + 1) }}>Tentar de novo</button>
      </div>
    )
  }

  // Depois de gerar ou cancelar um convite, busca a ficha e o convite de novo, sem trocar a tela por um esqueleto.
  const recarregar = async () => {
    const r = await lerAlunoNoServidor(id)
    if (r.ok) setCarga({ fase: 'pronta', ficha: r.valor.aluno, convite: r.valor.convite })
  }

  return <FichaAberta ficha={carga.ficha} convite={carga.convite} aoMudar={ficha => setCarga({ fase: 'pronta', ficha, convite: carga.convite })} aoRecarregar={recarregar} />
}

function FichaAberta({ ficha, convite, aoMudar, aoRecarregar }: {
  ficha: FichaDeAluno
  convite: { expiraEm: string } | null
  aoMudar: (f: FichaDeAluno) => void
  aoRecarregar: () => Promise<void>
}) {
  const router = useRouter()
  const avisar = useToast()
  const [aba, setAba] = useState<Aba>('geral')
  const [editando, setEditando] = useState(false)
  const [notas, setNotas] = useState(ficha.notas)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [dadosAlterados, setDadosAlterados] = useState(false) // o formulário de "Editar dados" tem algo não salvo

  const encerrada = ficha.status === 'encerrado'
  const convidada = ficha.status === 'convidado'
  const notasAlteradas = notas !== ficha.notas

  // Notas escritas e ainda não salvas se perderiam ao recarregar ou fechar a página.
  useEffect(() => {
    if (!notasAlteradas) return
    const aviso = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [notasAlteradas])

  const trocarAba = (nova: Aba) => {
    if (nova === aba) return
    if (aba === 'notas' && notasAlteradas) {
      if (!window.confirm(TEXTOS.confirmar.descartarNotas)) return
      setNotas(ficha.notas)
    }
    if (aba === 'geral' && editando) {
      if (dadosAlterados && !window.confirm(TEXTOS.confirmar.descartarDados)) return
      setEditando(false) // sair da aba fecha o formulário: ao voltar, a visão geral
    }
    setErro(null)
    setAba(nova)
  }

  /** Um pedido de mudança: bloqueia os botões, e no fim mostra o erro ou entrega a ficha nova. */
  const mudar = async (pedido: Promise<RespostaDaApi<FichaDeAluno>>, aviso: string): Promise<boolean> => {
    setErro(null)
    setOcupado(true)
    const r = await pedido
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erro)
      return false
    }
    aoMudar(r.valor)
    setNotas(r.valor.notas)
    avisar(aviso)
    return true
  }

  const salvarNotas = () => void mudar(atualizarAlunoNoServidor(ficha.id, { notas }), TEXTOS.aviso.notasSalvas)

  const salvarDados = async (dados: DadosDaFicha) => {
    // Só o que mudou: quem edita os dados não sobrescreve, sem querer, uma nota salva de outro aparelho.
    const campos: Record<string, unknown> = {}
    for (const campo of Object.keys(dados) as (keyof DadosDaFicha)[]) {
      if (dados[campo] !== ficha[campo]) campos[campo] = dados[campo]
    }
    if (Object.keys(campos).length === 0) {
      setEditando(false)
      return
    }
    if (await mudar(atualizarAlunoNoServidor(ficha.id, campos), TEXTOS.aviso.alunoAtualizado)) setEditando(false)
  }

  const encerrar = () => {
    if (!window.confirm(ficha.comConta ? TEXTOS.confirmar.encerrarFichaComConta(ficha.nome) : TEXTOS.confirmar.encerrarFicha(ficha.nome))) return
    void mudar(atualizarAlunoNoServidor(ficha.id, { status: 'encerrado' }), TEXTOS.aviso.alunoEncerrado)
  }

  const reabrir = () => void mudar(atualizarAlunoNoServidor(ficha.id, { status: 'ativo' }), TEXTOS.aviso.alunoReaberto)

  const apagar = async () => {
    if (!window.confirm(TEXTOS.confirmar.apagarFicha(ficha.nome))) return
    setErro(null)
    setOcupado(true)
    const r = await apagarAlunoNoServidor(ficha.id)
    if (r.ok) {
      avisar(TEXTOS.aviso.alunoApagado)
      router.push('/alunos') // fica ocupado até a página trocar
      return
    }
    setOcupado(false)
    setErro(r.erro)
  }

  const telefone = ficha.telefone ? hrefDeTelefone(ficha.telefone) : null

  return (
    <>
      <div className={estilos.cabecalho}>
        <FotoDePerfil nome={ficha.nome} foto={ficha.foto} tamanhoRem={4.4} alt={ficha.nome} />
        <div>
          <h1 className="page-title">{ficha.nome}</h1>
          <p className={estilos.selo}>{encerrada ? 'Encerrada' : ficha.comConta ? 'Com conta no Corner' : convidada ? 'Convidado' : 'Ficha manual · sem dados de treino'}</p>
        </div>
      </div>

      <div className={estilos.abas} role="tablist" aria-label="Seções da ficha" onKeyDown={e => aoTeclarNoGrupo(e, 'tab')}>
        {(['geral', 'notas'] as const).map(a => (
          <button
            key={a} type="button" role="tab" id={`aba-${a}`} aria-selected={aba === a} aria-controls={`painel-${a}`} tabIndex={aba === a ? 0 : -1}
            className={aba === a ? 'ativa' : ''} onClick={() => trocarAba(a)}
          >
            {a === 'geral' ? 'Visão geral' : 'Notas'}
          </button>
        ))}
      </div>

      <div className={estilos.painel} role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === 'geral' && (editando ? (
          <FormularioDeAluno
            inicial={ficha} rotuloDoBotao="Salvar dados" aoEnviar={dados => void salvarDados(dados)} ocupado={ocupado} erro={erro}
            aoCancelar={() => { setErro(null); setEditando(false) }} aoAlterar={setDadosAlterados}
          />
        ) : (
          <>
            <dl className={`surface-card ${estilos.dados}`}>
              {ficha.nivel && <div><dt>Nível</dt><dd>{NOME_DO_NIVEL_DE_ALUNO[ficha.nivel]}</dd></div>}
              {ficha.estilo && <div><dt>Estilo</dt><dd>{ficha.estilo}</dd></div>}
              {ficha.email && <div><dt>E-mail</dt><dd><a href={`mailto:${ficha.email}`}>{ficha.email}</a></dd></div>}
              {ficha.telefone && <div><dt>Telefone</dt><dd>{telefone ? <a href={telefone}>{ficha.telefone}</a> : ficha.telefone}</dd></div>}
              {!ficha.nivel && !ficha.estilo && !ficha.email && !ficha.telefone && <div><dd className={estilos.vazio}>Nenhum dado de contato ainda.</dd></div>}
            </dl>
            <div className="section-heading"><h2>Notas</h2></div>
            <p className={`surface-card ${estilos.notasTexto} ${ficha.notas ? '' : estilos.vazio}`}>{ficha.notas || 'Sem notas ainda.'}</p>

            <ConviteDaFicha ficha={ficha} convite={convite} aoMudar={aoRecarregar} />

            <div className={estilos.acoes}>
              <button type="button" className="btn-ghost" onClick={() => { setErro(null); setEditando(true) }} disabled={ocupado}>
                <i className="ph-bold ph-pencil-simple" aria-hidden="true" /> Editar dados
              </button>
              {convidada ? null : encerrada
                ? <button type="button" className="btn-ghost" onClick={reabrir} disabled={ocupado}><i className="ph-bold ph-arrow-counter-clockwise" aria-hidden="true" /> Reabrir ficha</button>
                : <button type="button" className="btn-ghost" onClick={encerrar} disabled={ocupado}><i className="ph-bold ph-archive" aria-hidden="true" /> Encerrar ficha</button>}
              <button type="button" className={`btn-ghost ${estilos.perigo}`} onClick={() => void apagar()} disabled={ocupado}>
                <i className="ph-bold ph-trash" aria-hidden="true" /> Apagar ficha
              </button>
            </div>
            {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
          </>
        ))}

        {aba === 'notas' && (
          <div className="surface-card form-card">
            <label htmlFor="notas-da-ficha" className={estilos.rotulo}>Notas</label>
            <textarea id="notas-da-ficha" className="field-input" rows={8} value={notas} onChange={e => setNotas(e.target.value)} maxLength={LIMITES_DA_FICHA.notas} />
            <span className={estilos.contador}>{notas.length}/{LIMITES_DA_FICHA.notas}</span>
            {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
            <button type="button" className="btn-primary" onClick={salvarNotas} disabled={!notasAlteradas || ocupado}>{ocupado ? 'Salvando…' : 'Salvar notas'}</button>
          </div>
        )}
      </div>
    </>
  )
}
