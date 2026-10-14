import type { Page } from '@playwright/test'
import { gravarRaw } from './fixtures'

/** Um atleta com plano, histórico, check-in, lesão e pesos: deixa todas as telas "cheias" para auditar. */
const treino = (id: string, dia: string, extra: Record<string, unknown> = {}) => ({
  id, data: `2026-10-${dia}T15:00:00.000Z`, tipo: 'tec', rounds: 6, minPorRound: 3, rpe: 6, duracaoSegundos: 1800, ...extra,
})

export const DADOS_DE_EXEMPLO: Record<string, unknown> = {
  historico: [
    treino('h1', '13', { tipo: 'spa', rounds: 5, minPorRound: 2, rpe: 8, duracaoSegundos: 1500, sparring: { intensidade: 'forte', cabeca: 'leves', parceiro: 'Marcos' }, nota: 'Bom ritmo' }),
    treino('h2', '12'), treino('h3', '08', { tipo: 'con', rpe: 7 }), treino('h4', '06'),
    treino('h5', '01', { tipo: 'spa', rpe: 9, sparring: { intensidade: 'moderada', cabeca: 'fortes' } }),
    treino('h6', '11'), treino('h7', '10', { tipo: 'con' }),
  ],
  plano: { planoId: 'fundamentos', inicio: '2026-10-12' },
  config: { onboardingFeito: true, metaSemanal: 3, pesoCategoria: 66, postura: 'canhoto', experiencia: 'ate1' },
  checkins: [{ data: '2026-10-14', sono: 4, dor: 2, energia: 3 }],
  lesoes: [
    { id: 'l1', regiao: 'punhos', intensidade: 4, inicio: '2026-10-05', nota: 'Dor ao fechar' },
    { id: 'l2', regiao: 'joelhos', intensidade: 2, inicio: '2026-09-01', resolvidaEm: '2026-09-20' },
  ],
  pesos: [
    { id: 'p1', data: '2026-09-20', kg: 68.4 }, { id: 'p2', data: '2026-09-30', kg: 67.8 },
    { id: 'p3', data: '2026-10-07', kg: 67.1 }, { id: 'p4', data: '2026-10-13', kg: 66.4 },
  ],
}

export async function semear(pagina: Page, dados: Record<string, unknown> = DADOS_DE_EXEMPLO) {
  for (const [entidade, valor] of Object.entries(dados)) await gravarRaw(pagina, entidade, JSON.stringify(valor))
}
