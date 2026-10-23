'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cadastrar } from '@/lib/cadastro'
import type { CampoDoCadastro } from '@/lib/onboarding'
import { SESSION_COOKIE, createSession, decrypt } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { usuarioDaSessao } from '@/lib/users'

export type CadastroState = {
  /** Um texto por campo, mostrado ao lado dele. */
  erros?: Partial<Record<CampoDoCadastro, string>>
  /** Problema que não é de um campo só (e-mail já cadastrado, serviço fora do ar). */
  erro?: string
  /** O que a pessoa digitou, para não perder: a senha nunca volta. */
  nome: string
  email: string
  at: number
} | undefined

/** E-mails que não podem virar conta: o do usuário de teste do app. */
const emailsReservados = () => [process.env.AUTH_TEST_EMAIL?.trim().toLowerCase()].filter((e): e is string => !!e)

/** Tela 1 do onboarding: cria a conta no Supabase Auth, abre a sessão e segue para a escolha do nível. */
export async function criarContaAction(_anterior: CadastroState, formData: FormData): Promise<CadastroState> {
  // Quem já está logado já tem conta: não cria outra por cima da sessão atual.
  if (usuarioDaSessao(await decrypt((await cookies()).get(SESSION_COOKIE)?.value))) redirect('/hoje')

  const bruto = { nome: String(formData.get('nome') ?? ''), email: String(formData.get('email') ?? ''), senha: String(formData.get('senha') ?? '') }
  const devolver = (extra: Partial<NonNullable<CadastroState>>): CadastroState => ({ nome: bruto.nome, email: bruto.email, at: Date.now(), ...extra })

  const resultado = await cadastrar(bruto, getSupabase(), emailsReservados())
  switch (resultado.tipo) {
    case 'erros': return devolver({ erros: resultado.erros })
    case 'erro':
    case 'indisponivel': return devolver({ erro: resultado.mensagem })
    case 'criado':
      await createSession(resultado.usuario.id, { email: resultado.usuario.email, name: resultado.usuario.name })
      redirect('/onboarding/nivel')
  }
}
