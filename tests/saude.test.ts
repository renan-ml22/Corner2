import { describe, expect, it } from 'vitest'
import {
  calcularCarga,
  cargaDaSessao,
  cargaSemanal,
  checkinDeHoje,
  gerarAlertas,
  prontidao,
  resumoCabeca,
  sugerirAjuste,
  type Alerta,
} from '@/lib/saude'
import type { Checkin, ImpactoCabeca, Lesao, RegType, WorkoutEntry } from '@/lib/tipos'

// "Hoje" fixo: quarta-feira, 14/10/2026, meio-dia (fuso local; o vitest fixa TZ=America/Sao_Paulo).
// Semana de treino atual: segunda 12/10 a domingo 18/10.
const HOJE = new Date(2026, 9, 14, 12, 0, 0)

// ── Fábricas ────────────────────────────────────────────────

/** ISO de `diasAtras` dias antes de HOJE, na hora indicada (calendário local). */
function isoDiasAtras(diasAtras: number, hora = 12): string {
  return new Date(2026, 9, 14 - diasAtras, hora, 0, 0).toISOString()
}

/** ISO de `horas` horas antes de HOJE (exato, em milissegundos). */
function isoHorasAtras(horas: number): string {
  return new Date(HOJE.getTime() - horas * 3_600_000).toISOString()
}

let seq = 0
function treino(parcial: Partial<WorkoutEntry> = {}): WorkoutEntry {
  seq++
  return {
    id: `t${seq}`,
    data: isoDiasAtras(0),
    tipo: 'tec',
    rounds: 4,
    minPorRound: 3,
    rpe: 5,
    duracaoSegundos: 1800,
    ...parcial,
  }
}

/** Treino cuja carga é exatamente `carga` (20 rounds × 1 min × rpe carga/20), RPE baixo o bastante para não acionar "rpe-alto". */
function treinoComCarga(diasAtras: number, carga: number, parcial: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return treino({ data: isoDiasAtras(diasAtras), rounds: 20, minPorRound: 1, rpe: carga / 20, ...parcial })
}

function sparring(parcial: Partial<WorkoutEntry> & { cabeca?: ImpactoCabeca } = {}): WorkoutEntry {
  const { cabeca = 'nenhum', ...resto } = parcial
  return treino({ tipo: 'spa', sparring: { intensidade: 'moderada', cabeca }, ...resto })
}

function checkin(parcial: Partial<Checkin> = {}): Checkin {
  return { data: '2026-10-14', sono: 5, dor: 1, energia: 5, ...parcial }
}

function lesao(parcial: Partial<Lesao> = {}): Lesao {
  return { id: 'l1', regiao: 'joelhos', intensidade: 3, inicio: '2026-10-01', ...parcial }
}

const ids = (alertas: Alerta[]) => alertas.map(a => a.id)

function alertas(entrada: Partial<Parameters<typeof gerarAlertas>[0]> = {}): Alerta[] {
  return gerarAlertas({ historico: [], lesoes: [], sessaoHojeTipo: null, metaSemanal: 3, hoje: HOJE, ...entrada })
}

// ── cargaDaSessao ───────────────────────────────────────────

describe('cargaDaSessao', () => {
  it('multiplica esforço (RPE) por rounds e minutos por round', () => {
    expect(cargaDaSessao(treino({ rpe: 7, rounds: 6, minPorRound: 3 }))).toBe(126)
  })

  it('arredonda para o inteiro mais próximo', () => {
    expect(cargaDaSessao(treino({ rpe: 6.5, rounds: 3, minPorRound: 1 }))).toBe(20) // 19,5
    expect(cargaDaSessao(treino({ rpe: 6.4, rounds: 3, minPorRound: 1 }))).toBe(19) // 19,2
  })

  it('devolve 0 quando algum fator é zero', () => {
    expect(cargaDaSessao(treino({ rpe: 0 }))).toBe(0)
    expect(cargaDaSessao(treino({ rounds: 0 }))).toBe(0)
    expect(cargaDaSessao(treino({ minPorRound: 0 }))).toBe(0)
  })
})

// ── calcularCarga ───────────────────────────────────────────

