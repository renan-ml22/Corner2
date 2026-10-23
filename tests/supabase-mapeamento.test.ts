import { describe, expect, it } from 'vitest'
import {
  configParaPerfil, linhaParaPlano, linhaParaTreino, perfilParaConfig, planoParaLinha, treinoParaLinha,
} from '@/lib/dados/servidor/mapeamento'
import type { Configuracoes, PlanoAtivo, WorkoutEntry } from '@/lib/tipos'

const minimo: WorkoutEntry = { id: 'a1', data: '2026-10-10T12:00:00.000Z', tipo: 'tec', rounds: 5, minPorRound: 3, rpe: 6, duracaoSegundos: 900 }
const completo: WorkoutEntry = {
  ...minimo, id: 'b2', tipo: 'spa', sessaoId: 'fund-1-qua', nota: 'Senti o ombro',
  sparring: { intensidade: 'forte', cabeca: 'leves', parceiro: 'Rafa' },
}

describe('treino <-> linha da tabela workouts', () => {
  it('um treino completo (sparring, nota, sessão) volta idêntico', () => {
    expect(linhaParaTreino(treinoParaLinha(completo))).toStrictEqual(completo)
  })

  it('um treino mínimo volta sem criar campos que não existiam', () => {
    const volta = linhaParaTreino(treinoParaLinha(minimo))
    expect(volta).toStrictEqual(minimo)
    expect(Object.keys(volta!).sort()).toEqual(['data', 'duracaoSegundos', 'id', 'minPorRound', 'rounds', 'rpe', 'tipo'])
  })

  it('a linha usa os nomes das colunas e null (não undefined) no que falta', () => {
    expect(treinoParaLinha(minimo)).toStrictEqual({
      id: 'a1', date: '2026-10-10T12:00:00.000Z', type: 'tec', rounds: 5, round_min: 3, rpe: 6, duration_seconds: 900,
      session_id: null, note: null, sparring_intensity: null, sparring_head: null, sparring_partner: null,
    })
    expect(treinoParaLinha(completo)).toMatchObject({
      session_id: 'fund-1-qua', note: 'Senti o ombro', sparring_intensity: 'forte', sparring_head: 'leves', sparring_partner: 'Rafa',
    })
  })

  it('sparring sem parceiro volta sem o campo parceiro', () => {
    const e: WorkoutEntry = { ...minimo, tipo: 'spa', sparring: { intensidade: 'leve', cabeca: 'nenhum' } }
    const volta = linhaParaTreino(treinoParaLinha(e))
    expect(volta).toStrictEqual(e)
    expect(volta!.sparring).not.toHaveProperty('parceiro')
  })

  it('a data que volta do banco em outro formato vira o mesmo instante em ISO com Z', () => {
    const linha = { ...treinoParaLinha(minimo), date: '2026-10-10T12:00:00+00:00' }
    expect(linhaParaTreino(linha)!.data).toBe('2026-10-10T12:00:00.000Z')
    expect(linhaParaTreino({ ...linha, date: '2026-10-10T09:00:00-03:00' })!.data).toBe('2026-10-10T12:00:00.000Z')
  })

  it('milissegundos e números fracionados não se perdem', () => {
    const e: WorkoutEntry = { ...minimo, data: '2026-10-10T12:00:00.123Z', minPorRound: 2.5, duracaoSegundos: 1234.5, rpe: 7 }
    expect(linhaParaTreino(treinoParaLinha(e))).toStrictEqual(e)
  })

  it('números que o banco devolve como texto voltam como número', () => {
    const linha = { ...treinoParaLinha(minimo), rounds: '5', round_min: '3', rpe: '6', duration_seconds: '900' } as never
    expect(linhaParaTreino(linha)).toStrictEqual(minimo)
  })

  it.each([
    ['tipo desconhecido', { type: 'xyz' }],
    ['rpe fora de 1 a 10', { rpe: 99 }],
    ['data inválida', { date: 'ontem' }],
    ['rounds negativo', { rounds: -1 }],
    ['sparring com valor estranho', { sparring_intensity: 'brutal', sparring_head: 'nenhum' }],
  ])('uma linha inválida (%s) é descartada, não vira treino', (_nome, estrago) => {
    expect(linhaParaTreino({ ...treinoParaLinha(minimo), ...estrago } as never)).toBeNull()
  })

  it('lixo no lugar da linha também é descartado', () => {
    expect(linhaParaTreino(null as never)).toBeNull()
    expect(linhaParaTreino('x' as never)).toBeNull()
  })

  it('200 treinos variados fazem a viagem de ida e volta sem diferença', () => {
    let s = 12345
    const sorteio = (n: number) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % n }
    for (let i = 0; i < 200; i++) {
      const tipo = (['tec', 'con', 'spa'] as const)[sorteio(3)]
      const e: WorkoutEntry = {
        id: `t${i}`, data: new Date(Date.UTC(2026, sorteio(12), 1 + sorteio(28), sorteio(24), sorteio(60), sorteio(60), sorteio(1000))).toISOString(),
        tipo, rounds: sorteio(13), minPorRound: sorteio(5) + 1, rpe: 1 + sorteio(10), duracaoSegundos: sorteio(7200),
        ...(sorteio(2) ? { sessaoId: `s${sorteio(9)}` } : {}),
        ...(sorteio(2) ? { nota: 'texto com "aspas", acento e\nquebra de linha' } : {}),
        ...(tipo === 'spa' && sorteio(2) ? { sparring: { intensidade: (['leve', 'moderada', 'forte'] as const)[sorteio(3)], cabeca: (['nenhum', 'leves', 'fortes'] as const)[sorteio(3)], ...(sorteio(2) ? { parceiro: 'Zé' } : {}) } } : {}),
      }
      expect(linhaParaTreino(treinoParaLinha(e)), JSON.stringify(e)).toStrictEqual(e)
    }
  })
})

