import { describe, expect, it } from 'vitest'
import { proximoIndice } from '@/lib/teclado'

describe('proximoIndice (setas em grupos de rádio e abas)', () => {
  it('seta para a direita ou para baixo avança', () => {
    expect(proximoIndice(0, 4, 'ArrowRight')).toBe(1)
    expect(proximoIndice(1, 4, 'ArrowDown')).toBe(2)
  })

  it('seta para a esquerda ou para cima volta', () => {
    expect(proximoIndice(2, 4, 'ArrowLeft')).toBe(1)
    expect(proximoIndice(3, 4, 'ArrowUp')).toBe(2)
  })

  it('volta ao começo depois do último e vai ao fim antes do primeiro', () => {
    expect(proximoIndice(3, 4, 'ArrowRight')).toBe(0)
    expect(proximoIndice(0, 4, 'ArrowLeft')).toBe(3)
  })

  it('Home vai ao primeiro e End ao último', () => {
    expect(proximoIndice(2, 5, 'Home')).toBe(0)
    expect(proximoIndice(1, 5, 'End')).toBe(4)
  })

  it('outras teclas não movem nada', () => {
    for (const tecla of ['Enter', ' ', 'Tab', 'a', 'Escape']) expect(proximoIndice(1, 4, tecla)).toBeNull()
  })

  it('com um único item, as setas ficam nele', () => {
    expect(proximoIndice(0, 1, 'ArrowRight')).toBe(0)
    expect(proximoIndice(0, 1, 'ArrowLeft')).toBe(0)
  })

  it('sem itens ou com índice inválido, não faz nada', () => {
    expect(proximoIndice(0, 0, 'ArrowRight')).toBeNull()
    expect(proximoIndice(-1, 4, 'ArrowRight')).toBeNull()
    expect(proximoIndice(4, 4, 'ArrowRight')).toBeNull()
  })
})