describe('calcularCarga', () => {
  it('devolve null com histórico vazio', () => {
    expect(calcularCarga([], HOJE)).toBeNull()
  })

  it('devolve null com menos de 14 dias de histórico (primeiro treino há 12 dias)', () => {
    const h = [treinoComCarga(12, 100), treinoComCarga(1, 100)]
    expect(calcularCarga(h, HOJE)).toBeNull()
  })

  it('calcula com exatamente 14 dias de histórico (primeiro treino há 13 dias)', () => {
    const h = [treinoComCarga(13, 100), treinoComCarga(1, 100)]
    const c = calcularCarga(h, HOJE)
    expect(c).not.toBeNull()
    expect(c).toMatchObject({ aguda: 100, cronica: 100, razao: 1, status: 'ideal' })
  })

  it('devolve null quando só há treinos recentes (sem semana anterior para comparar)', () => {
    expect(calcularCarga([treinoComCarga(0, 100), treinoComCarga(3, 100)], HOJE)).toBeNull()
  })

  it('a carga aguda considera os últimos 7 dias, incluindo hoje', () => {
    const h = [
      treinoComCarga(13, 100), // semana anterior
      treinoComCarga(0, 40), // hoje: entra
      treinoComCarga(6, 60), // 6 dias atrás: entra
      treinoComCarga(7, 100), // 7 dias atrás: já é da semana anterior
    ]
    const c = calcularCarga(h, HOJE)!
    expect(c.aguda).toBe(100)
    expect(c.cronica).toBe(200) // 13 dias (100) + 7 dias (100)
  })

  it('treino de hoje mais tarde que "agora" ainda conta como hoje', () => {
    const h = [treinoComCarga(13, 100), treino({ data: isoDiasAtras(0, 23), rounds: 20, minPorRound: 1, rpe: 5 })]
    expect(calcularCarga(h, HOJE)!.aguda).toBe(100)
  })

  it('a crônica é a média das semanas anteriores, contando semanas vazias como zero', () => {
    // primeiro treino há 20 dias => 2 semanas anteriores; só a mais antiga tem carga
    const h = [treinoComCarga(20, 100), treinoComCarga(1, 50)]
    const c = calcularCarga(h, HOJE)!
    expect(c.cronica).toBe(50)
    expect(c.aguda).toBe(50)
    expect(c.razao).toBe(1)
  })

  it('usa no máximo 4 semanas anteriores', () => {
    // primeiro treino há 60 dias; semanas 1-4 anteriores valem 100, 100, 100, 100; semana 5 (muito alta) é ignorada
    const h = [
      treinoComCarga(60, 1000), // fora das 4 semanas
      treinoComCarga(10, 100),
      treinoComCarga(17, 100),
      treinoComCarga(24, 100),
      treinoComCarga(31, 100),
      treinoComCarga(1, 100),
    ]
    const c = calcularCarga(h, HOJE)!
    expect(c.cronica).toBe(100)
  })

  it('número de semanas anteriores cresce com o histórico (21, 28 e 35 dias)', () => {
    // 21 dias de histórico => 2 semanas: (100 + 300) / 2 = 200
    const duas = calcularCarga([treinoComCarga(20, 300), treinoComCarga(10, 100), treinoComCarga(1, 200)], HOJE)!
    expect(duas.cronica).toBe(200)
    // 28 dias => 3 semanas: (100 + 100 + 400) / 3 = 200
    const tres = calcularCarga([treinoComCarga(27, 400), treinoComCarga(17, 100), treinoComCarga(10, 100), treinoComCarga(1, 200)], HOJE)!
    expect(tres.cronica).toBe(200)
    // 35 dias => 4 semanas: (100 + 100 + 100 + 500) / 4 = 200
    const quatro = calcularCarga([treinoComCarga(34, 500), treinoComCarga(24, 100), treinoComCarga(17, 100), treinoComCarga(10, 100), treinoComCarga(1, 200)], HOJE)!
    expect(quatro.cronica).toBe(200)
  })

  it('com 20 dias de histórico ainda usa só 1 semana anterior (a mais antiga fica de fora)', () => {
    const c = calcularCarga([treinoComCarga(19, 900), treinoComCarga(10, 100), treinoComCarga(1, 100)], HOJE)!
    expect(c.cronica).toBe(100)
  })

  it('devolve null quando a crônica é zero, mesmo com carga aguda alta (comportamento atual)', () => {
    // primeiro treino há 15 dias, fora da janela da única semana anterior (7 a 13 dias atrás)
    const h = [treinoComCarga(15, 100), treinoComCarga(1, 300)]
    expect(calcularCarga(h, HOJE)).toBeNull()
  })

  it('arredonda aguda e crônica na saída, mas mantém a razão exata', () => {
    const h = [treinoComCarga(13, 100), treinoComCarga(12, 1), treinoComCarga(1, 2)] // crônica 101, aguda 2
    const c = calcularCarga(h, HOJE)!
    expect(c.aguda).toBe(2)
    expect(c.cronica).toBe(101)
    expect(c.razao).toBeCloseTo(2 / 101, 10)
  })

  describe('limites do status (crônica = 100)', () => {
    const statusPara = (aguda: number) =>
      calcularCarga([treinoComCarga(13, 100), treinoComCarga(1, aguda)], HOJE)!.status

    it('abaixo de 0,8 é "baixa"', () => {
      expect(statusPara(79)).toBe('baixa')
    })
    it('exatamente 0,8 já é "ideal"', () => {
      expect(statusPara(80)).toBe('ideal')
    })
    it('exatamente 1,0 é "ideal"', () => {
      expect(statusPara(100)).toBe('ideal')
    })
    it('exatamente 1,3 ainda é "ideal"', () => {
      expect(statusPara(130)).toBe('ideal')
    })
    it('logo acima de 1,3 é "atencao"', () => {
      expect(statusPara(131)).toBe('atencao')
    })
    it('exatamente 1,5 ainda é "atencao"', () => {
      expect(statusPara(150)).toBe('atencao')
    })
    it('logo acima de 1,5 é "alta"', () => {
      expect(statusPara(151)).toBe('alta')
    })
    it('semana sem treino (aguda 0) é "baixa"', () => {
      const c = calcularCarga([treinoComCarga(13, 100), treinoComCarga(10, 100)], HOJE)!
      expect(c.aguda).toBe(0)
      expect(c.status).toBe('baixa')
    })
  })
})

