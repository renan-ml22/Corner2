import { describe, expect, it } from 'vitest'
import {
  CAT_ICONS,
  CAT_LABELS,
  CONFIG_PADRAO,
  IMPACTO_LABEL,
  INTENSIDADE_LABEL,
  REGIOES,
  TIPOS,
  isArrayDe,
  isCheckin,
  isLesao,
  isPesoRegistro,
  isRegType,
  isWorkoutEntry,
  type RegType,
} from '@/lib/tipos'

const TODOS_OS_TIPOS: RegType[] = ['tec', 'con', 'spa']

// Valores que nenhum validador de objeto pode aceitar.
const NAO_OBJETOS: [string, unknown][] = [
  ['null', null],
  ['undefined', undefined],
  ['string', 'texto'],
  ['número', 42],
  ['booleano', true],
  ['array vazio', []],
  ['array com objeto válido', [{}]],
]

const treino = () => ({
  id: 'abc',
  data: '2026-03-10T12:00:00.000Z',
  tipo: 'tec',
  rounds: 4,
  minPorRound: 3,
  rpe: 7,
  duracaoSegundos: 900,
})
const checkin = () => ({ data: '2026-03-10', sono: 4, dor: 2, energia: 3 })
const lesao = () => ({ id: 'l1', regiao: 'punhos', intensidade: 3, inicio: '2026-03-01' })
const peso = () => ({ id: 'p1', data: '2026-03-10', kg: 72.5 })

/** Cópia do objeto sem o campo indicado. */
function sem<T extends object>(obj: T, campo: keyof T): Partial<T> {
  const copia = { ...obj }
  delete copia[campo]
  return copia
}

describe('constantes de RegType', () => {
  it('TIPOS lista exatamente os três tipos de treino, sem repetição', () => {
    expect([...TIPOS].sort()).toEqual([...TODOS_OS_TIPOS].sort())
    expect(new Set(TIPOS).size).toBe(TIPOS.length)
  })

  it.each(TODOS_OS_TIPOS)('CAT_LABELS, CAT_ICONS e isRegType cobrem o tipo %s', tipo => {
    expect(CAT_LABELS[tipo]).toBeTruthy()
    expect(CAT_ICONS[tipo]).toBeTruthy()
    expect(TIPOS).toContain(tipo)
    expect(isRegType(tipo)).toBe(true)
  })

  it('CAT_LABELS e CAT_ICONS não têm chaves além dos RegType', () => {
    expect(Object.keys(CAT_LABELS).sort()).toEqual([...TODOS_OS_TIPOS].sort())
    expect(Object.keys(CAT_ICONS).sort()).toEqual([...TODOS_OS_TIPOS].sort())
  })

  it('rótulos de intensidade e de impacto na cabeça são textos não vazios', () => {
    for (const rotulo of [...Object.values(INTENSIDADE_LABEL), ...Object.values(IMPACTO_LABEL)]) {
      expect(rotulo.trim()).not.toBe('')
    }
    expect(Object.keys(INTENSIDADE_LABEL).sort()).toEqual(['forte', 'leve', 'moderada'])
    expect(Object.keys(IMPACTO_LABEL).sort()).toEqual(['fortes', 'leves', 'nenhum'])
  })

  it('REGIOES tem rótulo não vazio para cada região, incluindo "outra"', () => {
    expect(Object.keys(REGIOES)).toContain('outra')
    for (const rotulo of Object.values(REGIOES)) expect(rotulo.trim()).not.toBe('')
  })
})

describe('CONFIG_PADRAO', () => {
  it('traz os valores iniciais esperados', () => {
    expect(CONFIG_PADRAO).toEqual({
      metaSemanal: 3,
      notificacoes: true,
      postura: 'ortodoxo',
      onboardingFeito: false,
      experiencia: null,
      pesoCategoria: null,
      lembreteHora: '',
    })
  })

  it('define todos os campos de Configuracoes (nenhum undefined)', () => {
    for (const [chave, valor] of Object.entries(CONFIG_PADRAO)) {
      expect(valor, chave).not.toBeUndefined()
    }
  })

  it('a meta semanal padrão é um inteiro positivo', () => {
    expect(Number.isInteger(CONFIG_PADRAO.metaSemanal)).toBe(true)
    expect(CONFIG_PADRAO.metaSemanal).toBeGreaterThan(0)
  })
})

