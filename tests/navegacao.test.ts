import { describe, expect, it } from 'vitest'
import { abaAtiva } from '@/lib/navegacao'

// Qual aba da barra de baixo fica acesa em cada tela. Exercícios, quiz e atletas moram na aba Plano.

describe('abaAtiva', () => {
  it.each([
    ['/hoje', '/hoje'],
    ['/plano', '/plano'],
    ['/timer', '/timer'],
    ['/progresso', '/progresso'],
    ['/perfil', '/perfil'],
  ])('%s acende a própria aba', (caminho, aba) => {
    expect(abaAtiva(caminho)).toBe(aba)
  })

  it.each(['/exercicios', '/exercicios/', '/quiz', '/atletas/ali', '/atletas/conceicao'])('%s acende a aba Plano', caminho => {
    expect(abaAtiva(caminho)).toBe('/plano')
  })

  it('subtelas de uma aba continuam nela', () => {
    expect(abaAtiva('/plano/qualquer-coisa')).toBe('/plano')
    expect(abaAtiva('/perfil/editar')).toBe('/perfil')
  })

  it('o cronômetro do plano (/treino) não acende a aba Timer: é outra tela, em tela cheia', () => {
    expect(abaAtiva('/treino')).toBeNull()
  })

  it.each(['/', '/tecnicas', '/saude', '/assinatura', '/treino', '/login'])('%s não acende nenhuma aba', caminho => {
    expect(abaAtiva(caminho)).toBeNull()
  })

  it('compara por trecho do endereço, não por começo de texto: /planos-x e /exercicios-x não acendem nada', () => {
    expect(abaAtiva('/planos-x')).toBeNull()
    expect(abaAtiva('/exercicios-extra')).toBeNull()
    expect(abaAtiva('/quizzes')).toBeNull()
    expect(abaAtiva('/atletas-x/ali')).toBeNull()
    expect(abaAtiva('/hojeee')).toBeNull()
    expect(abaAtiva('/timers')).toBeNull()
  })
})