// ── cargaSemanal ────────────────────────────────────────────

describe('cargaSemanal', () => {
  it('devolve 8 semanas por padrão, da mais antiga para a atual', () => {
    const r = cargaSemanal([], HOJE)
    expect(r).toHaveLength(8)
    expect(r.every(v => v === 0)).toBe(true)
  })

  it('respeita o número de semanas pedido', () => {
    expect(cargaSemanal([], HOJE, 3)).toHaveLength(3)
  })

  it('agrupa de segunda a domingo e coloca a semana atual por último', () => {
    const h = [
      treinoComCarga(2, 100), // segunda 12/10 (semana atual)
      treinoComCarga(0, 50), // quarta 14/10 (semana atual)
      treinoComCarga(3, 70), // domingo 11/10 (semana anterior)
      treinoComCarga(9, 30), // segunda 05/10 (semana anterior)
      treinoComCarga(10, 20), // domingo 04/10 (semana de 28/09)
      treinoComCarga(11, 10), // sábado 03/10 (semana de 28/09)
    ]
    expect(cargaSemanal(h, HOJE, 3)).toEqual([30, 100, 150])
  })

  it('ignora treinos mais antigos que a janela', () => {
    expect(cargaSemanal([treinoComCarga(40, 999)], HOJE, 2)).toEqual([0, 0])
  })

  it('ignora treinos posteriores ao fim da semana atual', () => {
    expect(cargaSemanal([treinoComCarga(-5, 999)], HOJE, 2)).toEqual([0, 0])
  })
})

// ── prontidao ───────────────────────────────────────────────

describe('prontidao', () => {
  it('é a média de sono, energia e ausência de dor (6 - dor)', () => {
    expect(prontidao(checkin({ sono: 3, energia: 3, dor: 3 }))).toBe(3)
    expect(prontidao(checkin({ sono: 4, energia: 2, dor: 2 }))).toBeCloseTo((4 + 2 + 4) / 3, 10)
  })

  it('vai de 1 (tudo pior) a 5 (tudo melhor)', () => {
    expect(prontidao(checkin({ sono: 1, energia: 1, dor: 5 }))).toBe(1)
    expect(prontidao(checkin({ sono: 5, energia: 5, dor: 1 }))).toBe(5)
  })
})

// ── sugerirAjuste ───────────────────────────────────────────

