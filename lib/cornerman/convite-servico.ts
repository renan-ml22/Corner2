// Regras do convite e do vínculo entre treinador e aluno. Fala com um `ConvitesBancoLike` (convite-banco.ts), então testa-se
// sem rede. O token só aparece na resposta de `criarConviteDaFicha`; daí em diante só o hash existe. Nenhuma mensagem de
// erro leva token, hash, nome, e-mail nem telefone.

import type { ConvitesBancoLike } from './convite-banco'
import { ehTokenDeConvite, expiraEm, linkDoConvite } from './convite'
import { hashDoToken, novoToken } from './convite-token'
import { ehIdDeFicha } from './ficha'
import { ErroCornerman, limiteAtingido, naoEncontrado } from './servico'

const conviteInvalido = () => new ErroCornerman('convite_invalido', 'Convite inválido ou expirado.', 404)

/** O erro das funções SQL vira o erro com texto próprio; qualquer outro sobe como está. */
function traduzir(e: unknown): never {
  if (e instanceof Error) {
    switch (e.message) {
      case 'limite_de_alunos': throw limiteAtingido()
      case 'nao_encontrado': throw naoEncontrado()
      case 'nao_convidavel': throw new ErroCornerman('nao_convidavel', 'Esta ficha já está vinculada a uma conta.', 409)
      case 'convite_invalido': throw conviteInvalido()
      case 'proprio_convite': throw new ErroCornerman('proprio_convite', 'Você não pode aceitar o seu próprio convite.', 400)
      case 'ja_tem_treinador': throw new ErroCornerman('ja_tem_treinador', 'Você já tem um treinador. Desvincule-se dele no Perfil antes de aceitar outro convite.', 409)
    }
  }
  throw e
}

const primeiroNome = (nome: string | null): string => nome?.trim().split(/\s+/)[0] || 'Um treinador'

/** Gera o convite da ficha: o link com o token (a única vez que ele existe), válido por 14 dias. O link anterior morre. */
export async function criarConviteDaFicha(banco: ConvitesBancoLike, coachId: string, alunoId: string, origem: string, agora: Date = new Date()): Promise<{ link: string; expiraEm: string }> {
  if (!ehIdDeFicha(alunoId)) throw naoEncontrado()
  const { token, hash } = novoToken()
  const expira = expiraEm(agora)
  try {
    await banco.criarConvite(coachId, alunoId, hash, expira)
  } catch (e) {
    traduzir(e)
  }
  return { link: linkDoConvite(origem, token), expiraEm: expira }
}

export async function cancelarConviteDaFicha(banco: ConvitesBancoLike, coachId: string, alunoId: string): Promise<void> {
  if (!ehIdDeFicha(alunoId) || !(await banco.cancelarConvite(coachId, alunoId))) throw naoEncontrado()
}

/** O convite não usado da ficha, para a tela do treinador (sem o token: ele não é guardado). */
export async function convitePendenteDaFicha(banco: ConvitesBancoLike, coachId: string, alunoId: string): Promise<{ expiraEm: string } | null> {
  if (!ehIdDeFicha(alunoId)) return null
  return banco.convitePendente(coachId, alunoId)
}

/** O que a página pública do convite pode saber: se vale e o primeiro nome do treinador. Tudo que não vale responde igual. */
export async function consultarConvite(banco: ConvitesBancoLike, token: string): Promise<{ valido: true; treinador: string } | { valido: false }> {
  if (!ehTokenDeConvite(token)) return { valido: false }
  const convite = await banco.consultarConvite(hashDoToken(token))
  return convite ? { valido: true, treinador: primeiroNome(convite.nomeDoTreinador) } : { valido: false }
}

/** Vincula a conta do aluno à ficha do convite. Atômico e de uso único (a garantia está no banco). */
export async function aceitarConvite(banco: ConvitesBancoLike, token: string, alunoUserId: string): Promise<{ treinador: string }> {
  if (!ehTokenDeConvite(token)) throw conviteInvalido()
  const hash = hashDoToken(token)
  const convite = await banco.consultarConvite(hash)
  if (!convite) throw conviteInvalido()
  try {
    await banco.aceitarConvite(hash, alunoUserId)
  } catch (e) {
    traduzir(e)
  }
  return { treinador: primeiroNome(convite.nomeDoTreinador) }
}

export async function meuTreinador(banco: ConvitesBancoLike, alunoUserId: string): Promise<{ nome: string } | null> {
  const t = await banco.treinadorDoAluno(alunoUserId)
  return t ? { nome: primeiroNome(t.nome) } : null
}

/** O aluno se desvincula (ou o treinador encerra a ficha): a ficha vira "encerrado" e perde a conta. Pode ser repetido. */
export async function desvincularDoTreinador(banco: ConvitesBancoLike, alunoUserId: string): Promise<void> {
  await banco.desvincular(alunoUserId)
}
