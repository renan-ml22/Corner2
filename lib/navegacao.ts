// Qual aba da barra de baixo fica acesa em cada tela.

const ABAS = ['/hoje', '/plano', '/timer', '/progresso', '/perfil'] as const

/** Telas que não são uma aba, mas moram dentro de uma: exercícios, quiz e atletas ficam na aba Plano. */
const TELAS_DA_ABA: Record<string, readonly string[]> = {
  '/plano': ['/exercicios', '/quiz', '/atletas'],
  // A área do treinador (plano Cornerman) é aberta pelo Perfil. A aba "Alunos" própria vem numa etapa seguinte.
  '/perfil': ['/alunos'],
}

/** `/atletas/ali` pertence a `/atletas`; `/atletas-x` não. */
const estaEm = (caminho: string, raiz: string) => caminho === raiz || caminho.startsWith(`${raiz}/`)

/** O endereço da aba que deve ficar acesa em `caminho`, ou `null` se a tela não pertence a nenhuma aba. */
export function abaAtiva(caminho: string): string | null {
  return ABAS.find(aba => estaEm(caminho, aba) || (TELAS_DA_ABA[aba] ?? []).some(t => estaEm(caminho, t))) ?? null
}