describe('sugerirAjuste', () => {
  it('devolve null quando não há check-in', () => {
    expect(sugerirAjuste(null, 'tec', 6)).toBeNull()
  })

  describe('nível "normal"', () => {
    it('mantém tipo e rounds quando o score é alto', () => {
      const a = sugerirAjuste(checkin(), 'spa', 6)!
      expect(a).toMatchObject({ nivel: 'normal', tipo: 'spa', rounds: 6, score: 5, titulo: 'Você está pronto' })
    })

    it('score exatamente 4 (limite de cima do "reduzir" é 3,7) é normal', () => {
      const a = sugerirAjuste(checkin({ sono: 4, energia: 4, dor: 2 }), 'con', 8)!
      expect(a.nivel).toBe('normal')
      expect(a.rounds).toBe(8)
    })

    it('dor 3 sozinha não derruba o treino se sono e energia estão ótimos', () => {
      const a = sugerirAjuste(checkin({ sono: 5, energia: 5, dor: 3 }), 'tec', 6)!
      expect(a.nivel).toBe('normal')
    })
  })

  describe('nível "reduzir"', () => {
    it('score 3,67 (11/3) reduz cerca de 25% dos rounds mantendo o tipo', () => {
      const a = sugerirAjuste(checkin({ sono: 4, energia: 4, dor: 3 }), 'tec', 8)!
      expect(a.nivel).toBe('reduzir')
      expect(a.tipo).toBe('tec')
      expect(a.rounds).toBe(6)
      expect(a.score).toBeCloseTo(11 / 3, 10)
    })

    it('score exatamente 3 já é "reduzir" (não "leve")', () => {
      const a = sugerirAjuste(checkin({ sono: 3, energia: 3, dor: 3 }), 'tec', 8)!
      expect(a.nivel).toBe('reduzir')
    })

    it('não troca sparring por técnica', () => {
      const a = sugerirAjuste(checkin({ sono: 3, energia: 3, dor: 3 }), 'spa', 4)!
      expect(a.nivel).toBe('reduzir')
      expect(a.tipo).toBe('spa')
      expect(a.rounds).toBe(3)
    })

    it('arredonda 75% dos rounds (ex.: 6 -> 5 e 10 -> 8)', () => {
      const c = checkin({ sono: 3, energia: 3, dor: 3 })
      expect(sugerirAjuste(c, 'tec', 6)!.rounds).toBe(5) // 4,5 -> 5
      expect(sugerirAjuste(c, 'tec', 10)!.rounds).toBe(8) // 7,5 -> 8
    })

    it('nunca sugere menos de 2 rounds', () => {
      const c = checkin({ sono: 3, energia: 3, dor: 3 })
      expect(sugerirAjuste(c, 'tec', 2)!.rounds).toBe(2)
      expect(sugerirAjuste(c, 'tec', 3)!.rounds).toBe(2)
    })
  })

  describe('nível "leve"', () => {
    it('score logo abaixo de 3 (8/3) é "leve" com metade dos rounds', () => {
      const a = sugerirAjuste(checkin({ sono: 2, energia: 3, dor: 3 }), 'con', 8)!
      // (2 + 3 + 3) / 3 = 2,67, com dor 3 (a dor não é o gatilho)
      expect(a.score).toBeCloseTo(8 / 3, 10)
      expect(a.nivel).toBe('leve')
      expect(a.tipo).toBe('con')
      expect(a.rounds).toBe(4)
    })

    it('dor 4 força "leve" mesmo com sono e energia perfeitos', () => {
      const a = sugerirAjuste(checkin({ sono: 5, energia: 5, dor: 4 }), 'tec', 6)!
      expect(a.score).toBe(4)
      expect(a.nivel).toBe('leve')
      expect(a.rounds).toBe(3)
    })

    it('troca sparring por técnica e explica o motivo', () => {
      const a = sugerirAjuste(checkin({ sono: 5, energia: 5, dor: 4 }), 'spa', 6)!
      expect(a.nivel).toBe('leve')
      expect(a.tipo).toBe('tec')
      expect(a.rounds).toBe(3)
      expect(a.motivo).toContain('Sparring não é indicado')
    })

    it('mantém o tipo quando não é sparring e usa o texto genérico', () => {
      const a = sugerirAjuste(checkin({ sono: 5, energia: 5, dor: 4 }), 'con', 6)!
      expect(a.tipo).toBe('con')
      expect(a.motivo).not.toContain('Sparring')
    })

    it('nunca sugere menos de 2 rounds', () => {
      const c = checkin({ sono: 5, energia: 5, dor: 4 })
      expect(sugerirAjuste(c, 'tec', 2)!.rounds).toBe(2)
      expect(sugerirAjuste(c, 'tec', 3)!.rounds).toBe(2) // 1,5 -> 2
    })
  })

  describe('nível "descanso"', () => {
    it('score abaixo de 2,3 manda descansar com 0 rounds', () => {
      const a = sugerirAjuste(checkin({ sono: 2, energia: 2, dor: 4 }), 'tec', 6)!
      // (2 + 2 + 2) / 3 = 2
      expect(a.nivel).toBe('descanso')
      expect(a.rounds).toBe(0)
      expect(a.tipo).toBe('tec')
      expect(a.titulo).toBe('Hoje é dia de descansar')
    })

    it('dor 5 manda descansar mesmo com sono e energia perfeitos (score 3,67)', () => {
      const a = sugerirAjuste(checkin({ sono: 5, energia: 5, dor: 5 }), 'spa', 4)!
      expect(a.score).toBeCloseTo(11 / 3, 10)
      expect(a.nivel).toBe('descanso')
      expect(a.rounds).toBe(0)
    })

    it('score 2,33 (7/3) não chega a "descanso": cai em "leve"', () => {
      const a = sugerirAjuste(checkin({ sono: 2, energia: 3, dor: 4 }), 'tec', 6)!
      expect(a.score).toBeCloseTo(7 / 3, 10)
      expect(a.nivel).toBe('leve')
    })

    it('pior cenário possível', () => {
      const a = sugerirAjuste(checkin({ sono: 1, energia: 1, dor: 5 }), 'tec', 6)!
      expect(a).toMatchObject({ nivel: 'descanso', rounds: 0, score: 1 })
    })
  })

  it('devolve o score do check-in em todos os níveis', () => {
    expect(sugerirAjuste(checkin({ sono: 3, energia: 3, dor: 3 }), 'tec', 6)!.score).toBe(3)
  })

  // Suspeito de bug: a sugestão "reduzir/leve" pode AUMENTAR o volume por causa do piso de 2 rounds.
  it.fails('uma sugestão de redução nunca passa dos rounds planejados (plano com 1 round)', () => {
    const a = sugerirAjuste(checkin({ sono: 3, energia: 3, dor: 3 }), 'tec', 1)!
    expect(a.nivel).toBe('reduzir')
    expect(a.rounds).toBeLessThanOrEqual(1)
  })
})

// ── gerarAlertas ────────────────────────────────────────────

