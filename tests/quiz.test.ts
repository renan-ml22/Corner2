import { describe, expect, it } from 'vitest'
import { PERGUNTAS } from '@/data/quiz'
import { ATLETAS } from '@/data/atletas'
import { compatibilidades, pontosDasRespostas, respostasDaUrl, respostasValidas, resultadoDoQuiz, serializarRespostas, tetoDoAtleta } from '@/lib/quiz'

// As cinco perguntas do quiz de estilo, com os pontos de cada resposta, tal como combinado.

type Tabela = { pergunta: string; opcoes: { texto: string; pontos: Record<string, number> }[] }[]

const COMBINADO: Tabela = [
  { pergunta: 'Em uma luta, onde você se sente mais confortável?', opcoes: [
    { texto: 'Longe, controlando com o jab e me movimentando', pontos: { footwork: 2 } },
    { texto: 'Perto, trocando golpes e usando o corpo', pontos: { pressao: 2 } },
    { texto: 'No meio-campo, esperando o momento certo', pontos: { counter: 2 } },
  ] },
  { pergunta: 'Qual é o seu maior trunfo?', opcoes: [
    { texto: 'Velocidade e reflexos', pontos: { velocidade: 2 } },
    { texto: 'Potência e força', pontos: { potencia: 2 } },
    { texto: 'Técnica e inteligência', pontos: { tecnica: 2 } },
    { texto: 'Resistência e volume', pontos: { resistencia: 2 } },
  ] },
  { pergunta: 'Quando o adversário te pressiona, você:', opcoes: [
    { texto: 'Recuo, crio distância e reorganizo', pontos: { footwork: 2, defesa: 1 } },
    { texto: 'Clincho e trato para ganhar tempo', pontos: { 'inside-fighting': 2 } },
    { texto: 'Contra-ataco imediatamente', pontos: { counter: 2 } },
    { texto: 'Avanço ainda mais e pressiono de volta', pontos: { pressao: 2 } },
  ] },
  { pergunta: 'Onde você prefere atacar?', opcoes: [
    { texto: 'Cabeça — busco o nocaute', pontos: { potencia: 1 } },
    { texto: 'Corpo — queimo o adversário', pontos: { corpo: 2 } },
    { texto: 'Combino os dois com estratégia', pontos: { tecnica: 2 } },
  ] },
  { pergunta: 'Como seria sua luta perfeita?', opcoes: [
    { texto: 'Controle total de distância e ritmo', pontos: { footwork: 2, tecnica: 1 } },
    { texto: 'Explosão no começo, pressão constante', pontos: { pressao: 2, potencia: 1 } },
    { texto: 'Paciência, esperar o erro e punir', pontos: { counter: 2, defesa: 1 } },
    { texto: 'Guerra de volume, quem aguentar mais', pontos: { resistencia: 2 } },
  ] },
]

describe('perguntas do quiz: o que foi combinado', () => {
  it('são cinco, com 3, 4, 4, 3 e 4 respostas', () => {
    expect(PERGUNTAS).toHaveLength(5)
    expect(PERGUNTAS.map(p => p.opcoes.length)).toEqual([3, 4, 4, 3, 4])
  })

  it('cada pergunta, resposta e pontuação é exatamente a combinada', () => {
    const lido = PERGUNTAS.map(p => ({ pergunta: p.pergunta, opcoes: p.opcoes.map(o => ({ texto: o.texto, pontos: o.pontos })) }))
    expect(lido).toEqual(COMBINADO)
  })

  it('cada pergunta tem um assunto, e cada resposta tem um ícone do Phosphor e um id único', () => {
    for (const p of PERGUNTAS) {
      expect(p.assunto.trim().length).toBeGreaterThan(3)
      expect(new Set(p.opcoes.map(o => o.id)).size).toBe(p.opcoes.length)
      for (const o of p.opcoes) expect(o.icone).toMatch(/^ph-[a-z-]+$/)
    }
    expect(PERGUNTAS.map(p => p.assunto)).toEqual(['Distância preferida', 'Arma principal', 'Sob pressão', 'Alvo preferido', 'Luta ideal'])
  })

  it('só pontuam categorias que algum atleta tem como ponto forte (senão o ponto se perderia)', () => {
    const dosAtletas = new Set(ATLETAS.flatMap(a => a.pontosFortes))
    for (const p of PERGUNTAS) for (const o of p.opcoes) for (const tag of Object.keys(o.pontos)) expect(dosAtletas.has(tag as never), tag).toBe(true)
  })
})

