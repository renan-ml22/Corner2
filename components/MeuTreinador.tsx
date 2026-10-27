'use client'

import { useEffect, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { desvincularNoServidor, meuTreinadorNoServidor } from '@/lib/cornerman/cliente'
import { TEXTOS } from '@/lib/textos'
import estilos from './MeuTreinador.module.css'

/**
 * Cartão do Perfil do ALUNO que aceitou um convite: quem é o treinador, o que ele vê e o botão para se desvincular.
 * Sem treinador (ou sem conseguir saber), não aparece nada.
 */
export default function MeuTreinador() {
  const avisar = useToast()
  const [nome, setNome] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true
    void meuTreinadorNoServidor().then(r => {
      if (ativo && r.ok) setNome(r.valor.treinador?.nome ?? null)
    })
    return () => { ativo = false }
  }, [])

  if (nome === null) return null

  const desvincular = async () => {
    if (!window.confirm(TEXTOS.confirmar.desvincular(nome))) return
    setErro(null)
    setOcupado(true)
    const r = await desvincularNoServidor()
    setOcupado(false)
    if (!r.ok) {
      setErro(r.erro)
      return
    }
    avisar(TEXTOS.aviso.desvinculado)
    setNome(null)
  }

  return (
    <section className={`surface-card ${estilos.cartao}`} aria-label="Meu treinador">
      <div className={estilos.topo}>
        <i className="ph-fill ph-users-three" aria-hidden="true" />
        <div>
          <h2>Meu treinador</h2>
          <p className={estilos.nome}>{nome}</p>
        </div>
      </div>
      <p className={estilos.texto}>Ele vê o seu nome, foto, nível, estilo, quiz, plano e os treinos dos últimos 30 dias.</p>
      {erro && <p role="alert" className={estilos.erro}>{erro}</p>}
      <button type="button" className="btn-ghost" onClick={() => void desvincular()} disabled={ocupado}>
        {ocupado ? 'Desvinculando…' : 'Desvincular'}
      </button>
    </section>
  )
}
