'use client'

import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { criarRepositorioLocal } from '@/lib/dados/repositorio-local'
import { criarRemotoHttp } from '@/lib/dados/remoto-http'
import { criarRepositorioSincronizado, type RepositorioSincronizado } from '@/lib/dados/repositorio-sincronizado'
import type { Repositorio } from '@/lib/dados/repositorio'

export interface UsuarioApp { id: string; nome: string }

interface Valor { repo: RepositorioSincronizado; usuario: UsuarioApp }

const RepositorioContext = createContext<Valor | null>(null)

/**
 * Cria o repositório do usuário logado e o oferece a todos os hooks de dados.
 *
 * O repositório guarda no aparelho e, quando a conta na nuvem está ligada, sincroniza com ela em segundo plano.
 * Sem conta na nuvem (servidor sem Supabase), ele se comporta exatamente como o repositório do aparelho.
 */
export function RepositorioProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  const repo = useMemo(
    () => criarRepositorioSincronizado({ usuarioId: usuario.id, local: criarRepositorioLocal({ usuarioId: usuario.id }), remoto: criarRemotoHttp() }),
    [usuario.id],
  )
  const valor = useMemo(() => ({ repo, usuario: { id: usuario.id, nome: usuario.nome } }), [repo, usuario.id, usuario.nome])

  useEffect(() => {
    void repo.iniciar()
    const reenviar = () => void repo.reenviarAgora()
    // Ao esconder a aba (trocar de app, fechar), envia o que estiver pendente de um jeito que termina mesmo sem a aba.
    const aoMudarDeAba = () => { if (document.visibilityState === 'hidden') void repo.reenviarAgora({ aoFechar: true }); else reenviar() }
    window.addEventListener('online', reenviar)
    document.addEventListener('visibilitychange', aoMudarDeAba)
    return () => {
      window.removeEventListener('online', reenviar)
      document.removeEventListener('visibilitychange', aoMudarDeAba)
      repo.parar()
    }
  }, [repo])

  return <RepositorioContext.Provider value={valor}>{children}</RepositorioContext.Provider>
}

function useValor(): Valor {
  const v = useContext(RepositorioContext)
  if (!v) throw new Error('Hooks de dados precisam estar dentro do CornerProvider')
  return v
}

export const useRepositorio = (): Repositorio => useValor().repo
export const useRepositorioSincronizado = (): RepositorioSincronizado => useValor().repo
export const useUsuario = (): UsuarioApp => useValor().usuario