describe('isRegType', () => {
  it.each(TODOS_OS_TIPOS)('aceita %s', tipo => {
    expect(isRegType(tipo)).toBe(true)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string vazia', ''],
    ['maiúscula', 'TEC'],
    ['com espaço', ' tec'],
    ['valor fora do enum', 'box'],
    ['número', 1],
    ['array', ['tec']],
    ['objeto', { tipo: 'tec' }],
  ])('rejeita %s', (_nome, valor) => {
    expect(isRegType(valor)).toBe(false)
  })
})

describe('isWorkoutEntry', () => {
  it('aceita o treino válido completo (com sessaoId, nota e sparring)', () => {
    const completo = {
      ...treino(),
      tipo: 'spa',
      sessaoId: 'tav-s1-sab',
      nota: 'Boa sessão',
      sparring: { intensidade: 'moderada', cabeca: 'leves', parceiro: 'João' },
    }
    expect(isWorkoutEntry(completo)).toBe(true)
  })

  it('aceita o treino mínimo, sem campos opcionais', () => {
    expect(isWorkoutEntry(treino())).toBe(true)
  })

  it.each(TODOS_OS_TIPOS)('aceita o tipo %s', tipo => {
    expect(isWorkoutEntry({ ...treino(), tipo })).toBe(true)
  })

  it('aceita sparring sem parceiro (opcional)', () => {
    expect(isWorkoutEntry({ ...treino(), sparring: { intensidade: 'leve', cabeca: 'nenhum' } })).toBe(true)
  })

  it('aceita sparring undefined explícito', () => {
    expect(isWorkoutEntry({ ...treino(), sparring: undefined })).toBe(true)
  })

  it('ignora campos desconhecidos', () => {
    expect(isWorkoutEntry({ ...treino(), extra: 'x' })).toBe(true)
  })

  it.each(NAO_OBJETOS)('rejeita %s', (_nome, valor) => {
    expect(isWorkoutEntry(valor)).toBe(false)
  })

  it('rejeita objeto vazio', () => {
    expect(isWorkoutEntry({})).toBe(false)
  })

  it.each(['id', 'data', 'tipo', 'rounds', 'minPorRound', 'rpe', 'duracaoSegundos'] as const)(
    'rejeita quando falta o campo obrigatório %s',
    campo => {
      expect(isWorkoutEntry(sem(treino(), campo))).toBe(false)
    },
  )

  it.each([
    ['id numérico', { id: 1 }],
    ['data numérica', { data: 1710072000000 }],
    ['tipo fora do enum', { tipo: 'box' }],
    ['tipo numérico', { tipo: 1 }],
    ['rounds em texto', { rounds: '4' }],
    ['minPorRound em texto', { minPorRound: '3' }],
    ['rpe em texto', { rpe: '7' }],
    ['duracaoSegundos em texto', { duracaoSegundos: '900' }],
    ['rounds null', { rounds: null }],
  ])('rejeita tipo errado: %s', (_nome, troca) => {
    expect(isWorkoutEntry({ ...treino(), ...troca })).toBe(false)
  })

  it.each([
    ['rounds', 'rounds'],
    ['minPorRound', 'minPorRound'],
    ['rpe', 'rpe'],
    ['duracaoSegundos', 'duracaoSegundos'],
  ])('rejeita NaN e Infinity em %s', (_nome, campo) => {
    expect(isWorkoutEntry({ ...treino(), [campo]: NaN })).toBe(false)
    expect(isWorkoutEntry({ ...treino(), [campo]: Infinity })).toBe(false)
    expect(isWorkoutEntry({ ...treino(), [campo]: -Infinity })).toBe(false)
  })

  it.each([
    ['sparring como string', 'forte'],
    ['sparring como array', []],
    ['sparring null', null],
    ['sparring sem intensidade', { cabeca: 'nenhum' }],
    ['sparring sem cabeca', { intensidade: 'leve' }],
    ['sparring com intensidade numérica', { intensidade: 3, cabeca: 'nenhum' }],
    ['sparring com cabeca numérica', { intensidade: 'leve', cabeca: 0 }],
  ])('rejeita sparring malformado: %s', (_nome, sparring) => {
    expect(isWorkoutEntry({ ...treino(), sparring })).toBe(false)
  })

  // ── Comportamento correto esperado (hoje o validador é frouxo) ──
  // O contrato de tipos.ts diz Intensidade/ImpactoCabeca (enums) e RPE de 1 a 10 (AppSheets.tsx:213).
  it.fails('rejeita sparring.intensidade fora do enum Intensidade (tipos.ts:146 só checa isStr)', () => {
    expect(isWorkoutEntry({ ...treino(), sparring: { intensidade: 'extrema', cabeca: 'nenhum' } })).toBe(false)
  })

  it.fails('rejeita sparring.cabeca fora do enum ImpactoCabeca (tipos.ts:146 só checa isStr)', () => {
    expect(isWorkoutEntry({ ...treino(), sparring: { intensidade: 'leve', cabeca: 'muito' } })).toBe(false)
  })

  it.fails('rejeita sparring.parceiro que não seja texto', () => {
    expect(isWorkoutEntry({ ...treino(), sparring: { intensidade: 'leve', cabeca: 'nenhum', parceiro: 123 } })).toBe(false)
  })

  it.fails('rejeita sessaoId que não seja texto', () => {
    expect(isWorkoutEntry({ ...treino(), sessaoId: 99 })).toBe(false)
  })

  it.fails('rejeita nota que não seja texto', () => {
    expect(isWorkoutEntry({ ...treino(), nota: { x: 1 } })).toBe(false)
  })

  it.fails('rejeita rounds negativo', () => {
    expect(isWorkoutEntry({ ...treino(), rounds: -1 })).toBe(false)
  })

  it.fails('rejeita minPorRound negativo', () => {
    expect(isWorkoutEntry({ ...treino(), minPorRound: -3 })).toBe(false)
  })

  it.fails('rejeita duracaoSegundos negativa', () => {
    expect(isWorkoutEntry({ ...treino(), duracaoSegundos: -10 })).toBe(false)
  })

  it.fails('rejeita rpe fora da escala 1 a 10', () => {
    expect(isWorkoutEntry({ ...treino(), rpe: 15 })).toBe(false)
    expect(isWorkoutEntry({ ...treino(), rpe: -2 })).toBe(false)
  })
})

