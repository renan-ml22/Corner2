import { origemDoSite } from '@/lib/assinatura/http'
import { erro, responder } from '@/lib/assinatura/rota'
import { prepararRotaDoTreinador } from '@/lib/cornerman/acesso'
import { criarConvitesBancoSupabase } from '@/lib/cornerman/convite-banco'
import { cancelarConviteDaFicha, criarConviteDaFicha } from '@/lib/cornerman/convite-servico'
import { ehIdDeFicha } from '@/lib/cornerman/ficha'
import { respostaDeErroDoCornerman } from '@/lib/cornerman/http'
import { getSupabase } from '@/lib/supabase'

/**
 * Convite de uma ficha do treinador logado (plano Cornerman ou Profissional).
 *
 * - POST: gera o convite. 201 `{ link, expiraEm }`. O link (com o token) só aparece AQUI: o servidor guarda só o hash,
 *   e gerar de novo faz o link anterior parar de valer.
 * - DELETE: cancela o convite pendente; a ficha volta a "ativo". `{ ok: true }`.
 *
 * Ficha de outro treinador, id que não existe e id que não é um uuid respondem exatamente igual (404).
 */
type Contexto = RouteContext<'/api/cornerman/alunos/[id]/convite'>

const naoEncontrado = () => erro('nao_encontrado', 'Aluno não encontrado.', 404)
const semBanco = () => erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

export async function POST(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    return responder(await criarConviteDaFicha(criarConvitesBancoSupabase(db), preparo.usuario.id, id, origemDoSite(request)), 201)
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}

export async function DELETE(request: Request, ctx: Contexto) {
  const preparo = await prepararRotaDoTreinador(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const { id } = await ctx.params
  if (!ehIdDeFicha(id)) return naoEncontrado()

  const db = getSupabase()
  if (!db) return semBanco()

  try {
    await cancelarConviteDaFicha(criarConvitesBancoSupabase(db), preparo.usuario.id, id)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo } = respostaDeErroDoCornerman(e)
    return responder(corpo, status)
  }
}
