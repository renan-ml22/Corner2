import { describe, expect, it } from 'vitest'
import { fundir, iguais } from '@/lib/dados/fusao'
import type { WorkoutEntry } from '@/lib/tipos'

const t = (id: string, data: string): WorkoutEntry => ({ id, data, tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900 })

describe('iguais: comparação profunda que ignora a ordem das chaves', () => {
  it('objetos com as mesmas chaves em outra ordem são iguais', () => {
    expect(iguais({ a: 1, b: { c: 2, d: [1, 2] } }, { b: { d: [1, 2], c: 2 }, a: 1 })).toBe(true)
  })

  it('a ordem dentro de uma lista importa', () => {
    expect(iguais([1, 2], [2, 1])).toBe(false)
  })

  it('diferenças de valor, de tipo e de quantidade de chaves', () => {
    expect(iguais({ a: 1 }, { a: 2 })).toBe(false)
    expect(iguais({ a: 1 }, { a: '1' })).toBe(false)
    expect(iguais({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(iguais({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    expect(iguais(null, {})).toBe(false)
    expect(iguais([], {})).toBe(false)
    expect(iguais(null, null)).toBe(true)
    expect(iguais('', '')).toBe(true)
  })
})

describe('fundir: primeira vez que um aparelho com dados encontra uma conta que já tem dados', () => {
  it('histórico: união pelos ids, o mais novo primeiro, e o treino que está nos dois fica uma vez só', () => {
    const local = [t('c', '2026-10-12T10:00:00.000Z'), t('a', '2026-10-10T10:00:00.000Z')]
    const servidor = [t('b', '2026-10-11T10:00:00.000Z'), t('a', '2026-10-10T10:00:00.000Z')]
    expect(fundir('historico', local, servidor).map(x => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('histórico: no mesmo id, vale a versão da conta', () => {
    const local = [{ ...t('a', '2026-10-10T10:00:00.000Z'), rpe: 3 }]
    const servidor = [{ ...t('a', '2026-10-10T10:00:00.000Z'), rpe: 9 }]
    expect(fundir('historico', local, servidor)[0].rpe).toBe(9)
  })

  it('pesos: união por dia (um peso por dia, o da conta vence), em ordem de data crescente', () => {
    const local = [{ id: 'l1', data: '2026-10-01', kg: 70 }, { id: 'l2', data: '2026-10-05', kg: 69 }]
    const servidor = [{ id: 's1', data: '2026-10-05', kg: 68 }, { id: 's2', data: '2026-10-09', kg: 67 }]
    expect(fundir('pesos', local, servidor)).toEqual([
      { id: 'l1', data: '2026-10-01', kg: 70 }, { id: 's1', data: '2026-10-05', kg: 68 }, { id: 's2', data: '2026-10-09', kg: 67 },
    ])
  })

  it('check-ins: união por dia (o da conta vence), o mais novo primeiro', () => {
    const local = [{ data: '2026-10-01', sono: 3, dor: 1, energia: 3 }, { data: '2026-10-03', sono: 4, dor: 1, energia: 4 }]
    const servidor = [{ data: '2026-10-03', sono: 2, dor: 5, energia: 1 }]
    expect(fundir('checkins', local, servidor)).toEqual([
      { data: '2026-10-03', sono: 2, dor: 5, energia: 1 }, { data: '2026-10-01', sono: 3, dor: 1, energia: 3 },
    ])
  })

  it('lesões: união pelos ids, com as da conta primeiro', () => {
    const l = (id: string) => ({ id, regiao: 'ombros' as const, intensidade: 2, inicio: '2026-10-01' })
    expect(fundir('lesoes', [l('x'), l('y')], [l('y'), l('z')]).map(v => v.id)).toEqual(['y', 'z', 'x'])
  })

  it('configurações e reagendamentos: campos dos dois lados; no mesmo campo vale a conta', () => {
    expect(fundir('config', { metaSemanal: 5, postura: 'canhoto' }, { metaSemanal: 3, notificacoes: false }))
      .toEqual({ metaSemanal: 3, postura: 'canhoto', notificacoes: false })
    expect(fundir('reag', { a: 1, b: 2 }, { b: 4 })).toEqual({ a: 1, b: 4 })
  })

  it('foto de perfil: vale a da conta', () => {
    expect(fundir('foto', 'data:image/jpeg;base64,AAAA', 'data:image/jpeg;base64,BBBB')).toBe('data:image/jpeg;base64,BBBB')
  })

  it('quiz: vale o da conta; se a conta não tem quiz, vale o do aparelho (nenhuma tela apaga o quiz, então vazio é "nunca fez")', () => {
    expect(fundir('quiz', '00020', '21110')).toBe('21110')
    expect(fundir('quiz', '00020', '')).toBe('00020')
    expect(fundir('quiz', '', '')).toBe('')
  })

  it('plano e estado do dia: vale o da conta', () => {
    expect(fundir('plano', { planoId: 'fundamentos', inicio: '2026-10-05' }, { planoId: 'base-aerobica', inicio: '2026-10-12' }))
      .toEqual({ planoId: 'base-aerobica', inicio: '2026-10-12' })
    expect(fundir('plano', { planoId: 'fundamentos', inicio: '2026-10-05' }, null)).toBeNull()
    expect(fundir('ajuste', { data: '2026-10-13', aplicado: true }, { data: '2026-10-14', aplicado: false })).toEqual({ data: '2026-10-14', aplicado: false })
  })

  it('não altera as listas recebidas', () => {
    const local = [t('c', '2026-10-12T10:00:00.000Z')]
    const servidor = [t('b', '2026-10-11T10:00:00.000Z')]
    const copiaL = structuredClone(local)
    const copiaS = structuredClone(servidor)
    fundir('historico', local, servidor)
    expect(local).toEqual(copiaL)
    expect(servidor).toEqual(copiaS)
  })

  it('nunca perde um treino: tudo o que estava em qualquer lado aparece no resultado', () => {
    let s = 7
    const sorteio = (n: number) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n }
    for (let rodada = 0; rodada < 50; rodada++) {
      const gerar = (prefixo: string) => Array.from({ length: sorteio(8) }, (_, i) => t(`${sorteio(2) ? 'comum' : prefixo}${i}`, `2026-10-${String(1 + sorteio(28)).padStart(2, '0')}T10:00:00.000Z`))
      const unico = (lista: WorkoutEntry[]) => [...new Map(lista.map(x => [x.id, x])).values()]
      const local = unico(gerar('l')), servidor = unico(gerar('s'))
      const ids = new Set(fundir('historico', local, servidor).map(x => x.id))
      for (const x of [...local, ...servidor]) expect(ids.has(x.id), `perdeu ${x.id}`).toBe(true)
      expect(ids.size).toBe(new Set([...local, ...servidor].map(x => x.id)).size)
    }
  })
})
