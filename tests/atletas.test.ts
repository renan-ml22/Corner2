import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { contraste } from './contraste'
import { ATLETAS, TAGS_DE_ESTILO, atletaPorId, iniciaisDoAtleta } from '@/data/atletas'

describe('atletas: o conjunto', () => {
  it('são os dez combinados, nesta ordem', () => {
    expect(ATLETAS.map(a => a.id)).toEqual(['ali', 'tyson', 'mayweather', 'pacquiao', 'stevenson', 'robinson', 'frazier', 'foreman', 'canelo', 'conceicao'])
    expect(ATLETAS.map(a => a.nome)).toEqual([
      'Muhammad Ali', 'Mike Tyson', 'Floyd Mayweather Jr.', 'Manny Pacquiao', 'Teófilo Stevenson',
      'Sugar Ray Robinson', 'Joe Frazier', 'George Foreman', 'Canelo Álvarez', 'Robson Conceição',
    ])
  })

  it('ids únicos, em minúsculas e sem espaços (vão para o endereço /atletas/[id])', () => {
    const ids = ATLETAS.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/)
  })

  it('o estilo de cada um é o combinado', () => {
    const estilos = Object.fromEntries(ATLETAS.map(a => [a.id, a.estilo]))
    expect(estilos).toEqual({
      ali: 'Out-boxer', tyson: 'Swarmer', mayweather: 'Counter-puncher', pacquiao: 'Southpaw agressivo', stevenson: 'Power puncher',
      robinson: 'All-around', frazier: 'Swarmer resistente', foreman: 'Slugger', canelo: 'Counter-puncher moderno', conceicao: 'Boxeador veloz',
    })
  })
})

describe('atletas: cada um', () => {
  it.each(ATLETAS.map(a => [a.nome, a] as const))('%s tem descrição, 4 características, 3 pontos fortes e uma cor', (_nome, a) => {
    expect(a.descricao.trim().length).toBeGreaterThan(40)
    expect(a.descricao.length).toBeLessThan(220)
    expect(a.caracteristicas).toHaveLength(4)
    expect(new Set(a.caracteristicas).size).toBe(4)
    for (const c of a.caracteristicas) expect(c.trim().length).toBeGreaterThan(5)
    expect(a.pontosFortes).toHaveLength(3)
    expect(new Set(a.pontosFortes).size).toBe(3)
    expect(a.corPrimaria).toMatch(/^oklch\(0?\.\d+ 0?\.\d+ \d+\)$/)
  })

  it('os pontos fortes são de uma lista conhecida (um erro de digitação faria o atleta nunca combinar com o quiz)', () => {
    for (const a of ATLETAS) for (const p of a.pontosFortes) expect(TAGS_DE_ESTILO, `${a.id}: ${p}`).toContain(p)
  })

  it('a descrição não faz promessa de resultado nem afirma vínculo com o atleta', () => {
    const tudo = ATLETAS.map(a => a.descricao).join(' ')
    expect(tudo).not.toMatch(/endossad|oficial|parceria|aprovad/i)
  })
})

describe('atletaPorId', () => {
  it('acha pelo id e devolve a mesma referência', () => {
    for (const a of ATLETAS) expect(atletaPorId(a.id)).toBe(a)
  })

  it('id desconhecido, vazio, com maiúscula ou com tentativa de caminho: null', () => {
    for (const id of ['nao-existe', '', 'Ali', ' ali', '../ali', 'ali/..', undefined, null]) expect(atletaPorId(id as never), String(id)).toBeNull()
  })
})

describe('iniciaisDoAtleta (a bolinha com a cor do atleta, no lugar de uma foto)', () => {
  it.each([
    ['Muhammad Ali', 'MA'], ['Mike Tyson', 'MT'], ['Floyd Mayweather Jr.', 'FM'], ['Sugar Ray Robinson', 'SR'],
    ['Teófilo Stevenson', 'TS'], ['Canelo Álvarez', 'CÁ'], ['Robson Conceição', 'RC'],
  ])('%s -> %s', (nome, iniciais) => {
    expect(iniciaisDoAtleta(nome)).toBe(iniciais)
  })

  it('nome de uma palavra só e nome vazio não quebram', () => {
    expect(iniciaisDoAtleta('Pelé')).toBe('P')
    expect(iniciaisDoAtleta('')).toBe('')
  })
})

describe('atletas: fatos e cores', () => {
  it('Robson Conceição luta na guarda ortodoxa: nenhum texto o chama de canhoto (southpaw)', () => {
    const c = atletaPorId('conceicao')!
    expect([c.estilo, c.descricao, ...c.caracteristicas].join(' ')).not.toMatch(/southpaw|canhot/i)
    expect(c.estilo).toBe('Boxeador veloz')
  })

  it('Manny Pacquiao, esse sim canhoto, continua como southpaw', () => {
    expect(atletaPorId('pacquiao')!.estilo).toMatch(/southpaw/i)
  })

  it('nenhum par de atletas tem a mesma cor (duas bolinhas iguais no resultado do quiz confundem)', () => {
    const cores = ATLETAS.map(a => a.corPrimaria)
    expect(new Set(cores).size).toBe(cores.length)
  })
})

describe('atletas: contraste do texto escuro sobre a cor de cada bolinha (WCAG, mínimo 4,5:1)', () => {
  const css = readFileSync(path.resolve(__dirname, '../components/AtletaAvatar.module.css'), 'utf8')
  const corDoTexto = /color:\s*(oklch\([^)]*\))/.exec(css)?.[1]

  it('o texto da bolinha é uma cor oklch escura, definida no CSS do avatar', () => {
    expect(corDoTexto).toBeDefined()
  })

  it.each(ATLETAS.map(a => [a.nome, a.corPrimaria] as const))('%s', (_nome, cor) => {
    expect(contraste(corDoTexto!, cor)).toBeGreaterThanOrEqual(4.5)
  })
})
