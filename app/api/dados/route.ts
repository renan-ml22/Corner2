import { erro, prepararRota, responder } from '@/lib/assinatura/rota'
import { criarBancoSupabase } from '@/lib/dados/servidor/banco-supabase'
import { lerCorpoJson, respostaDeErro } from '@/lib/dados/servidor/http'
import { carregarDados, salvarEntidades } from '@/lib/dados/servidor/servico'
import { getSupabase } from '@/lib/supabase'

/**
 * Dados do usuário logado no banco (Supabase). O id do usuário vem SEMPRE da sessão, nunca do pedido.
 *
 * - GET: tudo o que está gravado. Uma entidade ausente = nunca gravada.
 * - PUT: grava as entidades enviadas (corpo: `{ historico: [...], config: {...}, ... }`). Valida tudo antes de gravar.
 *
 * Sem as variáveis do Supabase, a conta na nuvem está desligada: o GET responde 200 com `ativo: false` (e o app segue só
 * com o aparelho). Não é um erro, e por isso não usa 4xx/5xx: o navegador registraria um erro no console em toda página.
 */
export async function GET(request: Request) {
  const preparo = await prepararRota(request, { mutavel: false })
  if (!preparo.ok) return preparo.resposta

  const db = getSupabase()
  if (!db) return responder({ ativo: false })

  try {
    return responder({ ativo: true, dados: await carregarDados(criarBancoSupabase(db), preparo.usuario.id) })
  } catch (e) {
    const { status, corpo } = respostaDeErro(e)
    return responder(corpo, status)
  }
}

export async function PUT(request: Request) {
  const preparo = await prepararRota(request, { mutavel: true })
  if (!preparo.ok) return preparo.resposta

  const db = getSupabase()
  if (!db) return erro('nao_configurado', 'A conta na nuvem ainda não está disponível neste ambiente.', 503)

  const corpo = await lerCorpoJson(request)
  if (!corpo.ok) return erro(corpo.erro.codigo, corpo.erro.mensagem, corpo.erro.status)

  try {
    await salvarEntidades(criarBancoSupabase(db), { id: preparo.usuario.id, nome: preparo.usuario.name }, corpo.valor)
    return responder({ ok: true })
  } catch (e) {
    const { status, corpo: resposta } = respostaDeErro(e)
    return responder(resposta, status)
  }
}
