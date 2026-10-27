'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import CornerLogo from '@/components/CornerLogo'
import login from '@/app/(auth)/login/login.module.css'
import {
  aceitarConviteNoServidor, consultarConviteNoServidor, esquecerConviteNoServidor, guardarConviteNoServidor, type ConsultaDoConvite,
} from '@/lib/cornerman/cliente'
import { ehTokenDeConvite } from '@/lib/cornerman/convite'
import estilos from './aceite.module.css'

type Fase =
  | { tipo: 'carregando' }
  | { tipo: 'invalido' }
  | { tipo: 'erro'; mensagem: string }
  | { tipo: 'valido'; consulta: ConsultaDoConvite & { treinador: string } }
  | { tipo: 'aceito'; treinador: string }

const PODE_VER = [
  'Seu nome, foto, nível e estilo',
  'O resultado do quiz de estilo',
  'Seu plano de treino ativo',
  'Seus treinos dos últimos 30 dias: data, tipo, rounds, esforço e duração',
]
const NUNCA_VE = ['Lesões', 'Peso e categoria', 'Check-ins diários', 'Pancadas na cabeça (sparring)']

/** Página pública do convite: o aluno vê quem o convidou, o que será compartilhado e aceita (ou entra antes). */
export default function ConviteCliente({ token }: { token: string }) {
  const [fase, setFase] = useState<Fase>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let ativo = true
    const invalido = () => {
      // Um convite que não vale mais não pode deixar o cookie velho levando o aluno de volta para cá a cada /hoje.
      void esquecerConviteNoServidor(token)
      setFase({ tipo: 'invalido' })
    }
    if (!ehTokenDeConvite(token)) {
      invalido()
      return
    }
    void consultarConviteNoServidor(token).then(r => {
      if (!ativo) return
      if (!r.ok) setFase({ tipo: 'erro', mensagem: r.erro })
      else if (!r.valor.valido) invalido()
      else setFase({ tipo: 'valido', consulta: { ...r.valor, treinador: r.valor.treinador ?? 'Seu treinador' } })
    })
    return () => { ativo = false }
  }, [token, tentativa])

  return (
    <main className={login.page}>
      <div className={login.backdrop} aria-hidden="true">
        <span className={`${login.blob} ${login.blobRed}`} />
        <span className={`${login.blob} ${login.blobBlue}`} />
        <svg className={login.ropes} viewBox="0 0 400 400" preserveAspectRatio="xMaxYMax slice">
          <path d="M400 120 H120 V400" />
          <path d="M400 160 H160 V400" />
          <path d="M400 200 H200 V400" />
        </svg>
        <span className={login.grain} />
      </div>

      <div className={login.shell}>
        <section className={login.brand}>
          <CornerLogo size={112} animated />
          <h2 className={login.wordmark}>Corner</h2>
          <p className={login.tagline}>Seu treino de boxe, planejado entre um round e outro.</p>
        </section>

        <section className={login.card} aria-labelledby="convite-titulo" aria-busy={fase.tipo === 'carregando'}>
          {fase.tipo === 'carregando' && <p className={login.subtitle} role="status">Abrindo o convite…</p>}
          {fase.tipo === 'erro' && (
            <>
              <h1 id="convite-titulo" className={login.title}>Não foi possível abrir o convite</h1>
              <p role="alert" className={login.error}>{fase.mensagem}</p>
              <button type="button" className={estilos.secundario} onClick={() => { setFase({ tipo: 'carregando' }); setTentativa(n => n + 1) }}>Tentar de novo</button>
            </>
          )}
          {fase.tipo === 'invalido' && (
            <>
              <h1 id="convite-titulo" className={login.title}>Convite inválido ou expirado.</h1>
              <p className={login.subtitle}>Peça um link novo ao seu treinador.</p>
              <Link href="/hoje" className={estilos.secundario}>Ir para o Corner</Link>
            </>
          )}
          {fase.tipo === 'aceito' && (
            <>
              <h1 id="convite-titulo" className={login.title}>Pronto! Você agora treina com {fase.treinador}.</h1>
              <p className={login.subtitle}>Você pode se desvincular quando quiser, em Perfil › Meu treinador.</p>
              <Link href="/hoje" className={login.submit}>Ir para o Corner <i className="ph-bold ph-arrow-right" aria-hidden="true" /></Link>
            </>
          )}
          {fase.tipo === 'valido' && <ConviteValido token={token} consulta={fase.consulta} aoAceitar={treinador => setFase({ tipo: 'aceito', treinador })} />}
        </section>
      </div>
    </main>
  )
}