describe('isCheckin', () => {
  it('aceita o check-in válido completo', () => {
    expect(isCheckin(checkin())).toBe(true)
  })

  it('aceita os extremos 1 e 5 das notas', () => {
    expect(isCheckin({ data: '2026-01-01', sono: 1, dor: 5, energia: 5 })).toBe(true)
  })

  it('ignora campos desconhecidos', () => {
    expect(isCheckin({ ...checkin(), extra: true })).toBe(true)
  })

  it.each(NAO_OBJETOS)('rejeita %s', (_nome, valor) => {
    expect(isCheckin(valor)).toBe(false)
  })

  it.each(['data', 'sono', 'dor', 'energia'] as const)('rejeita quando falta %s', campo => {
    expect(isCheckin(sem(checkin(), campo))).toBe(false)
  })

  it.each([
    ['data em ISO completo', { data: '2026-03-10T12:00:00Z' }],
    ['data sem zeros', { data: '2026-3-10' }],
    ['data invertida', { data: '10/03/2026' }],
    ['data com texto extra no fim', { data: '2026-03-10 ' }],
    ['data com texto extra no início', { data: 'x2026-03-10' }],
    ['data numérica', { data: 20260310 }],
    ['sono em texto', { sono: '4' }],
    ['dor em texto', { dor: '2' }],
    ['energia null', { energia: null }],
  ])('rejeita %s', (_nome, troca) => {
    expect(isCheckin({ ...checkin(), ...troca })).toBe(false)
  })

  it.each(['sono', 'dor', 'energia'])('rejeita NaN e Infinity em %s', campo => {
    expect(isCheckin({ ...checkin(), [campo]: NaN })).toBe(false)
    expect(isCheckin({ ...checkin(), [campo]: Infinity })).toBe(false)
  })

  // Contrato em tipos.ts:91: "cada nota de 1 a 5".
  it.fails.each(['sono', 'dor', 'energia'])('rejeita %s fora da faixa 1 a 5', campo => {
    expect(isCheckin({ ...checkin(), [campo]: 9 })).toBe(false)
    expect(isCheckin({ ...checkin(), [campo]: -1 })).toBe(false)
  })
})

