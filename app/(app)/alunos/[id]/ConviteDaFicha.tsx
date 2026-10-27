'use client'

import { useId, useRef, useState, useSyncExternalStore } from 'react'
import { useToast } from '@/hooks/useToast'
import { cancelarConviteNoServidor, gerarConviteNoServidor } from '@/lib/cornerman/cliente'
import { diaMes } from '@/lib/cornerman/convite'
import type { FichaDeAluno } from '@/lib/cornerman/ficha'
import { TEXTOS } from '@/lib/textos'
import estilos from './convite.module.css'

const TEXTO_DO_CONVITE = 'Convite do seu treinador no Corner'

/** O aparelho oferece o compartilhamento próprio (celular)? No servidor e na hidratação, não (evita erro de hidratação). */
const aparelhoCompartilha = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

interface Props {
  ficha: FichaDeAluno
  /** O convite ainda não usado (só a validade: o servidor não guarda o token). */
  convite: { expiraEm: string } | null
  /** Chamado depois de gerar ou cancelar: quem chama recarrega a ficha e o convite. */
  aoMudar: () => Promise<void>
}

/** Seção "Convite" da ficha: gerar o link, copiar, compartilhar, cancelar. O e-mail ainda não está disponível. */
export default function ConviteDaFicha({ ficha, convite, aoMudar }: Props) {
  const avisar = useToast()
  const idDaExplicacao = useId()
  const [link, setLink] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [agora] = useState(() => Date.now()) // quando a tela abriu: para dizer se o convite já expirou
  const emAndamento = useRef(false)
  const campo = useRef<HTMLInputElement>(null)
  const podeCompartilhar = useSyncExternalStore(() => () => {}, aparelhoCompartilha, () => false)

  if (ficha.comConta) {
    return (
      <section className={estilos.secao} aria-label="Convite">
        <p className={estilos.texto}>Vinculado a uma conta do Corner.</p>
      </section>
    )
  }

  const pendente = ficha.status === 'convidado'
  const expirado = convite !== null && Date.parse(convite.expiraEm) <= agora

  /** Um pedido de cada vez, mesmo com clique duplo (o botão desliga, e a barreira vale até o pedido terminar). */
  const executar = async (pedido: () => Promise<boolean>) => {
    if (emAndamento.current) return
    emAndamento.current = true
    setOcupado(true)
    setErro(null)
    const deuCerto = await pedido()
    emAndamento.current = false
    setOcupado(false)
    if (deuCerto) await aoMudar()
  }

  const gerar = () => void executar(async () => {
    const r = await gerarConviteNoServidor(ficha.id)
    if (!r.ok) { setErro(r.erro); return false }
    setLink(r.valor.link)
    return true
  })

  const cancelar = () => void executar(async () => {
    const r = await cancelarConviteNoServidor(ficha.id)
    if (!r.ok) { setErro(r.erro); return false }
    setLink(null)
    avisar(TEXTOS.aviso.conviteCancelado)
    return true
  })

  const copiar = async () => {
    if (link === null) return
    try {
      await navigator.clipboard.writeText(link)
      avisar(TEXTOS.aviso.linkCopiado)
    } catch {
      campo.current?.select() // sem permissão: deixa o link selecionado para copiar à mão
      avisar(TEXTOS.aviso.linkNaoCopiado)
    }
  }

  const compartilhar = async () => {
    if (link === null) return
    try {
      await navigator.share({ title: 'Convite do Corner', text: TEXTO_DO_CONVITE, url: link })
    } catch {
      // A pessoa fechou a folha de compartilhamento: nada a fazer.
    }
  }

  return (
    <section className={estilos.secao} aria-label="Convite">
      <h2 className={estilos.titulo}>Convidar para o Corner</h2>

      {pendente && (
        <p className={estilos.texto}>
          {convite === null ? 'Convite pendente' : expirado ? `Convite expirado em ${diaMes(convite.expiraEm)}` : `Convite pendente · expira em ${diaMes(convite.expiraEm)}`}
        </p>
      )}
      {!pendente && link === null && (
        <p className={estilos.texto}>Gere um link e mande para o aluno: com a conta dele no Corner, você acompanha o treino dele.</p>
      )}

      {link !== null && (
        <>
          <input ref={campo} className={`field-input ${estilos.campo}`} aria-label="Link do convite" readOnly value={link} onFocus={e => e.currentTarget.select()} />
          <div className={estilos.acoes}>
            <button type="button" className="btn-ghost" onClick={() => void copiar()}><i className="ph-bold ph-copy" aria-hidden="true" /> Copiar link</button>
            {podeCompartilhar
              ? <button type="button" className="btn-ghost" onClick={() => void compartilhar()}><i className="ph-bold ph-share-network" aria-hidden="true" /> Compartilhar</button>
              : <a className="btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(`${TEXTO_DO_CONVITE}: ${link}`)}`} target="_blank" rel="noopener noreferrer"><i className="ph-bold ph-share-network" aria-hidden="true" /> Compartilhar</a>}
            <button type="button" className="btn-ghost" disabled aria-describedby={idDaExplicacao}><i className="ph-bold ph-envelope-simple" aria-hidden="true" /> Enviar por e-mail</button>
          </div>
          <p id={idDaExplicacao} className={estilos.nota}>Envio por e-mail ainda não está disponível.</p>
          <p className={estilos.aviso}>Quem abrir este link primeiro e aceitar fica vinculado ao aluno. Mande só para ele.</p>
        </>
      )}

      <div className={estilos.acoes}>
        <button type="button" className="btn-ghost" onClick={gerar} disabled={ocupado}>
          {ocupado ? 'Gerando…' : pendente ? 'Gerar novo link' : 'Gerar link de convite'}
        </button>
        {pendente && <button type="button" className="btn-ghost" onClick={cancelar} disabled={ocupado}>Cancelar convite</button>}
      </div>
      {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
    </section>
  )
}
