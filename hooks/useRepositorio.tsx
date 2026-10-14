'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { criarRepositorioLocal } from '@/lib/dados/repositorio-local'
import type { Repositorio } from '@/lib/dados/repositorio'

export interface UsuarioApp { id: string; nome: string }

interface Valor { repo: Repositorio; usuario: UsuarioApp }

const RepositorioContext = createContext<Valor | null>(null)

/** Cria o repositório do usuário logado e o oferece a todos os hooks de dados. */
export function RepositorioProvider({ usuario, children }: { usuario: UsuarioApp; children: ReactNode }) {
  const repo = useMemo(() => criarRepositorioLocal({ usuarioId: usuario.id }), [usuario.id])
  const valor = useMemo(() => ({ repo, usuario: { id: usuario.id, nome: usuario.nome } }), [repo, usuario.id, usuario.nome])
  return <RepositorioContext.Provider value={valor}>{children}</RepositorioContext.Provider>
}

function useValor(): Valor {
  const v = useContext(RepositorioContext)
  if (!v) throw new Error('Hooks de dados precisam estar dentro do CornerProvider')
  return v
}

export const useRepositorio = (): Repositorio => useValor().repo
export const useUsuario = (): UsuarioApp => useValor().usuario
