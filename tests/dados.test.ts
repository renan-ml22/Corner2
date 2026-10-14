import { describe, expect, it } from 'vitest'
import {
  NIVEL_LABEL,
  PLANOS,
  getPlano,
  resumoRounds,
  sessoesDaSemana,
  type Nivel,
  type Plano,
  type SessaoPlano,
} from '@/data/planos'
import {
  AQUECIMENTO,
  BANDAGEM,
  COMBINACOES,
  DEFESAS,
  DESAQUECIMENTO,
  GOLPES,
  NOTACAO_CORPO,
  combosAteNivel,
  focoDosRounds,
  maoDaFrente,
  maoDeTras,
} from '@/data/tecnicas'
import { CAT_LABELS, isRegType, TIPOS, type RegType } from '@/lib/tipos'

const NIVEIS: Nivel[] = ['iniciante', 'intermediario', 'avancado']
const ID_DOS_PLANOS = ['fundamentos', 'base-aerobica', 'tecnica-avancada', 'pre-competicao']

const todasAsSessoes = PLANOS.flatMap(p => p.sessoes.map(s => ({ plano: p, sessao: s })))
const semanasDe = (p: Plano) => Array.from({ length: p.semanas }, (_, i) => i + 1)
const preCompeticao = PLANOS.find(p => p.id === 'pre-competicao')!
const baseAerobica = PLANOS.find(p => p.id === 'base-aerobica')!
const fundamentos = PLANOS.find(p => p.id === 'fundamentos')!
const totalRounds = (sessoes: SessaoPlano[]) => sessoes.reduce((soma, s) => soma + s.rounds, 0)

