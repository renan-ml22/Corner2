// Partes de HTTP da rota /api/dados que não dependem do Next (por isso testáveis): ler o corpo com limite e traduzir erros.

import { ErroDados } from './servico'

/** Abaixo do limite de 4,5 MB do corpo de um pedido na Vercel. Cabe o histórico máximo (5.000 treinos). */
export const LIMITE_DO_CORPO_BYTES = 3_000_000

interface ErroDeCorpo { codigo: string; status: number; mensagem: string }

const MUITO_GRANDE: ErroDeCorpo = { codigo: 'muito_grande', status: 413, mensagem: 'Os dados enviados são grandes demais.' }
const INVALIDO: ErroDeCorpo = { codigo: 'pedido_invalido', status: 400, mensagem: 'Pedido inválido.' }

/** Lê o corpo como JSON sem aceitar mais bytes que o limite (conta bytes de verdade, e para de ler ao passar). */
export async function lerCorpoJson(request: Request, limite = LIMITE_DO_CORPO_BYTES): Promise<{ ok: true; valor: unknown } | { ok: false; erro: ErroDeCorpo }> {
  const declarado = Number(request.headers.get('content-length'))
  if (Number.isFinite(declarado) && declarado > limite) return { ok: false, erro: MUITO_GRANDE }
  if (!request.body) return { ok: false, erro: INVALIDO }

  const leitor = request.body.getReader()
  const pedacos: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await leitor.read()
    if (done) break
    total += value.byteLength
    if (total > limite) {
      await leitor.cancel().catch(() => {})
      return { ok: false, erro: MUITO_GRANDE }
    }
    pedacos.push(value)
  }

  try {
    return { ok: true, valor: JSON.parse(new TextDecoder().decode(Buffer.concat(pedacos))) }
  } catch {
    return { ok: false, erro: INVALIDO }
  }
}

/**
 * Erro conhecido: texto e status próprios. Qualquer outro (rede, banco, bug) vira 502 genérico: o detalhe fica
 * só no log do servidor (tipo e mensagem do erro, nunca o objeto inteiro) e nunca na resposta.
 */
export function respostaDeErro(e: unknown): { status: number; corpo: { erro: string; codigo: string } } {
  if (e instanceof ErroDados) return { status: e.status, corpo: { erro: e.message, codigo: e.codigo } }
  const resumo = e instanceof Error ? `${e.name}: ${e.message}` : 'erro desconhecido'
  console.error(`[dados] falha ao falar com o banco: ${resumo}`)
  return { status: 502, corpo: { erro: 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.', codigo: 'falha_no_banco' } }
}
