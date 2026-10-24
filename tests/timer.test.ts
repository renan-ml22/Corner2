import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { contraste } from './contraste'
import {
  CHAVE_DO_TIMER, CONFIG_PADRAO, configDeTexto, DESCANSOS_SEG, LIMITES, duracaoTotal, formatarTempo, gravarConfig, lerConfig, normalizarConfig,
  rotuloDaFase, rotuloDoDescanso, somarRoundSeg, somarRounds, type ConfigTimer,
} from '@/lib/timer'

// Configuração do cronômetro livre (aba Timer): limites, padrão, validação do que vem do aparelho e textos.

describe('padrão e limites', () => {
  it('começa com 3 rounds de 3 minutos, descanso de 1 minuto, preparo de 10 s ligado, vibração ligada e som ligado', () => {
    expect(CONFIG_PADRAO).toEqual({ rounds: 3, roundSeg: 180, descansoSeg: 60, preparo: true, vibracao: true, volume: 80, mudo: false })
  })

  it('rounds de 1 a 20; round de 1 a 5 minutos em passos de 30 s; descanso de 30 s, 1, 2 ou 3 minutos', () => {
    expect(LIMITES.rounds).toEqual({ min: 1, max: 20 })
    expect(LIMITES.roundSeg).toEqual({ min: 60, max: 300, passo: 30 })
    expect([...DESCANSOS_SEG]).toEqual([30, 60, 120, 180])
  })
})

describe('somarRounds', () => {
  it('soma e subtrai de um em um', () => {
    expect(somarRounds(3, 1)).toBe(4)
    expect(somarRounds(3, -1)).toBe(2)
  })
  it('não passa de 20 nem desce de 1', () => {
    expect(somarRounds(20, 1)).toBe(20)
    expect(somarRounds(1, -1)).toBe(1)
    expect(somarRounds(19, 5)).toBe(20)
  })
})

describe('somarRoundSeg', () => {
  it('anda de 30 em 30 segundos', () => {
    expect(somarRoundSeg(180, 1)).toBe(210)
    expect(somarRoundSeg(180, -1)).toBe(150)
    expect(somarRoundSeg(60, 1)).toBe(90)
  })
  it('fica entre 1:00 e 5:00', () => {
    expect(somarRoundSeg(300, 1)).toBe(300)
    expect(somarRoundSeg(60, -1)).toBe(60)
  })
})

describe('formatarTempo', () => {
  it.each([[0, '00:00'], [5, '00:05'], [60, '01:00'], [90, '01:30'], [180, '03:00'], [300, '05:00'], [3599, '59:59'], [3600, '60:00']])('%i s -> %s', (seg, texto) => {
    expect(formatarTempo(seg)).toBe(texto)
  })
  it('valor negativo ou quebrado não gera texto estranho', () => {
    expect(formatarTempo(-3)).toBe('00:00')
    expect(formatarTempo(59.6)).toBe('01:00')
    expect(formatarTempo(Number.NaN)).toBe('00:00')
  })
})

describe('rotuloDoDescanso e rotuloDaFase', () => {
  it('descanso: 30 s, 1 min, 2 min, 3 min', () => {
    expect(DESCANSOS_SEG.map(rotuloDoDescanso)).toEqual(['30 s', '1 min', '2 min', '3 min'])
  })
  it('as fases têm o nome em maiúsculas pedido', () => {
    expect(rotuloDaFase('preparo')).toBe('PREPARAÇÃO')
    expect(rotuloDaFase('round')).toBe('ROUND')
    expect(rotuloDaFase('descanso')).toBe('DESCANSO')
    expect(rotuloDaFase('fim')).toBe('FIM')
    expect(rotuloDaFase('pronto')).toBe('PRONTO')
  })
})

describe('duracaoTotal', () => {
  it('padrão: 10 s de preparo + 3 rounds de 3 min + 2 descansos de 1 min = 11 min 10 s', () => {
    expect(duracaoTotal(CONFIG_PADRAO)).toBe(10 + 3 * 180 + 2 * 60)
  })
  it('sem preparo, não conta os 10 s', () => {
    expect(duracaoTotal({ ...CONFIG_PADRAO, preparo: false })).toBe(3 * 180 + 2 * 60)
  })
  it('com um round só, não há descanso', () => {
    expect(duracaoTotal({ ...CONFIG_PADRAO, rounds: 1 })).toBe(10 + 180)
  })
})

