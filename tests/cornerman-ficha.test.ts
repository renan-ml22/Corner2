import { describe, expect, it } from 'vitest'
import {
  LIMITES_DA_FICHA, LIMITE_DE_ALUNOS, contarAtivas, ehIdDeFicha, validarAtualizacao, validarNovaFicha,
} from '@/lib/cornerman/ficha'

// Ficha de aluno do treinador: o que vale, o que é recusado e o que vira nulo. Tudo puro, sem rede.

const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg=='
const COMPLETA = { nome: 'Beto Silva', email: 'beto@exemplo.com', telefone: '(11) 91234-5678', nivel: 'intermediario', estilo: 'Out-boxer', notas: 'Treina de manhã', foto: FOTO }

const aceita = (corpo: unknown) => {
  const r = validarNovaFicha(corpo)
  if (!r.ok) throw new Error(`recusou: ${r.erro}`)
  return r.valor
}
const recusa = (corpo: unknown) => {
  const r = validarNovaFicha(corpo)
  expect(r.ok, JSON.stringify(corpo)?.slice(0, 80)).toBe(false)
  return r.ok ? '' : r.erro
}

describe('limites', () => {
  it('20 alunos; nome 80, e-mail 120, telefone 30, estilo 40, notas 2000', () => {
    expect(LIMITE_DE_ALUNOS).toBe(20)
    expect(LIMITES_DA_FICHA).toEqual({ nome: 80, email: 120, telefone: 30, estilo: 40, notas: 2000 })
  })
})

describe('validarNovaFicha', () => {
  it('só o nome basta: o resto vira nulo, vazio ou "sem foto"', () => {
    expect(aceita({ nome: 'Beto' })).toEqual({ nome: 'Beto', email: null, telefone: null, nivel: null, estilo: null, notas: '', foto: '' })
  })

  it('ficha completa passa igual', () => {
    expect(aceita(COMPLETA)).toEqual(COMPLETA)
  })

  describe('nome', () => {
    it('é aparado nas pontas', () => {
      expect(aceita({ nome: '  Beto  ' }).nome).toBe('Beto')
    })
    it.each([undefined, null, '', '   ', '\n\t', 42, true, {}, []])('recusa %j', nome => {
      recusa({ nome })
    })
    it('80 caracteres vale; 81 não', () => {
      expect(aceita({ nome: 'a'.repeat(80) }).nome).toHaveLength(80)
      recusa({ nome: 'a'.repeat(81) })
    })
    it('aceita emoji e acento', () => {
      expect(aceita({ nome: '🥊 Ávila' }).nome).toBe('🥊 Ávila')
    })
  })

  describe('e-mail', () => {
    it('vazio ou só espaços vira nulo; válido passa (aparado)', () => {
      expect(aceita({ nome: 'A', email: '' }).email).toBeNull()
      expect(aceita({ nome: 'A', email: '   ' }).email).toBeNull()
      expect(aceita({ nome: 'A', email: ' a@b.com ' }).email).toBe('a@b.com')
    })
    it.each(['a@b', 'sem-arroba', 'a@@b.com', 'a b@c.com', `${'x'.repeat(115)}@a.com`, 5])('recusa %j', email => {
      recusa({ nome: 'A', email })
    })
  })

  describe('telefone', () => {
    it('aceita dígitos, +, parênteses, hífen, ponto e espaço', () => {
      expect(aceita({ nome: 'A', telefone: '+55 (11) 91234-5678' }).telefone).toBe('+55 (11) 91234-5678')
      expect(aceita({ nome: 'A', telefone: '' }).telefone).toBeNull()
    })
    it.each(['11 9abc', '<b>1</b>', '1'.repeat(31), 11912345678])('recusa %j', telefone => {
      recusa({ nome: 'A', telefone })
    })
    it('30 caracteres vale', () => {
      expect(aceita({ nome: 'A', telefone: '1'.repeat(30) }).telefone).toHaveLength(30)
    })
  })

  describe('nível, estilo, notas e foto', () => {
    it('nível: as três opções valem, nulo e vazio viram nulo; outro valor é recusado', () => {
      for (const n of ['iniciante', 'intermediario', 'avancado']) expect(aceita({ nome: 'A', nivel: n }).nivel).toBe(n)
      expect(aceita({ nome: 'A', nivel: null }).nivel).toBeNull()
      expect(aceita({ nome: 'A', nivel: '' }).nivel).toBeNull()
      recusa({ nome: 'A', nivel: 'profissional' })
      recusa({ nome: 'A', nivel: 3 })
    })
    it('estilo: 40 vale, 41 não; vazio vira nulo', () => {
      expect(aceita({ nome: 'A', estilo: 'e'.repeat(40) }).estilo).toHaveLength(40)
      recusa({ nome: 'A', estilo: 'e'.repeat(41) })
      expect(aceita({ nome: 'A', estilo: '  ' }).estilo).toBeNull()
    })
    it('notas: 2000 vale, 2001 não; HTML e script valem porque são só texto', () => {
      expect(aceita({ nome: 'A', notas: 'n'.repeat(2000) }).notas).toHaveLength(2000)
      recusa({ nome: 'A', notas: 'n'.repeat(2001) })
      expect(aceita({ nome: 'A', notas: '<script>alert(1)</script>' }).notas).toBe('<script>alert(1)</script>')
      recusa({ nome: 'A', notas: 42 })
    })
    it('foto: JPEG em data URI ou vazio; PNG, SVG, endereço e nulo são recusados', () => {
      expect(aceita({ nome: 'A', foto: FOTO }).foto).toBe(FOTO)
      expect(aceita({ nome: 'A', foto: '' }).foto).toBe('')
      for (const foto of ['data:image/png;base64,AAAA', 'data:image/svg+xml;base64,PHN2Zz4=', 'https://x.com/a.jpg', null, 5]) recusa({ nome: 'A', foto })
    })
  })

  describe('o que não pode vir do navegador', () => {
    it.each(['coach_id', 'coachId', 'aluno_user_id', 'alunoUserId', 'status', 'id', 'comConta', 'criadoEm', 'extra'])('campo %s recusa a ficha inteira', campo => {
      recusa({ nome: 'A', [campo]: 'x' })
    })
    it('__proto__ recusa a ficha', () => {
      recusa(JSON.parse('{"nome":"A","__proto__":{"x":1}}'))
    })
    it.each([null, undefined, 'x', 5, [], [{ nome: 'A' }], true])('corpo %j não é um objeto de ficha', corpo => {
      recusa(corpo)
    })
  })

  it('as mensagens de erro não repetem o que a pessoa enviou', () => {
    const segredo = 'segredo-que-nao-pode-voltar'
    expect(recusa({ nome: 'A', email: `${segredo}@x` })).not.toContain(segredo)
    expect(recusa({ nome: 'A', nivel: segredo })).not.toContain(segredo)
    expect(recusa({ nome: segredo.repeat(10) })).not.toContain(segredo)
    expect(recusa({ nome: 'A', [segredo]: 1 })).not.toContain(segredo)
  })

  it('não altera o objeto recebido', () => {
    const entrada = { nome: '  Beto ', email: '' }
    validarNovaFicha(entrada)
    expect(entrada).toEqual({ nome: '  Beto ', email: '' })
  })
})

