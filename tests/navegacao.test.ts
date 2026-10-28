import { describe, expect, it } from 'vitest'
import { abaAtiva, textoDoSeloDeAlunos, descricaoDoSeloDeAlunos } from '@/lib/navegacao'

// Qual aba da barra de baixo fica acesa em cada tela. Exercícios, quiz e atletas moram na aba Plano.

describe('abaAtiva', () => {
  it.each([
    ['/hoje', '/hoje'],
    ['/plano', '/plano'],
    ['/timer', '/timer'],
    ['/progresso', '/progresso'],
    ['/perfil', '/perfil'],
    ['/alunos', '/alunos'],
  ])('%s acende a própria aba', (caminho, aba) => {
    expect(abaAtiva(caminho)).toBe(aba)
  })

  it.each(['/exercicios', '/exercicios/', '/quiz', '/atletas/ali', '/atletas/conceicao'])('%s acende a aba Plano', caminho => {
    expect(abaAtiva(caminho)).toBe('/plano')
  })

  it.each(['/alunos', '/alunos/novo', '/alunos/3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c'])('%s (área do treinador) acende a aba Alunos', caminho => {
    expect(abaAtiva(caminho)).toBe('/alunos')
  })

  it('/alunos-x e /alunosx não acendem nada', () => {
    expect(abaAtiva('/alunos-x')).toBeNull()
    expect(abaAtiva('/alunosx')).toBeNull()
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

describe('selo vermelho da aba Alunos', () => {
  it('sem alunos parados, não há selo', () => {
    expect(textoDoSeloDeAlunos(0)).toBeNull()
    expect(descricaoDoSeloDeAlunos(0)).toBeNull()
  })

  it('mostra o número; acima de 9, "9+" para caber no círculo', () => {
    expect(textoDoSeloDeAlunos(1)).toBe('1')
    expect(textoDoSeloDeAlunos(9)).toBe('9')
    expect(textoDoSeloDeAlunos(10)).toBe('9+')
    expect(textoDoSeloDeAlunos(20)).toBe('9+')
  })

  it('a descrição para leitor de tela diz o número exato, no singular e no plural', () => {
    expect(descricaoDoSeloDeAlunos(1)).toBe('1 aluno sem treinar há 7 dias ou mais')
    expect(descricaoDoSeloDeAlunos(12)).toBe('12 alunos sem treinar há 7 dias ou mais')
  })

  it('valor que não faz sentido (negativo, quebrado, NaN) não vira selo', () => {
    for (const n of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(textoDoSeloDeAlunos(n)).toBeNull()
      expect(descricaoDoSeloDeAlunos(n)).toBeNull()
    }
  })
})