describe('gerarAlertas', () => {
  it('sem histórico, lesões, nem sessão e com meta distante não alerta nada', () => {
    expect(alertas()).toEqual([])
  })

  describe('pancadas fortes na cabeça', () => {
    it('no mesmo dia: crítico, "poucas horas" e 7 dias sem sparring', () => {
      const a = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoHorasAtras(2) })] })
      const c = a.find(x => x.id === 'cabeca-recente')!
      expect(c.nivel).toBe('critico')
      expect(c.texto).toContain('há poucas horas')
      expect(c.texto).toContain('Evite sparring por mais 7 dias')
      expect(c.texto).toContain('procure atendimento médico')
    })

    it('há 1 dia usa singular "1 dia" e restam 6 dias', () => {
      const c = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoDiasAtras(1) })] }).find(x => x.id === 'cabeca-recente')!
      expect(c.texto).toContain('há 1 dia.')
      expect(c.texto).toContain('mais 6 dias')
    })

    it('há 6 dias ainda é crítico, restando 1 dia (singular)', () => {
      const c = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoDiasAtras(6) })] }).find(x => x.id === 'cabeca-recente')!
      expect(c.nivel).toBe('critico')
      expect(c.texto).toContain('há 6 dias')
      expect(c.texto).toContain('mais 1 dia.')
    })

    it('há 7 dias vira "atencao" (volta gradual) e deixa de ser crítico', () => {
      const a = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoDiasAtras(7) })] })
      expect(ids(a)).toContain('cabeca-retorno')
      expect(ids(a)).not.toContain('cabeca-recente')
      expect(a.find(x => x.id === 'cabeca-retorno')!.nivel).toBe('atencao')
    })

    it('há 13 dias ainda alerta o retorno gradual', () => {
      const a = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoDiasAtras(13) })] })
      const r = a.find(x => x.id === 'cabeca-retorno')!
      expect(r.texto).toContain('há 13 dias')
    })

    it('há 14 dias ou mais não alerta mais', () => {
      const a = alertas({ historico: [sparring({ cabeca: 'fortes', data: isoDiasAtras(14) })] })
      expect(ids(a).filter(i => i.startsWith('cabeca'))).toEqual([])
    })

    it('só olha a pancada forte mais recente', () => {
      const a = alertas({ historico: [
        sparring({ cabeca: 'fortes', data: isoDiasAtras(10) }),
        sparring({ cabeca: 'fortes', data: isoDiasAtras(3) }),
      ] })
      expect(ids(a).filter(i => i.startsWith('cabeca'))).toEqual(['cabeca-recente'])
    })

    it('pancadas leves ou nenhuma não geram alerta de cabeça', () => {
      const a = alertas({ historico: [
        sparring({ cabeca: 'leves', data: isoDiasAtras(1) }),
        sparring({ cabeca: 'nenhum', data: isoDiasAtras(2) }),
      ] })
      expect(ids(a).filter(i => i.startsWith('cabeca'))).toEqual([])
    })

    it('treino sem detalhes de sparring não gera alerta de cabeça', () => {
      expect(ids(alertas({ historico: [treino({ data: isoDiasAtras(1) })] })).filter(i => i.startsWith('cabeca'))).toEqual([])
    })

    it('um registro de pancada forte em treino que não é sparring também alerta', () => {
      const t = treino({ tipo: 'tec', data: isoDiasAtras(1), sparring: { intensidade: 'forte', cabeca: 'fortes' } })
      expect(ids(alertas({ historico: [t] }))).toContain('cabeca-recente')
    })
  })

  describe('lesões ativas', () => {
    it('intensidade 3 gera alerta de "atencao" com a região e a intensidade', () => {
      const a = alertas({ lesoes: [lesao({ regiao: 'ombros', intensidade: 3 })] })
      expect(a).toHaveLength(1)
      expect(a[0]).toMatchObject({ id: 'lesao-l1', nivel: 'atencao', titulo: 'Lesão ativa: Ombros (3/5)' })
      expect(a[0].texto).toContain('Adapte o treino')
    })

    it('intensidade 4 e 5 são críticas', () => {
      const a = alertas({ lesoes: [lesao({ id: 'a', intensidade: 4 }), lesao({ id: 'b', intensidade: 5, regiao: 'cabeca' })] })
      expect(a.map(x => x.nivel)).toEqual(['critico', 'critico'])
      expect(a[0].texto).toContain('fisioterapeuta ou médico')
      expect(a[1].titulo).toBe('Lesão ativa: Cabeça / pescoço (5/5)')
    })

    it('lesões de intensidade 1 e 2 não alertam (comportamento atual)', () => {
      expect(alertas({ lesoes: [lesao({ id: 'a', intensidade: 1 }), lesao({ id: 'b', intensidade: 2 })] })).toEqual([])
    })

    it('lesão resolvida não alerta, mesmo forte', () => {
      expect(alertas({ lesoes: [lesao({ intensidade: 5, resolvidaEm: '2026-10-10' })] })).toEqual([])
    })

    it('gera um alerta por lesão ativa, com id próprio', () => {
      const a = alertas({ lesoes: [lesao({ id: 'x', intensidade: 3 }), lesao({ id: 'y', intensidade: 3, regiao: 'punhos' })] })
      expect(ids(a)).toEqual(['lesao-x', 'lesao-y'])
    })
  })

  describe('sparring em intervalo curto', () => {
    it('alerta se o último sparring foi há menos de 48h e hoje há sparring previsto', () => {
      const a = alertas({ sessaoHojeTipo: 'spa', historico: [sparring({ data: isoHorasAtras(30) })] })
      const x = a.find(i => i.id === 'sparring-intervalo')!
      expect(x.nivel).toBe('atencao')
      expect(x.texto).toContain('48 horas')
    })

    it('47h ainda alerta; exatamente 48h não alerta', () => {
      expect(ids(alertas({ sessaoHojeTipo: 'spa', historico: [sparring({ data: isoHorasAtras(47) })] }))).toContain('sparring-intervalo')
      expect(ids(alertas({ sessaoHojeTipo: 'spa', historico: [sparring({ data: isoHorasAtras(48) })] }))).not.toContain('sparring-intervalo')
    })

    it('não alerta se a sessão de hoje não é sparring (técnica, condicionamento ou nenhuma)', () => {
      const h = [sparring({ data: isoHorasAtras(10) })]
      for (const tipo of ['tec', 'con', null] as (RegType | null)[]) {
        expect(ids(alertas({ sessaoHojeTipo: tipo, historico: h }))).not.toContain('sparring-intervalo')
      }
    })

    it('treinos de outros tipos recentes não contam como sparring', () => {
      const a = alertas({ sessaoHojeTipo: 'spa', historico: [treino({ tipo: 'tec', data: isoHorasAtras(10) })] })
      expect(ids(a)).not.toContain('sparring-intervalo')
    })

    it('sem sparring anterior não alerta', () => {
      expect(ids(alertas({ sessaoHojeTipo: 'spa' }))).not.toContain('sparring-intervalo')
    })

    it('usa o sparring mais recente, mesmo que haja treino de outro tipo depois', () => {
      const h = [sparring({ data: isoHorasAtras(40) }), treino({ tipo: 'tec', data: isoHorasAtras(5) })]
      expect(ids(alertas({ sessaoHojeTipo: 'spa', historico: h }))).toContain('sparring-intervalo')
    })
  })

  describe('carga subindo rápido', () => {
    const base = [treinoComCarga(13, 100)] // crônica 100

    it('razão 1,4 gera alerta de "atencao" com a razão em pt-BR', () => {
      const a = alertas({ historico: [...base, treinoComCarga(2, 140)] }).find(x => x.id === 'carga')!
      expect(a.nivel).toBe('atencao')
      expect(a.titulo).toBe('Subindo rápido')
      expect(a.texto).toContain('1,4× acima da sua média recente')
    })

    it('razão acima de 1,5 é crítica', () => {
      const a = alertas({ historico: [...base, treinoComCarga(2, 160)] }).find(x => x.id === 'carga')!
      expect(a.nivel).toBe('critico')
      expect(a.titulo).toBe('Carga alta demais')
      expect(a.texto).toContain('1,6×')
    })

    it('razão exatamente 1,3 (ideal) não alerta', () => {
      expect(ids(alertas({ historico: [...base, treinoComCarga(2, 130)] }))).not.toContain('carga')
    })

    it('razão 1,31 alerta como "atencao"', () => {
      expect(alertas({ historico: [...base, treinoComCarga(2, 131)] }).find(x => x.id === 'carga')!.nivel).toBe('atencao')
    })

    it('exatamente 1,5 ainda é "atencao" e 1,51 é crítico', () => {
      expect(alertas({ historico: [...base, treinoComCarga(2, 150)] }).find(x => x.id === 'carga')!.nivel).toBe('atencao')
      expect(alertas({ historico: [...base, treinoComCarga(2, 151)] }).find(x => x.id === 'carga')!.nivel).toBe('critico')
    })

    it('carga baixa não gera alerta', () => {
      expect(ids(alertas({ historico: [...base, treinoComCarga(2, 20)] }))).not.toContain('carga')
    })

    it('sem histórico suficiente não alerta carga', () => {
      expect(ids(alertas({ historico: [treinoComCarga(2, 500)] }))).not.toContain('carga')
    })
  })

  describe('último treino muito intenso', () => {
    it('RPE 9 há menos de 48h alerta', () => {
      const a = alertas({ historico: [treino({ rpe: 9, data: isoHorasAtras(20) })] }).find(x => x.id === 'rpe-alto')!
      expect(a.nivel).toBe('atencao')
      expect(a.texto).toContain('esforço 9/10')
    })

    it('RPE 10 também alerta', () => {
      expect(ids(alertas({ historico: [treino({ rpe: 10, data: isoHorasAtras(1) })] }))).toContain('rpe-alto')
    })

    it('RPE 8 não alerta', () => {
      expect(ids(alertas({ historico: [treino({ rpe: 8, data: isoHorasAtras(1) })] }))).not.toContain('rpe-alto')
    })

    it('47h alerta; 48h não', () => {
      expect(ids(alertas({ historico: [treino({ rpe: 9, data: isoHorasAtras(47) })] }))).toContain('rpe-alto')
      expect(ids(alertas({ historico: [treino({ rpe: 9, data: isoHorasAtras(48) })] }))).not.toContain('rpe-alto')
    })

    it('só considera o último treino: um treino leve depois do pesado desliga o alerta', () => {
      const h = [treino({ rpe: 10, data: isoHorasAtras(30) }), treino({ rpe: 3, data: isoHorasAtras(5) })]
      expect(ids(alertas({ historico: h }))).not.toContain('rpe-alto')
    })

    it('acha o último treino independentemente da ordem do array', () => {
      const h = [treino({ rpe: 3, data: isoHorasAtras(5) }), treino({ rpe: 10, data: isoHorasAtras(30) })]
      expect(ids(alertas({ historico: h }))).not.toContain('rpe-alto')
    })
  })

  describe('meta semanal (quarta-feira: restam 5 dias, contando hoje)', () => {
    const naSemana = (n: number) => Array.from({ length: n }, (_, i) => treino({ data: isoDiasAtras(2 - Math.min(i, 2), 8 + i) }))

    it('meta batida: informa com plural', () => {
      const a = alertas({ historico: naSemana(3), metaSemanal: 3 }).find(x => x.id === 'meta-batida')!
      expect(a.nivel).toBe('info')
      expect(a.texto).toContain('Você fez 3 treinos e a meta era 3')
    })

    it('meta batida com 1 treino usa singular', () => {
      const a = alertas({ historico: naSemana(1), metaSemanal: 1 }).find(x => x.id === 'meta-batida')!
      expect(a.texto).toContain('Você fez 1 treino e a meta era 1')
    })

    it('treinar acima da meta continua marcando meta batida', () => {
      expect(ids(alertas({ historico: naSemana(4), metaSemanal: 3 }))).toContain('meta-batida')
    })

    it('treinos da semana passada não contam para a meta', () => {
      const a = alertas({ historico: [treino({ data: isoDiasAtras(3) }), treino({ data: isoDiasAtras(4) })], metaSemanal: 2 })
      // domingo 11/10 e sábado 10/10 são da semana anterior
      expect(ids(a)).not.toContain('meta-batida')
    })

    it('só avisa a meta apertada quando os dias restantes não superam os treinos que faltam', () => {
      expect(ids(alertas({ historico: [], metaSemanal: 5 }))).toEqual(['meta-risco']) // 5 dias restantes <= 5 faltam
      expect(ids(alertas({ historico: [], metaSemanal: 4 }))).toEqual([])
    })

    it('meta apertada: faltam tantos treinos quanto dias restantes', () => {
      const a = alertas({ historico: naSemana(1), metaSemanal: 6 }).find(x => x.id === 'meta-risco')!
      expect(a.nivel).toBe('info')
      expect(a.texto).toContain('Faltam 5 treinos e restam 5 dias')
    })

    it('um treino a mais tira a meta do aperto', () => {
      expect(ids(alertas({ historico: naSemana(2), metaSemanal: 6 }))).not.toContain('meta-risco')
    })

    it('domingo: restando 1 dia e faltando 1 treino usa o singular', () => {
      const domingo = new Date(2026, 9, 18, 12, 0, 0)
      const h = [treino({ data: new Date(2026, 9, 12, 9).toISOString() }), treino({ data: new Date(2026, 9, 14, 9).toISOString() })]
      const a = alertas({ hoje: domingo, historico: h, metaSemanal: 3 }).find(x => x.id === 'meta-risco')!
      expect(a.texto).toContain('Faltam 1 treino e restam 1 dia')
    })

    it('segunda-feira: restam 7 dias', () => {
      const segunda = new Date(2026, 9, 12, 8, 0, 0)
      const a = alertas({ hoje: segunda, metaSemanal: 7 }).find(x => x.id === 'meta-risco')!
      expect(a.texto).toContain('Faltam 7 treinos e restam 7 dias')
      expect(ids(alertas({ hoje: segunda, metaSemanal: 6 }))).toEqual([])
    })
  })

  describe('ordenação', () => {
    it('crítico antes de atenção antes de info', () => {
      const a = alertas({
        // inseridos "fora de ordem" de propósito: a lesão leve (atenção) vem antes da forte (crítica)
        lesoes: [lesao({ id: 'leve', intensidade: 3 }), lesao({ id: 'forte', intensidade: 4 })],
        historico: [treino({ data: isoDiasAtras(1) })],
        metaSemanal: 1,
      })
      expect(a.map(x => x.nivel)).toEqual(['critico', 'atencao', 'info'])
      expect(ids(a)).toEqual(['lesao-forte', 'lesao-leve', 'meta-batida'])
    })

    it('pancada na cabeça e carga alta (críticos) vêm antes de sparring curto (atenção)', () => {
      const a = alertas({
        sessaoHojeTipo: 'spa',
        historico: [
          treinoComCarga(13, 100),
          treinoComCarga(2, 160),
          sparring({ cabeca: 'fortes', data: isoHorasAtras(30), rounds: 20, minPorRound: 1, rpe: 1 }),
        ],
      })
      const niveis = a.map(x => x.nivel)
      expect(niveis).toEqual([...niveis].sort((x, y) => ['critico', 'atencao', 'info'].indexOf(x) - ['critico', 'atencao', 'info'].indexOf(y)))
      expect(ids(a).slice(0, 2)).toEqual(['cabeca-recente', 'carga'])
      expect(ids(a)).toContain('sparring-intervalo')
    })

    it('mantém a ordem de inserção entre alertas do mesmo nível', () => {
      const a = alertas({
        sessaoHojeTipo: 'spa',
        lesoes: [lesao({ intensidade: 3 })],
        historico: [sparring({ data: isoHorasAtras(20), rpe: 9 })],
      })
      // lesão, sparring curto e rpe alto são todos "atencao"
      expect(ids(a)).toEqual(['lesao-l1', 'sparring-intervalo', 'rpe-alto'])
    })
  })

  it('todos os alertas trazem id, título, texto e ícone preenchidos', () => {
    const a = alertas({
      sessaoHojeTipo: 'spa',
      lesoes: [lesao({ intensidade: 4 })],
      historico: [treinoComCarga(13, 100), treinoComCarga(2, 160), sparring({ cabeca: 'fortes', data: isoHorasAtras(10), rpe: 9 })],
      metaSemanal: 2,
    })
    expect(a.length).toBeGreaterThanOrEqual(5)
    for (const x of a) {
      expect(x.id).toBeTruthy()
      expect(x.titulo).toBeTruthy()
      expect(x.texto).toBeTruthy()
      expect(x.icone).toMatch(/^ph-/)
    }
  })

  it('não altera o array de histórico recebido', () => {
    const h = [treino({ data: isoDiasAtras(5) }), treino({ data: isoDiasAtras(1) })]
    const copia = h.map(t => t.id)
    alertas({ historico: h })
    expect(h.map(t => t.id)).toEqual(copia)
  })
})