describe('isLesao', () => {
  it('aceita a lesão válida completa (com nota e resolvidaEm)', () => {
    expect(isLesao({ ...lesao(), nota: 'Dor ao fechar o punho', resolvidaEm: '2026-03-20' })).toBe(true)
  })

  it('aceita a lesão mínima, sem campos opcionais', () => {
    expect(isLesao(lesao())).toBe(true)
  })

  it.each(Object.keys(REGIOES))('aceita a região %s', regiao => {
    expect(isLesao({ ...lesao(), regiao })).toBe(true)
  })

  it.each(NAO_OBJETOS)('rejeita %s', (_nome, valor) => {
    expect(isLesao(valor)).toBe(false)
  })

  it.each(['id', 'regiao', 'intensidade', 'inicio'] as const)('rejeita quando falta %s', campo => {
    expect(isLesao(sem(lesao(), campo))).toBe(false)
  })

  it.each([
    ['id numérico', { id: 5 }],
    ['região fora do enum', { regiao: 'cotovelo' }],
    ['região vazia', { regiao: '' }],
    ['região numérica', { regiao: 1 }],
    ['região em maiúscula', { regiao: 'Punhos' }],
    ['intensidade em texto', { intensidade: '3' }],
    ['inicio em ISO completo', { inicio: '2026-03-01T00:00:00Z' }],
    ['inicio sem zeros', { inicio: '2026-3-1' }],
    ['inicio numérico', { inicio: 20260301 }],
  ])('rejeita %s', (_nome, troca) => {
    expect(isLesao({ ...lesao(), ...troca })).toBe(false)
  })

  it('rejeita NaN e Infinity na intensidade', () => {
    expect(isLesao({ ...lesao(), intensidade: NaN })).toBe(false)
    expect(isLesao({ ...lesao(), intensidade: Infinity })).toBe(false)
  })

  // `in` consulta a cadeia de protótipos: nomes herdados de Object.prototype não podem valer como região.
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'rejeita região herdada do protótipo: %s',
    regiao => {
      expect(isLesao({ ...lesao(), regiao })).toBe(false)
    },
  )

  // Contrato em tipos.ts:116: "1 (leve) a 5 (forte)".
  it.fails('rejeita intensidade fora da faixa 1 a 5', () => {
    expect(isLesao({ ...lesao(), intensidade: 99 })).toBe(false)
    expect(isLesao({ ...lesao(), intensidade: -1 })).toBe(false)
  })

  it.fails('rejeita nota que não seja texto', () => {
    expect(isLesao({ ...lesao(), nota: 123 })).toBe(false)
  })

  it.fails('rejeita resolvidaEm que não seja uma data YYYY-MM-DD', () => {
    expect(isLesao({ ...lesao(), resolvidaEm: 'ontem' })).toBe(false)
  })
})

