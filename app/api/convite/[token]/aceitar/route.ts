import { erro, prepararRota, responder } from '@/lib/assinatura/rota'
import { apagarCookieDoConvite, semBanco } from '@/lib/cornerman/aluno-rota'
import { ehTokenDeConvite } from '@/lib/cornerman/convite'
import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'
import { aceitarConvite } from '@/lib/cornerman/convite-servico'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { ErroCornerman } from '@/lib/cornerman/servico'
import { getSupabase } from '@/lib/supabase'

/**
 * O aluno logado aceita o convite: a conta dele passa a estar ligada à ficha do treinador. Atômico e de uso único.
 * Qualquer pessoa logada pode aceitar (o link é a credencial; o e-mail da conta não precisa bater com o da ficha).
 * Não exige plano nenhum.
 *
 * - 200 `{ ok: true, treinador }` (primeiro nome); o cookie do convite é apagado.
 * - 404 `convite_invalido` (não existe, expirou, já foi usado, malformado), 400 `proprio_convite`, 409 `ja_tem_treinador`.
 *   Em qualquer um desses o cookie também é apagado: o aluno age de novo a partir do link, sem ficar preso num ciclo.
 */
export async function POST(request: Request, ctx: RouteContext<'/api/convite/[token]/aceitar'>) {
  const preparo = await prepararRota(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { token } = await ctx.params
  if (!ehTokenDeConvite(token)) {
    await apagarCookieDoConvite()
    return erro('convite_invalido', 'Convite inválido ou expirado.', 404)
  }

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    const { treinador } = await aceitarConvite(criarConvitesBancoSupabase(db), token, preparo.usuario.id)
    await apagarCookieDoConvite()
    return responder({ ok: true, treinador })
  } catch (e) {
    if (e instanceof ErroCornerman) await apagarCookieDoConvite()
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
