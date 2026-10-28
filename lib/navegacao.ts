// Qual aba da barra de baixo fica acesa em cada tela.

const ABAS = ['/hoje', '/plano', '/timer', '/progresso', '/alunos', '/perfil'] as const

/** Telas que não são uma aba, mas moram dentro de uma: exercícios, quiz e atletas ficam na aba Plano. */
const TELAS_DA_ABA: Record<string, readonly string[]> = {
  '/plano': ['/exercicios', '/quiz', '/atletas'],
}

/** `/atletas/ali` pertence a `/atletas`; `/atletas-x` não. */
const estaEm = (caminho: string, raiz: string) => caminho === raiz || caminho.startsWith(`${raiz}/`)

/** O endereço da aba que deve ficar acesa em `caminho`, ou `null` se a tela não pertence a nenhuma aba. */
export function abaAtiva(caminho: string): string | null {
  return ABAS.find(aba => estaEm(caminho, aba) || (TELAS_DA_ABA[aba] ?? []).some(t => estaEm(caminho, t))) ?? null
}

/** O número dentro do círculo vermelho da aba "Alunos"; acima de 9 vira "9+" para caber. Sem alunos parados, não há selo. */
export function textoDoSeloDeAlunos(parados: number): string | null {
  if (!Number.isInteger(parados) || parados <= 0) return null
  return parados > 9 ? '9+' : String(parados)
}

/** O mesmo selo para leitor de tela, com o número exato. */
export function descricaoDoSeloDeAlunos(parados: number): string | null {
  if (!Number.isInteger(parados) || parados <= 0) return null
  return `${parados} ${parados === 1 ? 'aluno' : 'alunos'} sem treinar há 7 dias ou mais`
}