describe('configurações <-> linha da tabela profiles', () => {
  const cfg: Partial<Configuracoes> = {
    metaSemanal: 4, notificacoes: false, postura: 'canhoto', onboardingFeito: true, experiencia: '1a3', pesoCategoria: 67, lembreteHora: '07:30',
  }

  it('as configurações completas voltam idênticas, a partir de settings', () => {
    expect(perfilParaConfig(configParaPerfil(cfg, 'Renan'))).toStrictEqual(cfg)
  })

  it('o nome vai para a coluna name; experiência e meta semanal, para level e days_per_week', () => {
    const linha = configParaPerfil(cfg, 'Renan')
    expect(linha).toMatchObject({ name: 'Renan', level: '1a3', days_per_week: 4 })
    expect(linha.settings).toStrictEqual(cfg)
  })

  it('configuração vazia: colunas null e settings vazio', () => {
    expect(configParaPerfil({}, 'Renan')).toStrictEqual({ name: 'Renan', level: null, days_per_week: null, settings: {} })
    expect(perfilParaConfig(configParaPerfil({}, 'Renan'))).toStrictEqual({})
  })

  it('experiência null (escolha "não informar") continua null, e ausente continua ausente', () => {
    expect(perfilParaConfig(configParaPerfil({ experiencia: null }, 'x'))).toStrictEqual({ experiencia: null })
    expect(perfilParaConfig(configParaPerfil({ metaSemanal: 3 }, 'x'))).toStrictEqual({ metaSemanal: 3 })
  })

  it('campos inválidos em settings são descartados e os válidos ficam', () => {
    const linha = { ...configParaPerfil({}, 'x'), settings: { metaSemanal: 99, postura: 'canhoto', inventado: 1 } }
    expect(perfilParaConfig(linha)).toStrictEqual({ postura: 'canhoto' })
  })

  it('settings que não é objeto vira configuração vazia', () => {
    expect(perfilParaConfig({ name: 'x', level: null, days_per_week: null, settings: null } as never)).toStrictEqual({})
    expect(perfilParaConfig({ name: 'x', level: null, days_per_week: null, settings: [1] } as never)).toStrictEqual({})
  })
})

describe('plano ativo <-> linha da tabela active_plans', () => {
  const plano: PlanoAtivo = { planoId: 'fundamentos', inicio: '2026-10-12' }

  it('volta idêntico, e a data do calendário não muda de dia', () => {
    expect(planoParaLinha(plano)).toStrictEqual({ plan_id: 'fundamentos', started_at: '2026-10-12' })
    expect(linhaParaPlano(planoParaLinha(plano))).toStrictEqual(plano)
  })

  it('plano desconhecido ou data inválida vira "sem plano", sem erro', () => {
    expect(linhaParaPlano({ plan_id: 'nao-existe', started_at: '2026-10-12' })).toBeNull()
    expect(linhaParaPlano({ plan_id: 'fundamentos', started_at: '2026-02-31' })).toBeNull()
    expect(linhaParaPlano(null)).toBeNull()
  })
})