describe('respostasValidas', () => {
  it('aceita uma resposta por pergunta, com índices que existem', () => {
    expect(respostasValidas([0, 0, 0, 0, 0])).toBe(true)
    expect(respostasValidas([2, 3, 3, 2, 3])).toBe(true)
  })

  it.each([
    ['curta', [0, 0, 0, 0]],
    ['comprida', [0, 0, 0, 0, 0, 0]],
    ['índice fora da pergunta 1 (só há 3)', [3, 0, 0, 0, 0]],
    ['índice negativo', [-1, 0, 0, 0, 0]],
    ['índice fracionado', [0.5, 0, 0, 0, 0]],
    ['NaN', [Number.NaN, 0, 0, 0, 0]],
    ['faltando uma resposta', [0, 0, null, 0, 0]],
  ])('recusa resposta %s', (_nome, respostas) => {
    expect(respostasValidas(respostas as never)).toBe(false)
  })

  it('recusa o que nem é uma lista', () => {
    expect(respostasValidas(null as never)).toBe(false)
    expect(respostasValidas('00000' as never)).toBe(false)
  })
})

describe('pontosDasRespostas', () => {
  it('soma os pontos por categoria', () => {
    // Longe (footwork 2) + velocidade (2) + recuo (footwork 2, defesa 1) + técnica (2) + controle total (footwork 2, técnica 1)
    expect(pontosDasRespostas([0, 0, 0, 2, 0])).toEqual({ footwork: 6, velocidade: 2, defesa: 1, tecnica: 3 })
  })

  it('o total de pontos de uma pessoa nunca é zero, em nenhuma das 576 combinações', () => {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 3; d++) for (let e = 0; e < 4; e++) {
      expect(Object.values(pontosDasRespostas([a, b, c, d, e])).reduce((x, y) => x + y, 0)).toBeGreaterThan(0)
    }
  })
})

describe('tetoDoAtleta: o máximo de pontos que as respostas podem dar a ele', () => {
  it('é o melhor caso em cada pergunta, somado', () => {
    const teto = Object.fromEntries(ATLETAS.map(a => [a.id, tetoDoAtleta(a)]))
    expect(teto).toEqual({ ali: 11, tyson: 10, mayweather: 11, pacquiao: 8, stevenson: 4, robinson: 5, frazier: 8, foreman: 10, canelo: 9, conceicao: 2 })
  })
})

describe('resultado do quiz', () => {
  it('quem responde como um out-boxer (longe, velocidade, recuo, técnica, controle total) combina mais com Muhammad Ali', () => {
    const r = resultadoDoQuiz([0, 0, 0, 2, 0])!
    expect(r.primeiro.atleta.id).toBe('ali')
    expect(r.primeiro.percentual).toBeGreaterThanOrEqual(90)
  })

  it('quem responde como um pressionador (perto, potência, clinch, cabeça, explosão) combina 100% com Mike Tyson', () => {
    const r = resultadoDoQuiz([1, 1, 1, 0, 1])!
    expect(r.primeiro.atleta.id).toBe('tyson')
    expect(r.primeiro.percentual).toBe(100)
  })

  it('quem responde como um contra-atacante (meio-campo, técnica, contra-ataca, técnica, paciência) combina 100% com Floyd Mayweather', () => {
    const r = resultadoDoQuiz([2, 2, 2, 2, 2])!
    expect(r.primeiro.atleta.id).toBe('mayweather')
    expect(r.primeiro.percentual).toBe(100)
  })

  it('devolve DOIS atletas diferentes, o mais compatível primeiro, com percentuais inteiros entre 0 e 100', () => {
    for (const respostas of [[0, 0, 0, 0, 0], [2, 3, 3, 2, 3], [1, 2, 2, 1, 0]]) {
      const r = resultadoDoQuiz(respostas)!
      expect(r.primeiro.atleta.id).not.toBe(r.segundo.atleta.id)
      expect(r.primeiro.percentual).toBeGreaterThanOrEqual(r.segundo.percentual)
      for (const c of [r.primeiro, r.segundo]) {
        expect(Number.isInteger(c.percentual)).toBe(true)
        expect(c.percentual).toBeGreaterThan(0)
        expect(c.percentual).toBeLessThanOrEqual(100)
      }
    }
  })

  it('resposta inválida não gera resultado', () => {
    expect(resultadoDoQuiz([0, 0, 0])).toBeNull()
    expect(resultadoDoQuiz([9, 9, 9, 9, 9])).toBeNull()
  })

  it('é determinístico e não altera o que recebe', () => {
    const entrada = [1, 2, 3, 1, 2]
    const copia = [...entrada]
    expect(resultadoDoQuiz(entrada)).toEqual(resultadoDoQuiz(entrada))
    expect(entrada).toEqual(copia)
  })

  it('compatibilidades lista os dez atletas, do mais para o menos compatível', () => {
    const lista = compatibilidades([0, 1, 2, 1, 3])
    expect(lista).toHaveLength(10)
    expect(new Set(lista.map(c => c.atleta.id)).size).toBe(10)
    for (let i = 1; i < lista.length; i++) expect(lista[i - 1].percentual).toBeGreaterThanOrEqual(lista[i].percentual)
  })
})

