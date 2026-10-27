import 'server-only'
import { podeUsar } from '@/lib/assinatura/regras'
import { erro, prepararRota } from '@/lib/assinatura/rota'
import { estadoNoServidor, type EstadoNoServidor } from '@/lib/assinatura/estado-servidor'
import type { UsuarioDoApp } from '@/lib/assinatura/servico'

/**
 * Quem pode usar a área do treinador: plano Cornerman ou Profissional (a ordem dos níveis já inclui o segundo).
 * Com o pagamento desligado no ambiente (sem chave do Stripe) o app inteiro fica liberado, e esta área também.
 */
export function treinadorPodeGerir(e: EstadoNoServidor, agora: Date = new Date()): boolean {
  if (!e.pagamentoAtivo) return true
  return podeUsar('gestaoDeAlunos', e.estado, agora)
}

/**
 * Checagens comuns das rotas do treinador, nesta ordem:
 * 1. as de toda rota (`prepararRota`): origem do pedido que muda algo (403) e sessão (401);
 * 2. o plano, conferido AQUI no servidor em toda rota, inclusive nas de leitura: sem Cornerman ou Profissional, 403;
 *    se o Stripe não responder, 502 (sem como saber o plano, não libera).
 * O estado vem do cookie assinado de 5 minutos: depois de cancelar, o acesso pode durar até 5 minutos.
 */
export async function prepararRotaDoTreinador(
  request: Request,
  { mutavel }: { mutavel: boolean },
): Promise<{ ok: true; usuario: UsuarioDoApp } | { ok: false; resposta: Response }> {
  const preparo = await prepararRota(request, { mutavel })
  if (!preparo.ok) return preparo

  let estado: EstadoNoServidor
  try {
    estado = await estadoNoServidor(preparo.usuario, { forcar: false })
  } catch {
    // Nada do erro vai para a resposta nem para o registro: pode trazer detalhes do Stripe.
    return { ok: false, resposta: erro('falha_no_pagamento', 'Não foi possível confirmar o seu plano agora. Tente novamente em instantes.', 502) }
  }

  if (!treinadorPodeGerir(estado)) {
    return { ok: false, resposta: erro('plano_insuficiente', 'Esta área é do plano Cornerman ou Profissional.', 403) }
  }
  return { ok: true, usuario: preparo.usuario }
}
