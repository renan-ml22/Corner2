import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import { erro, prepararRota } from '@/lib/assinatura/rota'
import type { UsuarioDoApp } from '@/lib/assinatura/servico'
import { decrypt, SESSION_COOKIE } from '@/lib/session'
import { getSupabase } from '@/lib/supabase'
import { usuarioDaSessao } from '@/lib/users'
import { COOKIE_DO_CONVITE, VALIDADE_DO_COOKIE_SEGUNDOS } from './convite'

export const semBanco = () => erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

/**
 * Checagens comuns das rotas do aluno, nesta ordem: origem do pedido que muda algo (403), sessão (401) e banco
 * configurado (503). Não exige plano nenhum: qualquer pessoa logada pode aceitar um convite e se desvincular.
 */
export async function prepararRotaDoAluno(
  request: Request,
  { mutavel }: { mutavel: boolean },
): Promise<{ ok: true; usuario: UsuarioDoApp; db: SupabaseClient } | { ok: false; resposta: Response }> {
  const preparo = await prepararRota(request, { mutavel })
  if (!preparo.ok) return preparo
  const db = getSupabase()
  if (!db) return { ok: false, resposta: semBanco() }
  return { ok: true, usuario: preparo.usuario, db }
}

/** Quem está logado neste pedido, sem exigir nada (para as rotas públicas que só querem saber). */
export async function usuarioLogado(): Promise<UsuarioDoApp | null> {
  return usuarioDaSessao(await decrypt((await cookies()).get(SESSION_COOKIE)?.value))
}

/** Grava o cookie que leva o token do convite pelo login ou cadastro: HttpOnly, 1 hora, só para convite válido. */
export async function guardarCookieDoConvite(token: string): Promise<void> {
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0].trim()
  ;(await cookies()).set(COOKIE_DO_CONVITE, token, {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    path: '/',
    maxAge: VALIDADE_DO_COOKIE_SEGUNDOS,
  })
}

export async function apagarCookieDoConvite(): Promise<void> {
  ;(await cookies()).delete(COOKIE_DO_CONVITE)
}
