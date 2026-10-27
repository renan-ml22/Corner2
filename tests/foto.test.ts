import { describe, expect, it } from 'vitest'
import {
  LADO_DA_FOTO, QUALIDADE_DA_FOTO, TAMANHO_MAX_DO_ARQUIVO, inicialDoNome, prepararFoto, recorteCentral,
} from '@/lib/foto'

// Foto de perfil: o recorte quadrado, a inicial que aparece sem foto e as recusas feitas antes de decodificar a imagem.
// A decodificação e o desenho no canvas só existem no navegador e são cobertos por e2e/foto-perfil.spec.ts.

describe('medidas da foto', () => {
  it('200×200 pixels, JPEG com qualidade 0,8, arquivo de entrada de até 15 MB', () => {
    expect(LADO_DA_FOTO).toBe(200)
    expect(QUALIDADE_DA_FOTO).toBe(0.8)
    expect(TAMANHO_MAX_DO_ARQUIVO).toBe(15_000_000)
  })
})

describe('recorteCentral: o maior quadrado, no centro da imagem', () => {
  it.each([
    ['paisagem', 400, 200, { x: 100, y: 0, lado: 200 }],
    ['retrato', 200, 400, { x: 0, y: 100, lado: 200 }],
    ['já quadrada', 300, 300, { x: 0, y: 0, lado: 300 }],
    ['largura ímpar (posições em inteiros)', 401, 200, { x: 100, y: 0, lado: 200 }],
    ['altura ímpar (posições em inteiros)', 200, 401, { x: 0, y: 100, lado: 200 }],
    ['muito comprida', 4000, 100, { x: 1950, y: 0, lado: 100 }],
  ])('%s (%i × %i)', (_nome, largura, altura, esperado) => {
    expect(recorteCentral(largura, altura)).toEqual(esperado)
  })

  it.each([[0, 100], [100, 0], [Number.NaN, 100], [100, Number.NaN], [-5, 5], [Infinity, 10]])('medidas inválidas (%s × %s): lado 0', (largura, altura) => {
    expect(recorteCentral(largura, altura).lado).toBe(0)
  })
})

describe('inicialDoNome: a letra do avatar quando não há foto', () => {
  it.each([
    ['renan', 'R'],
    ['  ana', 'A'],
    ['éder', 'É'],
    ['Beto Silva', 'B'],
  ])('%j vira %s', (nome, inicial) => {
    expect(inicialDoNome(nome)).toBe(inicial)
  })

  it('nome começando por emoji: usa o emoji inteiro, nunca metade dele', () => {
    expect(inicialDoNome('🥊 Beto')).toBe('🥊')
    expect(inicialDoNome('👨‍👩‍👧 Família')).not.toMatch(/[\uD800-\uDFFF]$/u)
    expect(Array.from(inicialDoNome('🥊 Beto'))).toHaveLength(1)
  })

  it.each(['', '   ', '\n\t'])('nome vazio (%j): ponto de interrogação', nome => {
    expect(inicialDoNome(nome)).toBe('?')
  })
})

describe('prepararFoto: recusa o que não presta antes de gastar tempo decodificando', () => {
  it('arquivo que não é imagem', async () => {
    const r = await prepararFoto(new File(['texto'], 'a.txt', { type: 'text/plain' }))
    expect(r).toEqual({ ok: false, erro: 'nao_e_imagem' })
  })

  it('arquivo sem tipo informado', async () => {
    const r = await prepararFoto(new File(['x'], 'sem-tipo'))
    expect(r).toEqual({ ok: false, erro: 'nao_e_imagem' })
  })

  it('imagem maior que 15 MB', async () => {
    const grande = new File(['x'], 'enorme.png', { type: 'image/png' })
    Object.defineProperty(grande, 'size', { value: TAMANHO_MAX_DO_ARQUIVO + 1 })
    expect(await prepararFoto(grande)).toEqual({ ok: false, erro: 'muito_grande' })
  })

  it('imagem que o ambiente não consegue decodificar: ilegível, sem lançar erro', async () => {
    // Fora do navegador não há createImageBitmap/canvas: o resultado tem que ser uma recusa, e não uma exceção.
    const r = await prepararFoto(new File(['isto não é um png'], 'quebrada.png', { type: 'image/png' }))
    expect(r).toEqual({ ok: false, erro: 'ilegivel' })
  })
})