// ── resumoCabeca ────────────────────────────────────────────

describe('resumoCabeca', () => {
  it('sem histórico: tudo zerado e sem último forte', () => {
    expect(resumoCabeca([], HOJE)).toEqual({ sparrings: 0, leves: 0, fortes: 0, ultimoForte: null })
  })

  it('conta sparrings e separa impactos leves e fortes', () => {
    const h = [
      sparring({ cabeca: 'nenhum', data: isoDiasAtras(1) }),
      sparring({ cabeca: 'leves', data: isoDiasAtras(2) }),
      sparring({ cabeca: 'leves', data: isoDiasAtras(3) }),
      sparring({ cabeca: 'fortes', data: isoDiasAtras(4) }),
    ]
    const r = resumoCabeca(h, HOJE)
    expect(r).toMatchObject({ sparrings: 4, leves: 2, fortes: 1 })
  })

  it('ultimoForte é a data do sparring forte mais recente', () => {
    const recente = isoDiasAtras(3)
    const h = [sparring({ cabeca: 'fortes', data: isoDiasAtras(10) }), sparring({ cabeca: 'fortes', data: recente })]
    const r = resumoCabeca(h, HOJE)
    expect(r.fortes).toBe(2)
    expect(r.ultimoForte?.getTime()).toBe(new Date(recente).getTime())
  })

  it('considera só sparring: outros tipos ficam de fora, mesmo com impacto registrado', () => {
    const h = [
      treino({ tipo: 'tec', data: isoDiasAtras(1), sparring: { intensidade: 'forte', cabeca: 'fortes' } }),
      treino({ tipo: 'con', data: isoDiasAtras(2) }),
    ]
    expect(resumoCabeca(h, HOJE)).toEqual({ sparrings: 0, leves: 0, fortes: 0, ultimoForte: null })
  })

  it('sparring sem detalhes conta como sparring, mas sem impacto', () => {
    const r = resumoCabeca([treino({ tipo: 'spa', data: isoDiasAtras(1) })], HOJE)
    expect(r).toEqual({ sparrings: 1, leves: 0, fortes: 0, ultimoForte: null })
  })

  it('janela padrão de 30 dias: 29 dias atrás entra, 30 dias atrás não', () => {
    expect(resumoCabeca([sparring({ data: isoDiasAtras(29) })], HOJE).sparrings).toBe(1)
    expect(resumoCabeca([sparring({ data: isoDiasAtras(30) })], HOJE).sparrings).toBe(0)
  })

  it('o dia de hoje entra inteiro, mesmo horário depois de "agora"', () => {
    expect(resumoCabeca([sparring({ data: isoDiasAtras(0, 23) })], HOJE).sparrings).toBe(1)
  })

  it('respeita uma janela personalizada', () => {
    const h = [sparring({ data: isoDiasAtras(6) }), sparring({ data: isoDiasAtras(7) })]
    expect(resumoCabeca(h, HOJE, 7).sparrings).toBe(1)
    expect(resumoCabeca(h, HOJE, 8).sparrings).toBe(2)
  })

  it('não altera a ordem do histórico original', () => {
    const h = [sparring({ cabeca: 'fortes', data: isoDiasAtras(5) }), sparring({ cabeca: 'fortes', data: isoDiasAtras(1) })]
    const ordem = h.map(t => t.id)
    resumoCabeca(h, HOJE)
    expect(h.map(t => t.id)).toEqual(ordem)
  })
})