describe('validarAtualizacao', () => {
  const ok = (corpo: unknown) => {
    const r = validarAtualizacao(corpo)
    if (!r.ok) throw new Error(`recusou: ${r.erro}`)
    return r.valor
  }
  const ruim = (corpo: unknown) => expect(validarAtualizacao(corpo).ok, JSON.stringify(corpo)).toBe(false)

  it('aceita qualquer subconjunto e devolve só o que veio', () => {
    expect(ok({ notas: 'novas' })).toEqual({ notas: 'novas' })
    expect(ok({ nome: ' Zé ', nivel: null, estilo: '' })).toEqual({ nome: 'Zé', nivel: null, estilo: null })
    expect(ok({ foto: '' })).toEqual({ foto: '' })
  })

  it('status: só "ativo" e "encerrado" (convidado é do sistema)', () => {
    expect(ok({ status: 'encerrado' })).toEqual({ status: 'encerrado' })
    expect(ok({ status: 'ativo' })).toEqual({ status: 'ativo' })
    ruim({ status: 'convidado' })
    ruim({ status: 'x' })
    ruim({ status: null })
  })

  it('objeto vazio, corpo que não é objeto e campos desconhecidos são recusados', () => {
    ruim({})
    for (const corpo of [null, 'x', 5, [], undefined]) ruim(corpo)
    ruim({ notas: 'a', coach_id: 'outro' })
    ruim({ id: 'x' })
    ruim(JSON.parse('{"notas":"a","__proto__":{"x":1}}'))
  })

  it('cada campo segue as mesmas regras da ficha nova', () => {
    ruim({ nome: '' })
    ruim({ nome: 'a'.repeat(81) })
    ruim({ email: 'a@b' })
    ruim({ telefone: 'abc' })
    ruim({ nivel: 'x' })
    ruim({ estilo: 'e'.repeat(41) })
    ruim({ notas: 'n'.repeat(2001) })
    ruim({ foto: 'data:image/png;base64,AAAA' })
  })
})

describe('ehIdDeFicha', () => {
  it('aceita uuid', () => {
    expect(ehIdDeFicha('3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c')).toBe(true)
    expect(ehIdDeFicha('3F2B8C1E-9A4D-4E7B-8C21-5D6E7F8A9B0C')).toBe(true)
  })
  it.each(['', '1', 'abc', '../x', '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0c ', '3f2b8c1e-9a4d-4e7b-8c21-5d6e7f8a9b0cX', "x'; drop table coach_alunos;--", 5, null, undefined])('recusa %j', v => {
    expect(ehIdDeFicha(v)).toBe(false)
  })
})

describe('contarAtivas', () => {
  it('conta ativo e convidado; encerrado não conta', () => {
    expect(contarAtivas([{ status: 'ativo' }, { status: 'convidado' }, { status: 'encerrado' }, { status: 'ativo' }])).toBe(3)
    expect(contarAtivas([])).toBe(0)
  })
})
