'use client'

import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import Segmentos from '@/components/sheets/Segmentos'
import { useToast } from '@/hooks/useToast'
import { LIMITES_DA_FICHA, NOME_DO_NIVEL_DE_ALUNO, type DadosDaFicha } from '@/lib/cornerman/ficha'
import { prepararFoto } from '@/lib/foto'
import type { Nivel } from '@/lib/onboarding'
import { TEXTOS } from '@/lib/textos'
import FotoDePerfil from './FotoDePerfil'
import estilos from './FormularioDeAluno.module.css'

const AVISO_DO_ERRO = {
  nao_e_imagem: TEXTOS.aviso.fotoNaoEImagem,
  muito_grande: TEXTOS.aviso.fotoGrande,
  ilegivel: TEXTOS.aviso.fotoIlegivel,
} as const

const OPCOES_DE_NIVEL: { id: Nivel | ''; label: string }[] = [
  { id: '', label: 'Não informado' },
  ...(Object.keys(NOME_DO_NIVEL_DE_ALUNO) as Nivel[]).map(n => ({ id: n, label: NOME_DO_NIVEL_DE_ALUNO[n] })),
]

interface Props {
  inicial?: Partial<DadosDaFicha>
  rotuloDoBotao: string
  /** Chamado com os dados já aparados (nome preenchido); quem chama grava e controla `ocupado` e `erro`. */
  aoEnviar: (dados: DadosDaFicha) => void
  ocupado: boolean
  /** Erro devolvido pelo servidor (ou de rede) para mostrar acima do botão. */
  erro: string | null
  aoCancelar?: () => void
}

/** Formulário da ficha de aluno: usado no cadastro e na edição dos dados. */
export default function FormularioDeAluno({ inicial, rotuloDoBotao, aoEnviar, ocupado, erro, aoCancelar }: Props) {
  const id = useId()
  const avisar = useToast()
  const [nome, setNome] = useState(inicial?.nome ?? '')
  const [email, setEmail] = useState(inicial?.email ?? '')
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '')
  const [nivel, setNivel] = useState<Nivel | ''>(inicial?.nivel ?? '')
  const [estilo, setEstilo] = useState(inicial?.estilo ?? '')
  const [notas, setNotas] = useState(inicial?.notas ?? '')
  const [foto, setFoto] = useState(inicial?.foto ?? '')
  const [erroLocal, setErroLocal] = useState<string | null>(null)

  // Segunda barreira contra clique duplo, além do botão desligado: vale até quem chamou terminar (`ocupado` voltar a falso).
  const enviando = useRef(false)
  useEffect(() => { if (!ocupado) enviando.current = false }, [ocupado])

  const escolherFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!arquivo) return
    const r = await prepararFoto(arquivo)
    if (r.ok) setFoto(r.foto)
    else avisar(AVISO_DO_ERRO[r.erro]) // a foto anterior continua como estava
  }

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    if (enviando.current || ocupado) return
    if (nome.trim() === '') {
      setErroLocal(TEXTOS.erro.alunoSemNome)
      return
    }
    setErroLocal(null)
    enviando.current = true
    aoEnviar({
      nome: nome.trim(),
      email: email.trim() || null,
      telefone: telefone.trim() || null,
      nivel: nivel || null,
      estilo: estilo.trim() || null,
      notas,
      foto,
    })
  }

  const mensagem = erroLocal ?? erro
  const idDoErro = `${id}-erro`

  return (
    <form className={`surface-card form-card ${estilos.formulario}`} onSubmit={enviar} noValidate>
      <div className={estilos.fotoLinha}>
        <FotoDePerfil nome={nome || 'Aluno'} foto={foto} tamanhoRem={4.4} alt="Foto do aluno" />
        <div className={estilos.fotoAcoes}>
          <label className={`btn-ghost small ${estilos.escolher}`}>
            <i className="ph-bold ph-camera" aria-hidden="true" />
            {foto ? 'Trocar foto' : 'Adicionar foto'}
            <input type="file" accept="image/*" className="sr-only" onChange={e => void escolherFoto(e)} />
          </label>
          {foto && (
            <button type="button" className="btn-ghost small" onClick={() => setFoto('')}>
              <i className="ph-bold ph-trash" aria-hidden="true" /> Remover foto
            </button>
          )}
        </div>
      </div>

      <label htmlFor={`${id}-nome`} className={estilos.rotulo}>Nome</label>
      <input
        id={`${id}-nome`} className="field-input" value={nome} onChange={e => setNome(e.target.value)} maxLength={LIMITES_DA_FICHA.nome}
        autoComplete="off" aria-required="true" aria-invalid={erroLocal !== null} aria-describedby={erroLocal ? idDoErro : undefined}
      />

      <label htmlFor={`${id}-email`} className={estilos.rotulo}>E-mail</label>
      <input id={`${id}-email`} type="email" className="field-input" value={email} onChange={e => setEmail(e.target.value)} maxLength={LIMITES_DA_FICHA.email} autoComplete="off" />

      <label htmlFor={`${id}-telefone`} className={estilos.rotulo}>Telefone</label>
      <input id={`${id}-telefone`} type="tel" className="field-input" value={telefone} onChange={e => setTelefone(e.target.value)} maxLength={LIMITES_DA_FICHA.telefone} autoComplete="off" />

      <p className={estilos.rotulo} id={`${id}-nivel`}>Nível</p>
      <Segmentos rotulo="Nível" valor={nivel} opcoes={OPCOES_DE_NIVEL} onChange={setNivel} />

      <label htmlFor={`${id}-estilo`} className={estilos.rotulo}>Estilo</label>
      <input id={`${id}-estilo`} className="field-input" value={estilo} onChange={e => setEstilo(e.target.value)} maxLength={LIMITES_DA_FICHA.estilo} placeholder="Ex.: out-boxer, pressão" autoComplete="off" />

      <label htmlFor={`${id}-notas`} className={estilos.rotulo}>Notas</label>
      <textarea id={`${id}-notas`} className="field-input" rows={5} value={notas} onChange={e => setNotas(e.target.value)} maxLength={LIMITES_DA_FICHA.notas} />
      <span className={estilos.contador}>{notas.length}/{LIMITES_DA_FICHA.notas}</span>

      {mensagem && <p role="alert" id={idDoErro} className={estilos.erro}>{mensagem}</p>}

      <div className={estilos.botoes}>
        <button type="submit" className="btn-primary" disabled={ocupado}>{ocupado ? 'Salvando…' : rotuloDoBotao}</button>
        {aoCancelar && <button type="button" className="btn-ghost" onClick={aoCancelar} disabled={ocupado}>Cancelar</button>}
      </div>
    </form>
  )
}