describe('normalizarConfig: o que vem do aparelho pode estar velho, quebrado ou adulterado', () => {
  it('uma configuração válida passa igual', () => {
    const c: ConfigTimer = { rounds: 12, roundSeg: 120, descansoSeg: 30, preparo: false, vibracao: false, volume: 35, mudo: true }
    expect(normalizarConfig(c)).toEqual(c)
  })

  it.each([null, undefined, 'texto', 42, true, [], [1, 2]])('%s vira o padrão', valor => {
    expect(normalizarConfig(valor)).toEqual(CONFIG_PADRAO)
  })

  it('campo por campo: o que está errado volta ao padrão, o que está certo fica', () => {
    const r = normalizarConfig({ rounds: 'oito', roundSeg: 120, descansoSeg: 45, preparo: 'sim', vibracao: false, volume: 'alto', mudo: 1 })
    expect(r).toEqual({ ...CONFIG_PADRAO, roundSeg: 120, vibracao: false })
  })

  it('números fora do limite são ajustados ao limite mais próximo', () => {
    expect(normalizarConfig({ rounds: 99 }).rounds).toBe(20)
    expect(normalizarConfig({ rounds: 0 }).rounds).toBe(1)
    expect(normalizarConfig({ rounds: -4 }).rounds).toBe(1)
    expect(normalizarConfig({ roundSeg: 9999 }).roundSeg).toBe(300)
    expect(normalizarConfig({ roundSeg: 10 }).roundSeg).toBe(60)
    expect(normalizarConfig({ volume: 250 }).volume).toBe(100)
    expect(normalizarConfig({ volume: -5 }).volume).toBe(0)
  })

  it('números quebrados são arredondados: rounds ao inteiro, round ao passo de 30 s, volume ao inteiro', () => {
    expect(normalizarConfig({ rounds: 5.6 }).rounds).toBe(6)
    expect(normalizarConfig({ roundSeg: 100 }).roundSeg).toBe(90)
    expect(normalizarConfig({ roundSeg: 110 }).roundSeg).toBe(120)
    expect(normalizarConfig({ volume: 42.4 }).volume).toBe(42)
  })

  it('NaN, Infinity e texto nos números voltam ao padrão', () => {
    for (const ruim of [Number.NaN, Infinity, -Infinity, '5', null]) {
      expect(normalizarConfig({ rounds: ruim, roundSeg: ruim, volume: ruim }), String(ruim)).toEqual(CONFIG_PADRAO)
    }
  })

  it('descanso fora da lista (30, 60, 120, 180) volta ao padrão', () => {
    for (const ruim of [0, 45, 90, 240, -60]) expect(normalizarConfig({ descansoSeg: ruim }).descansoSeg, String(ruim)).toBe(60)
  })

  it('campos desconhecidos e chaves perigosas são ignorados', () => {
    const r = normalizarConfig(JSON.parse('{"rounds":4,"__proto__":{"x":1},"constructor":"x","extra":9}'))
    expect(r).toEqual({ ...CONFIG_PADRAO, rounds: 4 })
    expect(Object.keys(r).sort()).toEqual(Object.keys(CONFIG_PADRAO).sort())
  })

  it('não altera o objeto recebido', () => {
    const entrada = { rounds: 99 }
    normalizarConfig(entrada)
    expect(entrada).toEqual({ rounds: 99 })
  })
})

describe('guardar e ler no aparelho (localStorage)', () => {
  const armazemDe = (inicial: Record<string, string> = {}) => {
    const dados = { ...inicial }
    return { dados, getItem: (k: string) => dados[k] ?? null, setItem: (k: string, v: string) => { dados[k] = v } }
  }

  it('o que foi gravado volta igual', () => {
    const a = armazemDe()
    const c: ConfigTimer = { rounds: 8, roundSeg: 150, descansoSeg: 120, preparo: false, vibracao: true, volume: 55, mudo: false }
    gravarConfig(a, c)
    expect(Object.keys(a.dados)).toEqual([CHAVE_DO_TIMER])
    expect(lerConfig(a)).toEqual(c)
  })

  it('sem nada guardado: padrão', () => {
    expect(lerConfig(armazemDe())).toEqual(CONFIG_PADRAO)
  })

  it('texto que não é JSON, ou JSON de outro tipo: padrão, sem quebrar', () => {
    for (const lixo of ['{quebrado', '', 'null', '"oi"', '[1,2]', '42']) {
      expect(lerConfig(armazemDe({ [CHAVE_DO_TIMER]: lixo })), lixo).toEqual(CONFIG_PADRAO)
    }
  })

  it('armazenamento que lança erro (navegação privada, bloqueado, cheio) não derruba a tela', () => {
    const quebrado = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('cheio') } }
    expect(lerConfig(quebrado)).toEqual(CONFIG_PADRAO)
    expect(() => gravarConfig(quebrado, CONFIG_PADRAO)).not.toThrow()
  })

  it('sem armazenamento nenhum (null): padrão e sem erro', () => {
    expect(lerConfig(null)).toEqual(CONFIG_PADRAO)
    expect(() => gravarConfig(null, CONFIG_PADRAO)).not.toThrow()
  })
})

describe('configDeTexto', () => {
  it('lê o JSON guardado e valida', () => {
    expect(configDeTexto(JSON.stringify({ rounds: 7, volume: 400 }))).toEqual({ ...CONFIG_PADRAO, rounds: 7, volume: 100 })
  })
  it.each([null, undefined, '', '{quebrado', '[]'])('%s vira o padrão', texto => {
    expect(configDeTexto(texto)).toEqual(CONFIG_PADRAO)
  })
})

describe('cores das fases: o texto escuro tem contraste suficiente (WCAG 4,5:1) sobre cada fundo', () => {
  const css = readFileSync(path.resolve(__dirname, '../app/(app)/timer/timer.module.css'), 'utf8')
  const bloco = (nome: string) => new RegExp(`\\.${nome}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? ''
  const cor = (nome: string, variavel: string) => new RegExp(`--${variavel}:\\s*(oklch\\([^)]*\\))`).exec(bloco(nome))?.[1]

  it.each([
    ['preparo', 'oklch(0.66 0.16 258)'],
    ['round', 'oklch(0.63 0.21 25)'],
    ['descanso', 'oklch(0.72 0.15 150)'],
  ])('a fase %s usa o fundo combinado (%s)', (fase, fundo) => {
    expect(cor(fase, 'fundo')).toBe(fundo)
  })

  it.each(['preparo', 'round', 'descanso'])('a fase %s: texto legível sobre o fundo', fase => {
    const fundo = cor(fase, 'fundo')
    const texto = cor(fase, 'texto')
    expect(fundo, `--fundo de ${fase}`).toBeDefined()
    expect(texto, `--texto de ${fase}`).toBeDefined()
    expect(contraste(fundo!, texto!)).toBeGreaterThanOrEqual(4.5)
  })

  it('a fase fim usa a cor neutra do app (var(--color-surface))', () => {
    expect(bloco('fim')).toMatch(/--fundo:\s*var\(--color-surface\)/)
  })
})