describe('isPesoRegistro', () => {
  it('aceita o registro de peso válido', () => {
    expect(isPesoRegistro(peso())).toBe(true)
  })

  it('aceita peso fracionário pequeno, mas positivo', () => {
    expect(isPesoRegistro({ ...peso(), kg: 0.1 })).toBe(true)
  })

  it('ignora campos desconhecidos', () => {
    expect(isPesoRegistro({ ...peso(), extra: 1 })).toBe(true)
  })

  it.each(NAO_OBJETOS)('rejeita %s', (_nome, valor) => {
    expect(isPesoRegistro(valor)).toBe(false)
  })

  it.each(['id', 'data', 'kg'] as const)('rejeita quando falta %s', campo => {
    expect(isPesoRegistro(sem(peso(), campo))).toBe(false)
  })

  it.each([
    ['id numérico', { id: 1 }],
    ['data em ISO completo', { data: '2026-03-10T00:00:00Z' }],
    ['data sem zeros', { data: '2026-3-10' }],
    ['kg em texto', { kg: '72' }],
    ['kg null', { kg: null }],
  ])('rejeita %s', (_nome, troca) => {
    expect(isPesoRegistro({ ...peso(), ...troca })).toBe(false)
  })

  it.each([
    ['zero', 0],
    ['negativo', -70],
    ['NaN', NaN],
    ['Infinity', Infinity],
    ['-Infinity', -Infinity],
  ])('rejeita kg %s', (_nome, kg) => {
    expect(isPesoRegistro({ ...peso(), kg })).toBe(false)
  })
})

describe('validação de datas YYYY-MM-DD (isChave, via isCheckin)', () => {
  // isChave só confere o formato com regex, não se a data existe no calendário.
  it('aceita apenas o formato, sem checar o calendário (comportamento atual)', () => {
    expect(isCheckin({ ...checkin(), data: '2026-02-31' })).toBe(true)
  })

  it.fails('rejeita datas que não existem no calendário (ex.: 2026-13-45)', () => {
    expect(isCheckin({ ...checkin(), data: '2026-13-45' })).toBe(false)
  })
})

describe('isArrayDe', () => {
  const isArrayDeTipos = isArrayDe(isRegType)
  const isArrayDeTreinos = isArrayDe(isWorkoutEntry)

  it('aceita array vazio', () => {
    expect(isArrayDeTipos([])).toBe(true)
    expect(isArrayDeTreinos([])).toBe(true)
  })

  it('aceita array em que todos os itens são válidos', () => {
    expect(isArrayDeTipos(['tec', 'con', 'spa', 'tec'])).toBe(true)
    expect(isArrayDeTreinos([treino(), { ...treino(), tipo: 'spa' }])).toBe(true)
  })

  it('rejeita array com um único item inválido, em qualquer posição', () => {
    expect(isArrayDeTipos(['tec', 'xxx'])).toBe(false)
    expect(isArrayDeTipos(['xxx', 'tec', 'con'])).toBe(false)
    expect(isArrayDeTreinos([treino(), sem(treino(), 'rpe')])).toBe(false)
    expect(isArrayDeTreinos([null])).toBe(false)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['string', 'tec'],
    ['número', 3],
    ['objeto', { 0: 'tec', length: 1 }],
    ['objeto de treino', treino()],
  ])('rejeita não-array: %s', (_nome, valor) => {
    expect(isArrayDeTipos(valor)).toBe(false)
    expect(isArrayDeTreinos(valor)).toBe(false)
  })

  it('funciona com os demais validadores (check-ins, lesões e pesos)', () => {
    expect(isArrayDe(isCheckin)([checkin()])).toBe(true)
    expect(isArrayDe(isCheckin)([checkin(), lesao()])).toBe(false)
    expect(isArrayDe(isLesao)([lesao()])).toBe(true)
    expect(isArrayDe(isLesao)([{ ...lesao(), regiao: 'xx' }])).toBe(false)
    expect(isArrayDe(isPesoRegistro)([peso()])).toBe(true)
    expect(isArrayDe(isPesoRegistro)([{ ...peso(), kg: 0 }])).toBe(false)
  })

  it('cada chamada devolve um validador independente', () => {
    const soTipos = isArrayDe(isRegType)
    const soPesos = isArrayDe(isPesoRegistro)
    expect(soTipos(['tec'])).toBe(true)
    expect(soPesos(['tec'])).toBe(false)
  })

  it('array esparso com buracos conta só os itens existentes (comportamento de Array.every)', () => {
    expect(isArrayDeTipos(['tec', , 'con'])).toBe(true)
  })
})
