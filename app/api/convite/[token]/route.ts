import { responder } from '@/lib/assinatura/rota'
import { usuarioLogado } from '@/lib/cornerman/aluno-rota'
import { ehTokenDeConvite } from '@/lib/cornerman/convite'
import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'
import { consultarConvite } from '@/lib/cornerman/convite-servico'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { getSupabase } from '@/lib/supabase'

/**
 * O que a página pública do convite precisa saber (sem exigir login): se o convite vale e o PRIMEIRO NOME do treinador,
 * e se quem pergunta já está logado. Convite que não existe, expirado, usado, cancelado e token malformado (ou sem
 * banco configurado) respondem exatamente igual: `{ valido: false, logado }`, sempre 200.
 */
export async function GET(_request: Request, ctx: RouteContext<'/api/convite/[token]'>) {
  const { token } = await ctx.params
  const logado = (await usuarioLogado()) !== null

  const db = getSupabase()
  if (!db || !ehTokenDeConvite(token)) return responder({ valido: false, logado })

  try {
    return responder({ ...(await consultarConvite(criarConvitesBancoSupabase(db), token)), logado })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