describe('o quiz é justo com os dez atletas', () => {
  // As características alcance, físico, adaptação, reflexo e combinações não recebem pontos de nenhuma resposta.
  // Uma fórmula ingênua (só somar os pontos) fazia Robson Conceição NUNCA aparecer e Stevenson aparecer 1 vez em 576.
  const caminhos: number[][] = []
  ;(function gerar(i: number, acc: number[]) {
    if (i === PERGUNTAS.length) { caminhos.push(acc); return }
    for (let o = 0; o < PERGUNTAS[i].opcoes.length; o++) gerar(i + 1, [...acc, o])
  })(0, [])

  it('há 576 combinações possíveis de resposta (3 × 4 × 4 × 3 × 4)', () => {
    expect(caminhos).toHaveLength(576)
  })

  it('TODO atleta aparece entre os dois primeiros em pelo menos 5% das combinações', () => {
    const contagem = Object.fromEntries(ATLETAS.map(a => [a.id, 0]))
    for (const c of caminhos) {
      const r = resultadoDoQuiz(c)!
      contagem[r.primeiro.atleta.id]++
      contagem[r.segundo.atleta.id]++
    }
    for (const a of ATLETAS) expect(contagem[a.id], `${a.nome} aparece em ${contagem[a.id]} de 576`).toBeGreaterThanOrEqual(Math.ceil(576 * 0.05))
  })

  it('nenhum atleta domina o resultado: no máximo 40% das combinações o têm entre os dois primeiros', () => {
    const contagem = Object.fromEntries(ATLETAS.map(a => [a.id, 0]))
    for (const c of caminhos) {
      const r = resultadoDoQuiz(c)!
      contagem[r.primeiro.atleta.id]++
      contagem[r.segundo.atleta.id]++
    }
    for (const a of ATLETAS) expect(contagem[a.id], a.nome).toBeLessThanOrEqual(Math.floor(576 * 0.4))
  })
})

describe('respostas no endereço (/quiz?r=01203): o resultado sobrevive ao botão Voltar e pode ser compartilhado', () => {
  it('serializa uma resposta por pergunta, como um dígito cada', () => {
    expect(serializarRespostas([0, 1, 2, 0, 3])).toBe('01203')
    expect(serializarRespostas([2, 3, 3, 2, 3])).toBe('23323')
  })

  it('lê de volta o que foi serializado, para todas as 576 combinações', () => {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) for (let d = 0; d < 3; d++) for (let e = 0; e < 4; e++) {
      const respostas = [a, b, c, d, e]
      expect(respostasDaUrl(serializarRespostas(respostas))).toEqual(respostas)
    }
  })

  it.each([
    ['ausente', undefined],
    ['vazio', ''],
    ['curto', '0120'],
    ['comprido', '012030'],
    ['com letra', '0120x'],
    ['com sinal', '-0120'],
    ['com espaço', '0120 '],
    ['índice fora da pergunta 1 (só há 3 respostas)', '31203'],
    ['mais de um valor no endereço (r=1&r=2)', ['01203', '01203']],
    ['um texto malicioso', '<script>alert(1)</script>'],
  ])('endereço inválido (%s) volta ao início do quiz', (_nome, valor) => {
    expect(respostasDaUrl(valor as never)).toBeNull()
  })
})
