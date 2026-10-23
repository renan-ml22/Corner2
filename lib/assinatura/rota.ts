import 'server-only'
import { cookies } from 'next/headers'
import { decrypt, SESSION_COOKIE } from '@/lib/session'
import { usuarioDaSessao } from '@/lib/users'
import { origemDoSite, origemPermitida } from './http'
import { ErroAssinatura, type UsuarioDoApp } from './servico'

const SEM_CACHE = { 'Cache-Control': 'no-store' }

export function responder(corpo: unknown, status = 200): Response {
  return Response.json(corpo, { status, headers: SEM_CACHE })
}

export const erro = (codigo: string, mensagem: string, status: number) => responder({ erro: mensagem, codigo }, status)

export const pagamentoIndisponivel = () =>
  erro('nao_configurado', 'O pagamento ainda não está disponível neste ambiente.', 503)

/**
 * Checagens comuns das rotas de assinatura, nesta ordem:
 * 1. pedido que muda algo (POST) só vale se veio do próprio site (403);
 * 2. precisa haver um usuário logado (401). As rotas de /api ficam fora do proxy.ts, então conferem aqui.
 */
export async function prepararRota(request: Request, { mutavel }: { mutavel: boolean }): Promise<{ ok: true; usuario: UsuarioDoApp; origem: string } | { ok: false; resposta: Response }> {
  if (mutavel && !origemPermitida(request)) return { ok: false, resposta: erro('origem_invalida', 'Pedido recusado.', 403) }

  const sessao = await decrypt((await cookies()).get(SESSION_COOKIE)?.value)
  const usuario = usuarioDaSessao(sessao)
  if (!usuario) return { ok: false, resposta: erro('nao_autenticado', 'Entre na sua conta para continuar.', 401) }

  return { ok: true, usuario, origem: origemDoSite(request) }
}

/** Transforma um erro em resposta. Erros conhecidos têm texto próprio; os demais viram uma mensagem genérica. */
export function tratarErro(e: unknown): Response {
  if (e instanceof ErroAssinatura) return erro(e.codigo, e.message, e.status)
  // Registra só o tipo e a mensagem do erro (o Stripe não coloca a chave nelas); nunca o objeto inteiro.
  const resumo = e instanceof Error ? `${e.name}: ${e.message}` : 'erro desconhecido'
  console.error(`[assinatura] falha ao falar com o Stripe: ${resumo}`)
  return erro('falha_no_pagamento', 'Não foi possível falar com o serviço de pagamento agora. Tente novamente em instantes.', 502)
}
