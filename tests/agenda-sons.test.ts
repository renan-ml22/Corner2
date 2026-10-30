import { describe, expect, it } from 'vitest'
import { montarFases } from '@/hooks/useCronometro'
import { agendaDeSons } from '@/lib/agenda-sons'

// A lista de tudo o que o cronômetro toca no treino inteiro, e em que segundo (desde o início) cada som entra.
// É ela que permite programar os sons de uma vez só: o áudio toca no horário mesmo com a página em segundo plano.

const resumo = (rounds: number, roundSeg: number, descansoSeg: number, preparoSeg: number, contagemNoRound: boolean) =>
  agendaDeSons(montarFases(rounds, roundSeg, descansoSeg, preparoSeg), contagemNoRound).map((e): [number, string, number | null] => [e.em, e.nome, e.restante ?? null])

describe('agendaDeSons', () => {
  it('Timer (3-2-1 também no round): preparo, 2 rounds e 1 descanso, cada som no segundo certo', () => {
    expect(resumo(2, 60, 30, 10, true)).toEqual([
      [7, 'contagem', 3], [8, 'contagem', 2], [9, 'contagem', 1],
      [10, 'inicioRound', null],
      [60, 'aviso', null],
      [67, 'contagem', 3], [68, 'contagem', 2], [69, 'contagem', 1],
      [70, 'inicioDescanso', null],
      [97, 'contagem', 3], [98, 'contagem', 2], [99, 'contagem', 1],
      [100, 'inicioRound', null],
      [150, 'aviso', null],
      [157, 'contagem', 3], [158, 'contagem', 2], [159, 'contagem', 1],
      [160, 'fim', null],
    ])
  })

  it('treino do plano (sem 3-2-1 no round): só o preparo e o descanso contam', () => {
    const nomes = resumo(2, 60, 30, 10, false).filter(([, n]) => n === 'contagem').map(([em]) => em)
    expect(nomes).toEqual([7, 8, 9, 97, 98, 99])
  })

  it('sem preparo, o sino do round 1 toca no segundo 0', () => {
    expect(resumo(1, 60, 0, 0, true)[0]).toEqual([0, 'inicioRound', null])
  })

  it('round de 25 s ou menos não tem o aviso dos 10 s; com 26 s tem', () => {
    expect(resumo(1, 25, 0, 0, true).some(([, n]) => n === 'aviso')).toBe(false)
    expect(resumo(1, 26, 0, 0, true).some(([em, n]) => n === 'aviso' && em === 16)).toBe(true)
  })

  it('fase curta demais não faz a contagem já no primeiro segundo: descanso de 3 s só conta 2 e 1', () => {
    const descanso = resumo(2, 60, 3, 0, false).filter(([em, n]) => n === 'contagem' && em > 60 && em < 63)
    expect(descanso).toEqual([[61, 'contagem', 2], [62, 'contagem', 1]])
  })

  it('o último som é o fim do treino, no total; o fim de um round que leva ao descanso é o sino do descanso', () => {
    const e = agendaDeSons(montarFases(3, 180, 60, 10), true)
    expect(e[e.length - 1]).toMatchObject({ nome: 'fim', em: 10 + 3 * 180 + 2 * 60 })
    expect(e.filter(x => x.nome === 'fim')).toHaveLength(1)
    expect(e.filter(x => x.nome === 'inicioDescanso').map(x => x.em)).toEqual([190, 430])
  })

  it('vem em ordem de horário e cada som tem uma chave só dele (para nunca tocar duas vezes)', () => {
    const e = agendaDeSons(montarFases(20, 600, 600, 10), true)
    for (let i = 1; i < e.length; i++) expect(e[i].em).toBeGreaterThanOrEqual(e[i - 1].em)
    expect(new Set(e.map(x => x.chave)).size).toBe(e.length)
  })
})
