import { ErroCornerman, ondeFalhou } from './servico'

/** Uma ficha com foto tem cerca de 14 000 bytes e as notas, até 2 000 caracteres: 100 KB sobra, sem abrir a porta para abuso. */
export const LIMITE_DO_CORPO_BYTES = 100_000

/**
 * Erro conhecido: texto e status próprios. Qualquer outro (rede, banco, bug) vira 502 genérico, e no registro do
 * servidor fica só ONDE falhou (o "Supabase (gravar aluno)" do começo da mensagem), porque o resto da mensagem
 * pode trazer dados da ficha (nome, e-mail, telefone, notas) e esses nunca vão para log nem para a resposta.
 */
export function respostaDeErroDoCornerman(e: unknown): { status: number; corpo: { erro: string; codigo: string } } {
  if (e instanceof ErroCornerman) return { status: e.status, corpo: { erro: e.message, codigo: e.codigo } }
  const onde = ondeFalhou(e)
  console.error(`[cornerman] falha ao falar com o banco${onde ? `: ${onde}` : ''} (${e instanceof Error ? e.name : 'erro desconhecido'})`)
  return { status: 502, corpo: { erro: 'Não foi possível falar com o banco de dados agora. Tente novamente em instantes.', codigo: 'falha_no_banco' } }
}