function Lista({ titulo, itens, icone }: { titulo: string; itens: string[]; icone: string }): ReactNode {
  return (
    <section aria-label={titulo} className={estilos.bloco}>
      <h2 className={estilos.subtitulo}>{titulo}</h2>
      <ul className={estilos.lista}>
        {itens.map(item => <li key={item}><i className={`ph-bold ${icone}`} aria-hidden="true" /> {item}</li>)}
      </ul>
    </section>
  )
}

function ConviteValido({ token, consulta, aoAceitar }: { token: string; consulta: ConsultaDoConvite & { treinador: string }; aoAceitar: (treinador: string) => void }) {
  const router = useRouter()
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<{ texto: string; codigo: string } | null>(null)
  const emAndamento = useRef(false)

  /** Um pedido de cada vez (clique duplo não repete), e a barreira solta quando o pedido termina. */
  const executar = async (pedido: () => Promise<{ ok: true; seguir: () => void } | { ok: false; texto: string; codigo: string }>) => {
    if (emAndamento.current) return
    emAndamento.current = true
    setOcupado(true)
    setErro(null)
    const r = await pedido()
    if (r.ok) { r.seguir(); return } // a página muda (ou o estado muda): fica ocupado até lá
    emAndamento.current = false
    setOcupado(false)
    setErro({ texto: r.texto, codigo: r.codigo })
  }

  const aceitar = () => void executar(async () => {
    const r = await aceitarConviteNoServidor(token)
    return r.ok ? { ok: true, seguir: () => aoAceitar(r.valor.treinador) } : { ok: false, texto: r.erro, codigo: r.codigo }
  })

  /** Quem ainda não entrou: guarda o convite (cookie) e vai para o login ou o cadastro; depois do login, volta para cá. */
  const entrarOuCriar = (destino: '/login' | '/onboarding') => void executar(async () => {
    const r = await guardarConviteNoServidor(token)
    return r.ok ? { ok: true, seguir: () => router.push(destino) } : { ok: false, texto: r.erro, codigo: r.codigo }
  })

  const agoraNao = () => void executar(async () => {
    await esquecerConviteNoServidor(token)
    return { ok: true, seguir: () => router.push('/hoje') }
  })

  return (
    <>
      <h1 id="convite-titulo" className={login.title}>{consulta.treinador} convidou você para treinar junto no Corner</h1>
      <p className={login.subtitle}>{consulta.logado ? 'Aceite para o seu treinador acompanhar o seu treino.' : 'Para aceitar, entre na sua conta ou crie uma. Leva menos de um minuto.'}</p>

      <Lista titulo="O que o treinador poderá ver" itens={PODE_VER} icone="ph-check-circle" />
      <Lista titulo="O que ele nunca verá" itens={NUNCA_VE} icone="ph-prohibit" />
      <p className={estilos.nota}>Você pode se desvincular quando quiser, em Perfil › Meu treinador.</p>

      {erro && (
        <div role="alert" className={login.error}>
          <p>{erro.texto}</p>
          {erro.codigo === 'ja_tem_treinador' && <p><Link href="/perfil" className={login.link}>Ir para o Perfil</Link></p>}
        </div>
      )}

      <div className={estilos.acoes}>
        {consulta.logado ? (
          <>
            <button type="button" className={login.submit} onClick={aceitar} disabled={ocupado} aria-busy={ocupado}>{ocupado ? 'Aceitando…' : 'Aceitar convite'}</button>
            <button type="button" className={estilos.secundario} onClick={agoraNao} disabled={ocupado}>Agora não</button>
          </>
        ) : (
          <>
            <button type="button" className={login.submit} onClick={() => entrarOuCriar('/login')} disabled={ocupado}>Entrar</button>
            <button type="button" className={estilos.secundario} onClick={() => entrarOuCriar('/onboarding')} disabled={ocupado}>Criar conta</button>
          </>
        )}
      </div>
    </>
  )
}