describe('PLANOS: catálogo', () => {
  it('tem os quatro planos esperados, nesta ordem', () => {
    expect(PLANOS.map(p => p.id)).toEqual(ID_DOS_PLANOS)
  })

  it('ids dos planos são únicos', () => {
    const ids = PLANOS.map(p => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids das sessões são únicos entre todos os planos', () => {
    const ids = todasAsSessoes.map(({ sessao }) => sessao.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids de sessão não têm espaços nem ":" (usados na chave de reagendamento semana:sessaoId)', () => {
    for (const { sessao } of todasAsSessoes) expect(sessao.id).toMatch(/^[a-z0-9-]+$/)
  })

  it.each(PLANOS.map(p => [p.id, p] as const))('plano %s tem nome, resumo e nível válidos', (_id, p) => {
    expect(p.nome.trim()).not.toBe('')
    expect(p.resumo.trim()).not.toBe('')
    expect(p.nivelLabel.trim()).not.toBe('')
    expect(NIVEIS).toContain(p.nivel)
    expect(Number.isInteger(p.semanas) && p.semanas > 0).toBe(true)
    expect(Number.isInteger(p.diasPorSemana) && p.diasPorSemana > 0 && p.diasPorSemana <= 7).toBe(true)
  })

  it('NIVEL_LABEL cobre todos os níveis, com rótulo não vazio', () => {
    expect(Object.keys(NIVEL_LABEL).sort()).toEqual([...NIVEIS].sort())
    for (const nivel of NIVEIS) expect(NIVEL_LABEL[nivel].trim()).not.toBe('')
  })

  it('todo plano usa um nível presente em NIVEL_LABEL', () => {
    for (const p of PLANOS) expect(NIVEL_LABEL[p.nivel]).toBeTruthy()
  })

  it('há plano para cada nível (iniciante, intermediário e avançado)', () => {
    expect(new Set(PLANOS.map(p => p.nivel))).toEqual(new Set(NIVEIS))
  })

  it('o rótulo do plano começa com o rótulo do nível (ex.: "Intermediário/Avançado" para nível avançado)', () => {
    // tecnica-avancada tem nivelLabel próprio ("Intermediário/Avançado"), de propósito.
    for (const p of PLANOS) {
      const ok = p.nivelLabel === NIVEL_LABEL[p.nivel] || p.nivelLabel.includes(NIVEL_LABEL[p.nivel])
      expect(ok, p.id).toBe(true)
    }
  })
})

describe('getPlano', () => {
  it.each(ID_DOS_PLANOS)('devolve o plano %s', id => {
    expect(getPlano(id)?.id).toBe(id)
  })

  it('devolve a mesma referência presente em PLANOS', () => {
    for (const p of PLANOS) expect(getPlano(p.id)).toBe(p)
  })

  it.each([
    ['id inexistente', 'nao-existe'],
    ['string vazia', ''],
    ['null', null],
    ['undefined', undefined],
    ['id com maiúscula', 'Fundamentos'],
    ['id com espaço', ' fundamentos'],
  ])('devolve null para %s', (_nome, id) => {
    expect(getPlano(id)).toBeNull()
  })
})

describe('sessões dos planos: invariantes', () => {
  it.each(todasAsSessoes.map(({ plano, sessao }) => [`${plano.id}/${sessao.id}`, sessao] as const))(
    'sessão %s tem dados válidos',
    (_nome, s) => {
      expect(Number.isInteger(s.diaSemana)).toBe(true)
      expect(s.diaSemana).toBeGreaterThanOrEqual(0)
      expect(s.diaSemana).toBeLessThanOrEqual(6)
      expect(isRegType(s.tipo)).toBe(true)
      expect(TIPOS).toContain(s.tipo)
      expect(CAT_LABELS[s.tipo]).toBeTruthy()
      expect(s.titulo.trim()).not.toBe('')
      expect(s.descricao.trim()).not.toBe('')
      expect(Number.isInteger(s.rounds) && s.rounds > 0).toBe(true)
      expect(Number.isFinite(s.minPorRound) && s.minPorRound > 0).toBe(true)
      expect(Number.isFinite(s.descansoSeg) && s.descansoSeg > 0).toBe(true)
      expect(s.checklist.length).toBeGreaterThan(0)
      for (const item of s.checklist) expect(item.trim()).not.toBe('')
    },
  )

  it('checklists não repetem itens dentro da mesma sessão', () => {
    for (const { sessao } of todasAsSessoes) {
      expect(new Set(sessao.checklist).size, sessao.id).toBe(sessao.checklist.length)
    }
  })

  it('intervalos de semanas são [início, fim] inteiros, ordenados e dentro da duração do plano', () => {
    for (const { plano, sessao } of todasAsSessoes) {
      if (!sessao.semanas) continue
      const [ini, fim] = sessao.semanas
      expect(Number.isInteger(ini) && Number.isInteger(fim), sessao.id).toBe(true)
      expect(ini, sessao.id).toBeGreaterThanOrEqual(1)
      expect(fim, sessao.id).toBeGreaterThanOrEqual(ini)
      expect(fim, sessao.id).toBeLessThanOrEqual(plano.semanas)
    }
  })

  it('o tipo de cada sessão é um dos três RegType', () => {
    const validos: RegType[] = ['tec', 'con', 'spa']
    for (const { sessao } of todasAsSessoes) expect(validos).toContain(sessao.tipo)
  })

  it('rounds duram 3 minutos em todos os planos, exceto Fundamentos (2 min)', () => {
    for (const { plano, sessao } of todasAsSessoes) {
      expect(sessao.minPorRound, sessao.id).toBe(plano.id === 'fundamentos' ? 2 : 3)
    }
  })
})

describe('sessoesDaSemana: cobertura das semanas', () => {
  it.each(PLANOS.map(p => [p.id, p] as const))('%s: toda semana de 1 até a duração tem sessões', (_id, p) => {
    for (const semana of semanasDe(p)) {
      expect(sessoesDaSemana(p, semana).length, `semana ${semana}`).toBeGreaterThan(0)
    }
  })

  it.each(PLANOS.map(p => [p.id, p] as const))(
    '%s: nenhuma semana passa de diasPorSemana sessões e dias não se repetem',
    (_id, p) => {
      for (const semana of semanasDe(p)) {
        const sessoes = sessoesDaSemana(p, semana)
        expect(sessoes.length, `semana ${semana}`).toBeLessThanOrEqual(p.diasPorSemana)
        const dias = sessoes.map(s => s.diaSemana)
        expect(new Set(dias).size, `semana ${semana}`).toBe(dias.length)
      }
    },
  )

  it('toda semana tem exatamente diasPorSemana sessões, exceto a semana de polimento da pré-competição', () => {
    for (const p of PLANOS) {
      for (const semana of semanasDe(p)) {
        const polimento = p.id === 'pre-competicao' && semana === p.semanas
        const qtd = sessoesDaSemana(p, semana).length
        if (polimento) expect(qtd).toBeLessThan(p.diasPorSemana)
        else expect(qtd, `${p.id} semana ${semana}`).toBe(p.diasPorSemana)
      }
    }
  })

  it('toda sessão aparece em pelo menos uma semana do plano (nenhuma sessão órfã)', () => {
    for (const p of PLANOS) {
      const usadas = new Set(semanasDe(p).flatMap(sem => sessoesDaSemana(p, sem).map(s => s.id)))
      for (const s of p.sessoes) expect(usadas.has(s.id), s.id).toBe(true)
    }
  })

  it('ordena de segunda a domingo, com domingo (0) por último', () => {
    for (const p of PLANOS) {
      for (const semana of semanasDe(p)) {
        const ordem = sessoesDaSemana(p, semana).map(s => (s.diaSemana === 0 ? 7 : s.diaSemana))
        expect(ordem).toEqual([...ordem].sort((a, b) => a - b))
      }
    }
  })

  it('coloca a sessão de domingo depois de sábado e segunda em primeiro', () => {
    const base = fundamentos.sessoes[0]
    const plano: Plano = {
      ...fundamentos,
      sessoes: [
        { ...base, id: 'dom', diaSemana: 0, semanas: undefined },
        { ...base, id: 'sab', diaSemana: 6, semanas: undefined },
        { ...base, id: 'seg', diaSemana: 1, semanas: undefined },
      ],
    }
    expect(sessoesDaSemana(plano, 1).map(s => s.id)).toEqual(['seg', 'sab', 'dom'])
  })

  it('não altera a ordem nem o conteúdo de plano.sessoes ao ordenar', () => {
    const antes = fundamentos.sessoes.map(s => s.id)
    sessoesDaSemana(fundamentos, 3)
    expect(fundamentos.sessoes.map(s => s.id)).toEqual(antes)
  })

  it('devolve só as sessões da fase da semana (Fundamentos: semanas 1-2 e 3-4)', () => {
    expect(sessoesDaSemana(fundamentos, 1).map(s => s.id)).toEqual(['fun-s1-seg', 'fun-s1-qua', 'fun-s1-sex'])
    expect(sessoesDaSemana(fundamentos, 2).map(s => s.id)).toEqual(['fun-s1-seg', 'fun-s1-qua', 'fun-s1-sex'])
    expect(sessoesDaSemana(fundamentos, 3).map(s => s.id)).toEqual(['fun-s3-seg', 'fun-s3-qua', 'fun-s3-sex'])
    expect(sessoesDaSemana(fundamentos, 4).map(s => s.id)).toEqual(['fun-s3-seg', 'fun-s3-qua', 'fun-s3-sex'])
  })

  it('plano sem intervalo de semanas repete as mesmas sessões em todas as semanas válidas', () => {
    const ids = baseAerobica.sessoes.map(s => s.id).sort()
    for (const semana of semanasDe(baseAerobica)) {
      expect(sessoesDaSemana(baseAerobica, semana).map(s => s.id).sort()).toEqual(ids)
    }
  })
})

describe('sessoesDaSemana: semana fora do intervalo', () => {
  it.each([0, -1, 5, 99])('Fundamentos (4 semanas): semana %s devolve lista vazia', semana => {
    expect(sessoesDaSemana(fundamentos, semana)).toEqual([])
  })

  it.each([0, -1, 7, 99])('Pré-competição (6 semanas): semana %s devolve lista vazia', semana => {
    expect(sessoesDaSemana(preCompeticao, semana)).toEqual([])
  })

  it('NaN devolve lista vazia nos planos com fases', () => {
    expect(sessoesDaSemana(fundamentos, NaN)).toEqual([])
    expect(sessoesDaSemana(preCompeticao, NaN)).toEqual([])
  })

  // Sessões sem `semanas` valem para todas as semanas do plano, mas não para semanas inexistentes.
  it.each([0, -1, 7, 99])('Base Aeróbica (6 semanas): semana %s devolve lista vazia', semana => {
    expect(sessoesDaSemana(baseAerobica, semana)).toEqual([])
  })
})

describe('Pré-competição: progressão e polimento', () => {
  const sessoesDa = (semana: number) => sessoesDaSemana(preCompeticao, semana)

  it('tem 6 semanas e 5 dias por semana', () => {
    expect(preCompeticao.semanas).toBe(6)
    expect(preCompeticao.diasPorSemana).toBe(5)
  })

  it('o volume sobe em blocos: 8 rounds (sem. 1-2), 10 (3-4) e 12 (sem. 5)', () => {
    for (const semana of [1, 2]) for (const s of sessoesDa(semana)) expect(s.rounds).toBe(8)
    for (const semana of [3, 4]) for (const s of sessoesDa(semana)) expect(s.rounds).toBe(10)
    for (const s of sessoesDa(5)) expect(s.rounds).toBe(12)
  })

  it('a última semana é a de polimento: ids "pre-pol-*" só existem na semana 6', () => {
    for (const semana of semanasDe(preCompeticao)) {
      const temPolimento = sessoesDa(semana).some(s => s.id.startsWith('pre-pol-'))
      expect(temPolimento, `semana ${semana}`).toBe(semana === preCompeticao.semanas)
    }
  })

  it('o polimento tem uma única semana, a última do plano', () => {
    const pol = preCompeticao.sessoes.filter(s => s.id.startsWith('pre-pol-'))
    expect(pol.length).toBeGreaterThan(0)
    for (const s of pol) expect(s.semanas).toEqual([6, 6])
  })

  it('o polimento reduz o volume: menos da metade dos rounds da semana 5', () => {
    expect(totalRounds(sessoesDa(6))).toBeLessThan(totalRounds(sessoesDa(5)) / 2)
  })

  it('nenhuma sessão do polimento supera 6 rounds e todas têm menos rounds que as semanas anteriores', () => {
    const menorAnterior = Math.min(...[1, 2, 3, 4, 5].flatMap(sem => sessoesDa(sem).map(s => s.rounds)))
    for (const s of sessoesDa(6)) {
      expect(s.rounds).toBeLessThanOrEqual(6)
      expect(s.rounds).toBeLessThan(menorAnterior)
    }
  })

  it('o polimento tem menos sparring que as semanas normais (2 por semana → 1)', () => {
    const spa = (semana: number) => sessoesDa(semana).filter(s => s.tipo === 'spa').length
    for (const semana of [1, 2, 3, 4, 5]) expect(spa(semana)).toBe(2)
    expect(spa(6)).toBe(1)
  })

  it('o polimento não tem sessão no sábado (dia 6) nem sparring de simulação', () => {
    expect(sessoesDa(6).some(s => s.diaSemana === 6)).toBe(false)
    expect(sessoesDa(6).some(s => s.titulo.includes('simulação'))).toBe(false)
  })

  it('o checklist cita a quantidade de rounds da própria sessão', () => {
    for (const semana of semanasDe(preCompeticao)) {
      for (const s of sessoesDa(semana)) {
        const cita = s.checklist.some(item => item.includes(`${s.rounds} rounds`))
        expect(cita, s.id).toBe(true)
      }
    }
  })

  it('o volume nunca diminui entre blocos até a semana 5', () => {
    const totais = [1, 2, 3, 4, 5].map(sem => totalRounds(sessoesDa(sem)))
    expect(totais).toEqual([...totais].sort((a, b) => a - b))
  })
})

describe('resumoRounds', () => {
  it('mostra faixa "min–max" quando os rounds variam', () => {
    expect(resumoRounds(fundamentos)).toBe('4 rounds de 2 min')
    expect(resumoRounds(preCompeticao)).toBe('4–12 rounds de 3 min')
  })

  it('mostra um número só quando todas as sessões têm os mesmos rounds', () => {
    expect(resumoRounds(baseAerobica)).toBe('6 rounds de 3 min')
  })

  it('Técnica Avançada vai de 6 a 8 rounds', () => {
    const p = PLANOS.find(x => x.id === 'tecnica-avancada')!
    expect(resumoRounds(p)).toBe('6–8 rounds de 3 min')
  })

  it('o mínimo e o máximo do texto batem com os dados de cada plano', () => {
    for (const p of PLANOS) {
      const rounds = p.sessoes.map(s => s.rounds)
      const min = Math.min(...rounds)
      const max = Math.max(...rounds)
      const esperado = `${min === max ? min : `${min}–${max}`} rounds de ${p.sessoes[0].minPorRound} min`
      expect(resumoRounds(p)).toBe(esperado)
    }
  })

  it('plano sem sessões não deveria exibir "Infinity" na tela', () => {
    const vazio: Plano = { ...fundamentos, sessoes: [] }
    expect(resumoRounds(vazio)).not.toMatch(/Infinity/)
  })
})

// ── tecnicas.ts ────────────────────────────────────────────────

describe('GOLPES', () => {
  it('tem 6 golpes numerados de 1 a 6, sem repetição', () => {
    expect(GOLPES).toHaveLength(6)
    expect(GOLPES.map(g => g.numero)).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(new Set(GOLPES.map(g => g.numero)).size).toBe(6)
  })

  it('nomes são únicos', () => {
    expect(new Set(GOLPES.map(g => g.nome)).size).toBe(GOLPES.length)
  })

  it('nenhum campo de texto está vazio', () => {
    for (const g of GOLPES) {
      for (const campo of [g.numero, g.nome, g.resumo, g.dica]) expect(campo.trim(), g.nome).not.toBe('')
    }
  })

  it('1 é o jab e 2 é o direto (numeração padrão do boxe)', () => {
    expect(GOLPES[0].nome).toBe('Jab')
    expect(GOLPES[1].nome).toContain('Direto')
  })

  it('NOTACAO_CORPO explica o sufixo "c" com um exemplo existente', () => {
    expect(NOTACAO_CORPO).toContain('"c"')
    expect(NOTACAO_CORPO).toContain('3c')
  })
})

describe('DEFESAS', () => {
  it('tem 6 defesas', () => {
    expect(DEFESAS).toHaveLength(6)
  })

  it('nomes são únicos e nenhum texto está vazio', () => {
    expect(new Set(DEFESAS.map(d => d.nome)).size).toBe(DEFESAS.length)
    for (const d of DEFESAS) {
      for (const campo of [d.nome, d.resumo, d.dica]) expect(campo.trim(), d.nome).not.toBe('')
    }
  })
})

describe('COMBINACOES', () => {
  const numeros = new Set(GOLPES.map(g => g.numero))
  const nomesDeDefesa = DEFESAS.map(d => d.nome.toLowerCase())
  const tokens = (notacao: string) => notacao.split('-')

  it('tem 18 combinações, 6 em cada um dos 3 níveis', () => {
    expect(COMBINACOES).toHaveLength(18)
    for (const nivel of NIVEIS) {
      expect(COMBINACOES.filter(c => c.nivel === nivel), nivel).toHaveLength(6)
    }
  })

  it('todas usam um nível existente em NIVEL_LABEL', () => {
    for (const c of COMBINACOES) expect(NIVEL_LABEL[c.nivel], c.notacao).toBeTruthy()
  })

  it('notações são únicas', () => {
    const lista = COMBINACOES.map(c => c.notacao)
    expect(new Set(lista).size).toBe(lista.length)
  })

  it('nomes são únicos', () => {
    const lista = COMBINACOES.map(c => c.nome)
    expect(new Set(lista).size).toBe(lista.length)
  })

  it('nenhum texto está vazio nem tem espaços nas pontas', () => {
    for (const c of COMBINACOES) {
      for (const campo of [c.notacao, c.nome, c.descricao]) {
        expect(campo.trim(), c.notacao).not.toBe('')
        expect(campo, c.notacao).toBe(campo.trim())
      }
    }
  })

  it('as combinações estão agrupadas por nível, do iniciante ao avançado', () => {
    const ordem: Record<Nivel, number> = { iniciante: 0, intermediario: 1, avancado: 2 }
    const niveis = COMBINACOES.map(c => ordem[c.nivel])
    expect(niveis).toEqual([...niveis].sort((a, b) => a - b))
  })

  it('todo golpe numerado citado existe em GOLPES (aceitando o sufixo "c" do corpo)', () => {
    for (const c of COMBINACOES) {
      for (const t of tokens(c.notacao)) {
        const m = t.match(/^(\d+)(c?)$/)
        if (!m) continue
        expect(numeros.has(m[1]), `${c.notacao} cita golpe ${m[1]}`).toBe(true)
      }
    }
  })

  it('todo termo não numérico da notação corresponde a uma defesa cadastrada', () => {
    for (const c of COMBINACOES) {
      for (const t of tokens(c.notacao)) {
        if (/^\d+c?$/.test(t)) continue
        const existe = nomesDeDefesa.some(n => n.includes(t))
        expect(existe, `${c.notacao} cita "${t}"`).toBe(true)
      }
    }
  })

  it('a notação não tem tokens vazios (sem hífen duplo, inicial ou final)', () => {
    for (const c of COMBINACOES) {
      for (const t of tokens(c.notacao)) expect(t.trim(), c.notacao).not.toBe('')
    }
  })

  it('o sufixo "c" só aparece em golpes numerados e a notação de iniciante não usa corpo nem defesa', () => {
    for (const c of COMBINACOES.filter(x => x.nivel === 'iniciante')) {
      for (const t of tokens(c.notacao)) expect(t, c.notacao).toMatch(/^\d+$/)
    }
  })

  it('iniciantes usam só os golpes 1, 2 e 3', () => {
    for (const c of COMBINACOES.filter(x => x.nivel === 'iniciante')) {
      for (const t of tokens(c.notacao)) expect(['1', '2', '3'], c.notacao).toContain(t)
    }
  })

  it('a quantidade de golpes numerados bate com a descrição "de quatro"/"cinco" onde ela existe', () => {
    const cont = (n: string) => tokens(COMBINACOES.find(c => c.notacao === n)!.notacao).filter(t => /^\d+c?$/.test(t)).length
    expect(cont('1-2-3-2')).toBe(4)
    expect(cont('1-2-3-6-3')).toBe(5)
    expect(cont('1-2-3-2-esquiva-3')).toBe(5)
  })
})

describe('combosAteNivel', () => {
  it('iniciante devolve só as 6 combinações de iniciante', () => {
    const r = combosAteNivel('iniciante')
    expect(r).toHaveLength(6)
    expect(r.every(c => c.nivel === 'iniciante')).toBe(true)
  })

  it('intermediário acumula iniciante + intermediário (12)', () => {
    expect(combosAteNivel('intermediario')).toHaveLength(12)
  })

  it('avançado devolve todas as 18', () => {
    expect(combosAteNivel('avancado')).toEqual(COMBINACOES)
  })
})

describe('maoDaFrente e maoDeTras', () => {
  it('ortodoxo: frente esquerda, trás direita', () => {
    expect(maoDaFrente('ortodoxo')).toBe('esquerda')
    expect(maoDeTras('ortodoxo')).toBe('direita')
  })

  it('canhoto: frente direita, trás esquerda', () => {
    expect(maoDaFrente('canhoto')).toBe('direita')
    expect(maoDeTras('canhoto')).toBe('esquerda')
  })

  it('a mão da frente nunca é a mesma que a de trás', () => {
    for (const p of ['ortodoxo', 'canhoto'] as const) expect(maoDaFrente(p)).not.toBe(maoDeTras(p))
  })
})

describe('guias de preparação e recuperação', () => {
  it.each([
    ['AQUECIMENTO', AQUECIMENTO],
    ['BANDAGEM', BANDAGEM],
    ['DESAQUECIMENTO', DESAQUECIMENTO],
  ])('%s tem passos com título e texto preenchidos', (_nome, passos) => {
    expect(passos.length).toBeGreaterThan(0)
    for (const p of passos) {
      expect(p.titulo.trim()).not.toBe('')
      expect(p.texto.trim()).not.toBe('')
    }
  })

  it('a bandagem tem 6 passos numerados em sequência', () => {
    expect(BANDAGEM).toHaveLength(6)
    BANDAGEM.forEach((p, i) => expect(p.titulo.startsWith(`${i + 1}.`)).toBe(true))
  })
})

describe('focoDosRounds', () => {
  const tipos: RegType[] = ['tec', 'con', 'spa']
  const conhecidas = new Set(COMBINACOES.map(c => c.notacao))

  it.each(tipos.flatMap(t => NIVEIS.flatMap(n => [1, 2, 3, 4, 6, 12].map(r => [t, n, r] as const))))(
    'tipo %s, nível %s, %s rounds: um item por round, numerados em sequência e com textos',
    (tipo, nivel, rounds) => {
      const r = focoDosRounds(tipo, rounds, nivel)
      expect(r).toHaveLength(rounds)
      expect(r.map(x => x.numero)).toEqual(Array.from({ length: rounds }, (_, i) => i + 1))
      for (const x of r) {
        expect(x.titulo.trim()).not.toBe('')
        expect(x.texto.trim()).not.toBe('')
        for (const combo of x.combos) expect(conhecidas.has(combo), combo).toBe(true)
      }
    },
  )

  it('zero rounds devolve lista vazia', () => {
    expect(focoDosRounds('tec', 0, 'iniciante')).toEqual([])
  })

  it('é determinístico: mesma entrada, mesma saída', () => {
    expect(focoDosRounds('spa', 8, 'avancado')).toEqual(focoDosRounds('spa', 8, 'avancado'))
  })

  it('treino técnico de 4+ rounds começa no jab e termina em round livre', () => {
    const r = focoDosRounds('tec', 5, 'intermediario')
    expect(r[0].combos).toEqual(['1'])
    expect(r[4].titulo).toBe('Round livre')
  })
})
