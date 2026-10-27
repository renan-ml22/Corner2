import { origemPermitida } from '@/lib/assinatura/http'
import { erro, responder } from '@/lib/assinatura/rota'
import { apagarCookieDoConvite, guardarCookieDoConvite, semBanco } from '@/lib/cornerman/aluno-rota'
import { ehTokenDeConvite } from '@/lib/cornerman/convite'
import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'
import { consultarConvite } from '@/lib/cornerman/convite-servico'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { getSupabase } from '@/lib/supabase'

/**
 * Leva o convite pelo login ou pelo cadastro (sem exigir sessão: quem chama ainda não entrou). Só do próprio site.
 *
 * - POST: guarda o token num cookie (HttpOnly, 1 hora) **só se o convite vale**; o proxy usa o cookie para levar o aluno
 *   de volta ao convite depois de entrar. Token que não vale: 404 `convite_invalido`, sem cookie.
 * - DELETE: apaga o cookie ("agora não", ou convite que deixou de valer). Sempre 200.
 */
type Contexto = RouteContext<'/api/convite/[token]/guardar'>

const naoPermitido = () => erro('origem_invalida', 'Pedido recusado.', 403)

export async function POST(request: Request, ctx: Contexto) {
  if (!origemPermitida(request)) return naoPermitido()

  const { token } = await ctx.params
  if (!ehTokenDeConvite(token)) return erro('convite_invalido', 'Convite inválido ou expirado.', 404)

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    const convite = await consultarConvite(criarConvitesBancoSupabase(db), token)
    if (!convite.valido) return erro('convite_invalido', 'Convite inválido ou expirado.', 404)
    await guardarCookieDoConvite(token)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function DELETE(request: Request) {
  if (!origemPermitida(request)) return naoPermitido()
  await apagarCookieDoConvite()
  return responder({ ok: true })
}