// ── checkinDeHoje ───────────────────────────────────────────

describe('checkinDeHoje', () => {
  it('devolve o check-in cuja data é a chave de hoje', () => {
    const hoje = checkin({ data: '2026-10-14', sono: 2 })
    const lista = [checkin({ data: '2026-10-13' }), hoje, checkin({ data: '2026-10-15' })]
    expect(checkinDeHoje(lista, HOJE)).toBe(hoje)
  })

  it('devolve null quando só há check-ins de outros dias ou a lista é vazia', () => {
    expect(checkinDeHoje([checkin({ data: '2026-10-13' })], HOJE)).toBeNull()
    expect(checkinDeHoje([], HOJE)).toBeNull()
  })

  it('não depende da hora do dia', () => {
    const c = checkin({ data: '2026-10-14' })
    expect(checkinDeHoje([c], new Date(2026, 9, 14, 0, 0, 1))).toBe(c)
    expect(checkinDeHoje([c], new Date(2026, 9, 14, 23, 59, 59))).toBe(c)
  })

  it('com duplicatas no mesmo dia, devolve a primeira encontrada', () => {
    const a = checkin({ sono: 1 })
    const b = checkin({ sono: 5 })
    expect(checkinDeHoje([a, b], HOJE)).toBe(a)
  })
})
