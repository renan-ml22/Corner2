import { describe, expect, it } from 'vitest'
import { getPlano, PLANOS, type Plano } from '@/data/planos'
import { chaveDia } from '@/lib/datas'
import type { PlanoAtivo, RegType, WorkoutEntry } from '@/lib/tipos'
import {
  chaveReagendamento,
  diasTreinadosNaSemana,
  estatisticasDoMes,
  proximaSessao,
  segundaDaSemanaDoPlano,
  semanaAtualDoPlano,
  sequenciaDeSemanas,
  sessaoDeHoje,
  sessoesComStatus,
  sugestaoSemPlano,
  treinosEntre,
  treinosNaSemanaAtual,
  volumeSemanal,
} from '@/lib/treinos'

// ── Fábricas ─────────────────────────────────────────────────

/** Data local a partir de 'YYYY-MM-DD' (meio-dia por padrão, longe das viradas de dia). */
function dia(chave: string, hora = 12, minuto = 0, segundo = 0, ms = 0): Date {
  const [y, m, d] = chave.split('-').map(Number)
  return new Date(y, m - 1, d, hora, minuto, segundo, ms)
}

let contador = 0

function treino(chave: string, tipo: RegType = 'tec', extra: Partial<WorkoutEntry> = {}): WorkoutEntry {
  contador++
  const { data, ...resto } = extra
  return {
    id: `t${contador}`,
    data: data ?? dia(chave).toISOString(),
    tipo,
    rounds: 6,
    minPorRound: 3,
    rpe: 7,
    duracaoSegundos: 1800,
    ...resto,
  }
}

/** Plano mínimo: seg tec, qua con, sex tec em todas as semanas; domingo spa só nas semanas 2-3. */
const PLANO: Plano = {
  id: 'teste',
  nome: 'Plano de teste',
  nivel: 'iniciante',
  nivelLabel: 'Iniciante',
  semanas: 3,
  diasPorSemana: 3,
  resumo: '',
  sessoes: [
    { id: 'a-seg', diaSemana: 1, tipo: 'tec', titulo: 'Seg', rounds: 4, minPorRound: 2, descansoSeg: 60, descricao: '', checklist: [] },
    { id: 'a-qua', diaSemana: 3, tipo: 'con', titulo: 'Qua', rounds: 4, minPorRound: 2, descansoSeg: 60, descricao: '', checklist: [] },
    { id: 'a-sex', diaSemana: 5, tipo: 'tec', titulo: 'Sex', rounds: 4, minPorRound: 2, descansoSeg: 60, descricao: '', checklist: [] },
    { id: 'a-dom', diaSemana: 0, tipo: 'spa', titulo: 'Dom', rounds: 4, minPorRound: 2, descansoSeg: 60, descricao: '', checklist: [], semanas: [2, 3] },
  ],
}

// Semana 1 = 05/10/2026 (segunda) a 11/10; semana 2 = 12/10 a 18/10; semana 3 = 19/10 a 25/10.
const ATIVO: PlanoAtivo = { planoId: 'teste', inicio: '2026-10-05' }

const ids = (l: { sessao: { id: string } }[]) => l.map(x => x.sessao.id)
const statuses = (l: { status: string }[]) => l.map(x => x.status)

// ── semanaAtualDoPlano ───────────────────────────────────────

describe('semanaAtualDoPlano', () => {
  it('no dia de início do plano estamos na semana 1', () => {
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-05'))).toBe(1)
  })

  it('o domingo ainda é semana 1 e a segunda seguinte é semana 2', () => {
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-11', 23, 59))).toBe(1)
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-12', 0, 0))).toBe(2)
  })

  it('ignora a hora do dia', () => {
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-05', 0, 0))).toBe(semanaAtualDoPlano(ATIVO, dia('2026-10-05', 23, 59)))
  })

  it('passa do total de semanas quando o plano já terminou', () => {
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-25'))).toBe(3)
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-26'))).toBe(4)
    expect(semanaAtualDoPlano(ATIVO, dia('2027-03-01'))).toBeGreaterThan(PLANO.semanas)
  })

  it('antes do início devolve 0 na semana imediatamente anterior e negativo mais atrás', () => {
    expect(semanaAtualDoPlano(ATIVO, dia('2026-10-04'))).toBe(0)
    expect(semanaAtualDoPlano(ATIVO, dia('2026-09-28'))).toBe(0)
    expect(semanaAtualDoPlano(ATIVO, dia('2026-09-27'))).toBe(-1)
  })

  it('funciona atravessando a virada de ano', () => {
    const ativo: PlanoAtivo = { planoId: 'x', inicio: '2026-12-28' }
    expect(semanaAtualDoPlano(ativo, dia('2027-01-03'))).toBe(1)
    expect(semanaAtualDoPlano(ativo, dia('2027-01-04'))).toBe(2)
  })
})

// ── segundaDaSemanaDoPlano ───────────────────────────────────

describe('segundaDaSemanaDoPlano', () => {
  it('semana 1 é o próprio início do plano, à meia-noite local', () => {
    expect(segundaDaSemanaDoPlano(ATIVO, 1)).toEqual(new Date(2026, 9, 5))
  })

  it('cada semana seguinte soma 7 dias', () => {
    expect(chaveDia(segundaDaSemanaDoPlano(ATIVO, 2))).toBe('2026-10-12')
    expect(chaveDia(segundaDaSemanaDoPlano(ATIVO, 3))).toBe('2026-10-19')
  })

  it('semana 0 volta uma semana antes do início', () => {
    expect(chaveDia(segundaDaSemanaDoPlano(ATIVO, 0))).toBe('2026-09-28')
  })

  it('atravessa a virada de ano e de mês', () => {
    const ativo: PlanoAtivo = { planoId: 'x', inicio: '2026-12-28' }
    expect(chaveDia(segundaDaSemanaDoPlano(ativo, 2))).toBe('2027-01-04')
    expect(chaveDia(segundaDaSemanaDoPlano(ATIVO, 4))).toBe('2026-10-26')
    expect(chaveDia(segundaDaSemanaDoPlano(ATIVO, 5))).toBe('2026-11-02')
  })
})

// ── treinosEntre ─────────────────────────────────────────────

describe('treinosEntre', () => {
  const inicio = dia('2026-10-12', 0, 0)
  const fim = dia('2026-10-19', 0, 0)

  it('histórico vazio devolve lista vazia', () => {
    expect(treinosEntre([], inicio, fim)).toEqual([])
  })

  it('o limite inicial é inclusivo', () => {
    const t = treino('2026-10-12', 'tec', { data: inicio.toISOString() })
    expect(treinosEntre([t], inicio, fim)).toEqual([t])
  })

  it('o limite final é exclusivo', () => {
    const t = treino('2026-10-19', 'tec', { data: fim.toISOString() })
    expect(treinosEntre([t], inicio, fim)).toEqual([])
  })

  it('1 ms antes do fim ainda entra e 1 ms antes do início não entra', () => {
    const dentro = treino('2026-10-18', 'tec', { data: new Date(fim.getTime() - 1).toISOString() })
    const fora = treino('2026-10-11', 'tec', { data: new Date(inicio.getTime() - 1).toISOString() })
    expect(treinosEntre([dentro, fora], inicio, fim)).toEqual([dentro])
  })

  it('mantém a ordem original do histórico', () => {
    const a = treino('2026-10-15')
    const b = treino('2026-10-13')
    const c = treino('2026-10-14')
    expect(treinosEntre([a, b, c], inicio, fim)).toEqual([a, b, c])
  })

  it('intervalo vazio (início igual ao fim) não devolve nada', () => {
    const t = treino('2026-10-12', 'tec', { data: inicio.toISOString() })
    expect(treinosEntre([t], inicio, inicio)).toEqual([])
  })

  it('ignora treinos com data inválida', () => {
    const t = treino('2026-10-14', 'tec', { data: 'não é data' })
    expect(treinosEntre([t], inicio, fim)).toEqual([])
  })
})

// ── chaveReagendamento ───────────────────────────────────────

describe('chaveReagendamento', () => {
  it('monta "semana:sessaoId"', () => {
    expect(chaveReagendamento(2, 'a-seg')).toBe('2:a-seg')
  })
})

// ── sessoesComStatus ─────────────────────────────────────────

describe('sessoesComStatus', () => {
  const quarta = dia('2026-10-07') // semana 1

  it('sem histórico: passada = perdida, hoje = hoje, depois = futura', () => {
    const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta)
    expect(ids(r)).toEqual(['a-seg', 'a-qua', 'a-sex'])
    expect(statuses(r)).toEqual(['perdida', 'hoje', 'futura'])
    expect(r.every(s => s.treino === undefined)).toBe(true)
  })

  it('cada sessão traz a data correta dentro da semana', () => {
    const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta)
    expect(r.map(s => chaveDia(s.data))).toEqual(['2026-10-05', '2026-10-07', '2026-10-09'])
  })

  it('sessões com diaSemana 0 (domingo) vêm por último e caem no fim da semana', () => {
    const r = sessoesComStatus(PLANO, ATIVO, 2, [], dia('2026-10-12'))
    expect(ids(r)).toEqual(['a-seg', 'a-qua', 'a-sex', 'a-dom'])
    expect(chaveDia(r[3].data)).toBe('2026-10-18')
  })

  it('só inclui as sessões ativas na semana pedida', () => {
    expect(ids(sessoesComStatus(PLANO, ATIVO, 1, [], quarta))).not.toContain('a-dom')
    expect(ids(sessoesComStatus(PLANO, ATIVO, 3, [], quarta))).toContain('a-dom')
  })

  it('semana além do total do plano: só aparecem as sessões sem intervalo de semanas', () => {
    // Caracterização: sessões sem `semanas` valem para qualquer número de semana, mesmo além do total.
    const r = sessoesComStatus(PLANO, ATIVO, 9, [], quarta)
    expect(ids(r)).toEqual(['a-seg', 'a-qua', 'a-sex'])
  })

  it('treino do mesmo tipo no mesmo dia marca a sessão como feita e guarda o treino', () => {
    const t = treino('2026-10-07', 'con')
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], quarta)
    expect(statuses(r)).toEqual(['perdida', 'feita', 'futura'])
    expect(r[1].treino).toBe(t)
  })

  it('"feita" tem prioridade sobre "hoje"', () => {
    const t = treino('2026-10-07', 'con')
    expect(sessoesComStatus(PLANO, ATIVO, 1, [t], quarta)[1].status).toBe('feita')
  })

  it('treino de tipo diferente não conta para a sessão', () => {
    const t = treino('2026-10-07', 'spa')
    expect(statuses(sessoesComStatus(PLANO, ATIVO, 1, [t], quarta))).toEqual(['perdida', 'hoje', 'futura'])
  })

  it('treino feito em OUTRO dia da semana vale para a sessão do mesmo tipo (terça cobre a segunda)', () => {
    const t = treino('2026-10-06', 'tec') // terça
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], quarta)
    expect(statuses(r)).toEqual(['feita', 'hoje', 'futura'])
    expect(r[0].treino).toBe(t)
  })

  it('dois treinos tec em dias sem sessão cobrem as duas sessões tec (segunda e sexta), na ordem', () => {
    const t1 = treino('2026-10-05', 'tec')
    const t2 = treino('2026-10-06', 'tec')
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t1, t2], quarta)
    expect(r[0].treino).toBe(t1)
    expect(r[2].treino).toBe(t2)
    expect(r[2].status).toBe('feita')
  })

  it('prefere o treino do mesmo dia: tec na sexta vale para a sexta, não para a segunda', () => {
    const t = treino('2026-10-09', 'tec')
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], dia('2026-10-10'))
    expect(statuses(r)).toEqual(['perdida', 'perdida', 'feita'])
    expect(r[2].treino).toBe(t)
  })

  it('sem treino no dia da sessão, o treino solto vai para a sessão mais cedo do mesmo tipo', () => {
    const t = treino('2026-10-08', 'tec') // quinta: nem seg nem sex
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], dia('2026-10-08'))
    expect(r[0].treino).toBe(t)
    expect(statuses(r)).toEqual(['feita', 'perdida', 'futura'])
  })

  it('uma sessão não pode ser consumida por dois treinos', () => {
    // Dois treinos 'con' na semana, mas só uma sessão 'con'.
    const a = treino('2026-10-07', 'con')
    const b = treino('2026-10-08', 'con')
    const r = sessoesComStatus(PLANO, ATIVO, 1, [a, b], dia('2026-10-09'))
    expect(r.filter(s => s.treino).length).toBe(1)
    expect(r[1].treino).toBe(a)
  })

  it('um treino não pode cobrir duas sessões', () => {
    // Um único treino 'tec' e duas sessões 'tec' (seg e sex).
    const t = treino('2026-10-06', 'tec')
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], dia('2026-10-10'))
    expect(r.filter(s => s.treino === t).length).toBe(1)
    expect(statuses(r)).toEqual(['feita', 'perdida', 'perdida'])
  })

  it('ignora o campo sessaoId do treino: o cruzamento é só por tipo e data', () => {
    const t = treino('2026-10-05', 'tec', { sessaoId: 'a-sex' })
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], quarta)
    expect(r[0].treino).toBe(t)
    expect(r[2].treino).toBeUndefined()
  })

  it('treinos de outras semanas não contam (domingo anterior 23:59 e segunda seguinte 00:00)', () => {
    const antes = treino('2026-10-04', 'tec', { data: dia('2026-10-04', 23, 59).toISOString() })
    const depois = treino('2026-10-12', 'tec', { data: dia('2026-10-12', 0, 0).toISOString() })
    const r = sessoesComStatus(PLANO, ATIVO, 1, [antes, depois], dia('2026-10-11'))
    expect(r.every(s => !s.treino)).toBe(true)
  })

  it('treino às 23:59 de domingo ainda conta para a semana', () => {
    const t = treino('2026-10-11', 'tec', { data: dia('2026-10-11', 23, 59).toISOString() })
    const r = sessoesComStatus(PLANO, ATIVO, 1, [t], dia('2026-10-11'))
    expect(r[0].treino).toBe(t)
  })

  it('semana passada: sessões sem treino são perdidas; semana futura: todas futuras', () => {
    const hojeS2 = dia('2026-10-14')
    expect(statuses(sessoesComStatus(PLANO, ATIVO, 1, [], hojeS2))).toEqual(['perdida', 'perdida', 'perdida'])
    expect(statuses(sessoesComStatus(PLANO, ATIVO, 3, [], hojeS2))).toEqual(['futura', 'futura', 'futura', 'futura'])
  })

  it('hoje com hora no fim do dia continua sendo "hoje"', () => {
    const r = sessoesComStatus(PLANO, ATIVO, 1, [], dia('2026-10-07', 23, 59))
    expect(r[1].status).toBe('hoje')
  })

  describe('reagendamento', () => {
    it('move a sessão para o novo dia da semana e reordena a lista', () => {
      const reag = { [chaveReagendamento(1, 'a-seg')]: 4 } // segunda -> quinta
      const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta, reag)
      expect(ids(r)).toEqual(['a-qua', 'a-seg', 'a-sex'])
      expect(chaveDia(r[1].data)).toBe('2026-10-08')
      expect(statuses(r)).toEqual(['hoje', 'futura', 'futura'])
    })

    it('mover para o domingo (diaSemana 0) vai para o fim da semana', () => {
      const reag = { [chaveReagendamento(1, 'a-seg')]: 0 }
      const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta, reag)
      expect(chaveDia(r[2].data)).toBe('2026-10-11')
      expect(r[2].sessao.id).toBe('a-seg')
    })

    it('só vale para a semana indicada na chave', () => {
      const reag = { [chaveReagendamento(2, 'a-seg')]: 4 }
      const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta, reag)
      expect(chaveDia(r[0].data)).toBe('2026-10-05')
    })

    it('o treino feito no dia reagendado casa com a sessão reagendada', () => {
      const reag = { [chaveReagendamento(1, 'a-sex')]: 2 } // sexta -> terça
      const t = treino('2026-10-06', 'tec')
      const r = sessoesComStatus(PLANO, ATIVO, 1, [t], quarta, reag)
      expect(ids(r)).toEqual(['a-seg', 'a-sex', 'a-qua'])
      // O treino de terça é "mesmo dia" para a sessão reagendada, então ela é atendida antes da segunda.
      expect(r[1].sessao.id).toBe('a-sex')
      expect(r[1].treino).toBe(t)
      expect(r[0].treino).toBeUndefined()
    })

    it('sessão reagendada para hoje vira "hoje"', () => {
      const reag = { [chaveReagendamento(1, 'a-sex')]: 3 } // sexta -> quarta
      const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta, reag)
      expect(r.filter(s => s.status === 'hoje').map(s => s.sessao.id).sort()).toEqual(['a-qua', 'a-sex'])
    })

    it('sessão reagendada para um dia anterior a hoje e sem treino vira perdida', () => {
      const reag = { [chaveReagendamento(1, 'a-sex')]: 2 } // sexta -> terça
      const r = sessoesComStatus(PLANO, ATIVO, 1, [], quarta, reag)
      expect(r.find(s => s.sessao.id === 'a-sex')?.status).toBe('perdida')
    })
  })

  it('plano real Fundamentos: as sessões trocam de fase na semana 3', () => {
    const plano = getPlano('fundamentos')!
    const ativo: PlanoAtivo = { planoId: 'fundamentos', inicio: '2026-10-05' }
    expect(ids(sessoesComStatus(plano, ativo, 2, [], dia('2026-10-12')))).toEqual(['fun-s1-seg', 'fun-s1-qua', 'fun-s1-sex'])
    expect(ids(sessoesComStatus(plano, ativo, 3, [], dia('2026-10-19')))).toEqual(['fun-s3-seg', 'fun-s3-qua', 'fun-s3-sex'])
  })
})

// ── proximaSessao ────────────────────────────────────────────

describe('proximaSessao', () => {
  it('devolve a sessão de hoje, se ainda pendente, junto com a semana', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-10-07'))
    expect(r?.sessao.id).toBe('a-qua')
    expect(r?.status).toBe('hoje')
    expect(r?.semana).toBe(1)
  })

  it('se a sessão de hoje já foi feita, vai para a próxima futura', () => {
    const r = proximaSessao(PLANO, ATIVO, [treino('2026-10-07', 'con')], dia('2026-10-07'))
    expect(r?.sessao.id).toBe('a-sex')
    expect(r?.status).toBe('futura')
  })

  it('em dia sem sessão pega a próxima do plano', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-10-06'))
    expect(r?.sessao.id).toBe('a-qua')
    expect(r?.status).toBe('futura')
  })

  it('passa para a semana seguinte quando a atual não tem mais nada pendente', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-10-10')) // sábado da semana 1
    expect(r?.semana).toBe(2)
    expect(r?.sessao.id).toBe('a-seg')
    expect(chaveDia(r!.data)).toBe('2026-10-12')
  })

  it('sessões perdidas não são devolvidas', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-10-09')) // sexta
    expect(r?.sessao.id).toBe('a-sex')
  })

  it('antes do início do plano devolve a primeira sessão da semana 1 como futura', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-09-30'))
    expect(r?.semana).toBe(1)
    expect(r?.sessao.id).toBe('a-seg')
    expect(r?.status).toBe('futura')
  })

  it('na última semana, sábado ainda encontra o domingo', () => {
    const r = proximaSessao(PLANO, ATIVO, [], dia('2026-10-24'))
    expect(r?.sessao.id).toBe('a-dom')
    expect(r?.semana).toBe(3)
  })

  it('devolve null quando o plano já terminou', () => {
    expect(proximaSessao(PLANO, ATIVO, [], dia('2026-10-26'))).toBeNull()
    expect(proximaSessao(PLANO, ATIVO, [], dia('2027-06-01'))).toBeNull()
  })

  it('devolve null quando tudo da última semana já passou ou foi feito', () => {
    const feitos = [treino('2026-10-25', 'spa')]
    expect(proximaSessao(PLANO, ATIVO, feitos, dia('2026-10-25'))).toBeNull()
  })

  it('respeita reagendamentos', () => {
    const reag = { [chaveReagendamento(1, 'a-sex')]: 3 } // sexta -> quarta
    const feito = [treino('2026-10-07', 'con')]
    const r = proximaSessao(PLANO, ATIVO, feito, dia('2026-10-07'), reag)
    expect(r?.sessao.id).toBe('a-sex')
    expect(r?.status).toBe('hoje')
  })

  it('funciona com os planos reais: no dia de início sempre há uma próxima sessão na semana 1', () => {
    for (const plano of PLANOS) {
      const r = proximaSessao(plano, { planoId: plano.id, inicio: '2026-10-05' }, [], dia('2026-10-05'))
      expect(r, plano.id).not.toBeNull()
      expect(r!.semana, plano.id).toBe(1)
    }
  })
})

// ── sessaoDeHoje ─────────────────────────────────────────────

describe('sessaoDeHoje', () => {
  it('devolve a sessão marcada para hoje', () => {
    const r = sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-07'))
    expect(r?.sessao.id).toBe('a-qua')
    expect(r?.status).toBe('hoje')
  })

  it('devolve a sessão de hoje mesmo quando já foi feita', () => {
    const t = treino('2026-10-07', 'con')
    const r = sessaoDeHoje(PLANO, ATIVO, [t], dia('2026-10-07'))
    expect(r?.status).toBe('feita')
    expect(r?.treino).toBe(t)
  })

  it('devolve null em dia sem sessão', () => {
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-06'))).toBeNull()
  })

  it('o domingo só tem sessão a partir da semana 2', () => {
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-11'))).toBeNull()
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-18'))?.sessao.id).toBe('a-dom')
  })

  it('devolve null antes do início do plano', () => {
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-04'))).toBeNull()
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-09-30'))).toBeNull()
  })

  it('devolve null depois do fim do plano', () => {
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-28'))).toBeNull() // quarta da semana 4
  })

  it('considera sessões reagendadas para hoje', () => {
    const reag = { [chaveReagendamento(1, 'a-sex')]: 2 } // sexta -> terça
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-06'), reag)?.sessao.id).toBe('a-sex')
  })

  it('não encontra a sessão no dia original depois de reagendada', () => {
    const reag = { [chaveReagendamento(1, 'a-sex')]: 2 }
    expect(sessaoDeHoje(PLANO, ATIVO, [], dia('2026-10-09'), reag)).toBeNull()
  })
})

// ── diasTreinadosNaSemana ────────────────────────────────────

describe('diasTreinadosNaSemana', () => {
  const quarta = dia('2026-10-14') // semana de 12/10 a 18/10

  it('histórico vazio: nenhum dia treinado', () => {
    expect(diasTreinadosNaSemana([], quarta)).toEqual([false, false, false, false, false, false, false])
  })

  it('marca os dias de segunda (índice 0) a domingo (índice 6)', () => {
    const h = [treino('2026-10-12'), treino('2026-10-14'), treino('2026-10-18')]
    expect(diasTreinadosNaSemana(h, quarta)).toEqual([true, false, true, false, false, false, true])
  })

  it('dois treinos no mesmo dia marcam o dia uma vez só', () => {
    const h = [treino('2026-10-13'), treino('2026-10-13', 'con')]
    expect(diasTreinadosNaSemana(h, quarta)).toEqual([false, true, false, false, false, false, false])
  })

  it('ignora treinos de outras semanas', () => {
    const h = [treino('2026-10-11'), treino('2026-10-19')]
    expect(diasTreinadosNaSemana(h, quarta)).toEqual([false, false, false, false, false, false, false])
  })

  it('é igual qualquer que seja o dia da semana em que "hoje" cai', () => {
    const h = [treino('2026-10-12'), treino('2026-10-18')]
    const esperado = [true, false, false, false, false, false, true]
    expect(diasTreinadosNaSemana(h, dia('2026-10-12'))).toEqual(esperado)
    expect(diasTreinadosNaSemana(h, dia('2026-10-18', 23, 59))).toEqual(esperado)
  })

  it('treinos futuros da mesma semana também são marcados', () => {
    expect(diasTreinadosNaSemana([treino('2026-10-17')], quarta)[5]).toBe(true)
  })

  it('semana que cruza a virada do ano', () => {
    const h = [treino('2026-12-31'), treino('2027-01-01')]
    expect(diasTreinadosNaSemana(h, dia('2027-01-01'))).toEqual([false, false, false, true, true, false, false])
  })
})

// ── treinosNaSemanaAtual ─────────────────────────────────────

describe('treinosNaSemanaAtual', () => {
  const hoje = dia('2026-10-14')

  it('histórico vazio: zero', () => {
    expect(treinosNaSemanaAtual([], hoje)).toBe(0)
  })

  it('conta todos os treinos da semana de segunda a domingo, inclusive vários no mesmo dia', () => {
    const h = [treino('2026-10-12'), treino('2026-10-12', 'con'), treino('2026-10-18')]
    expect(treinosNaSemanaAtual(h, hoje)).toBe(3)
  })

  it('o limite da semana: domingo 23:59 é da semana anterior à segunda 00:00', () => {
    const domingo = treino('2026-10-11', 'tec', { data: dia('2026-10-11', 23, 59, 59, 999).toISOString() })
    const segunda = treino('2026-10-12', 'tec', { data: dia('2026-10-12', 0, 0).toISOString() })
    const proxima = treino('2026-10-19', 'tec', { data: dia('2026-10-19', 0, 0).toISOString() })
    expect(treinosNaSemanaAtual([domingo, segunda, proxima], hoje)).toBe(1)
  })

  it('quando hoje é domingo, a semana ainda começa na segunda anterior', () => {
    const h = [treino('2026-10-12'), treino('2026-10-17')]
    expect(treinosNaSemanaAtual(h, dia('2026-10-18'))).toBe(2)
  })

  it('virada de mês e de ano', () => {
    const h = [treino('2026-12-29'), treino('2027-01-02')]
    expect(treinosNaSemanaAtual(h, dia('2026-12-30'))).toBe(2)
    expect(treinosNaSemanaAtual(h, dia('2027-01-04'))).toBe(0)
  })
})

// ── sequenciaDeSemanas ───────────────────────────────────────

describe('sequenciaDeSemanas', () => {
  const hoje = dia('2026-10-14') // semana atual: 12/10 a 18/10
  /** n treinos na semana que começa em `segunda` (um por dia, a partir da segunda). */
  const semana = (segunda: string, n: number) => {
    const [y, m, d] = segunda.split('-').map(Number)
    return Array.from({ length: n }, (_, i) => treino(chaveDia(new Date(y, m - 1, d + i))))
  }

  it('histórico vazio: sequência 0', () => {
    expect(sequenciaDeSemanas([], 3, hoje)).toBe(0)
  })

  it('só a semana atual batendo a meta: sequência 1', () => {
    expect(sequenciaDeSemanas(semana('2026-10-12', 2), 2, hoje)).toBe(1)
  })

  it('semana atual incompleta não quebra a sequência, mas também não soma', () => {
    const h = [...semana('2026-10-12', 1), ...semana('2026-10-05', 2), ...semana('2026-09-28', 2)]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(2)
  })

  it('semana atual batendo a meta soma às anteriores', () => {
    const h = [...semana('2026-10-12', 2), ...semana('2026-10-05', 2), ...semana('2026-09-28', 2)]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(3)
  })

  it('semana atual vazia com semanas anteriores completas: conta só as anteriores', () => {
    const h = [...semana('2026-10-05', 3), ...semana('2026-09-28', 3)]
    expect(sequenciaDeSemanas(h, 3, hoje)).toBe(2)
  })

  it('uma semana anterior abaixo da meta quebra a sequência', () => {
    const h = [...semana('2026-10-12', 2), ...semana('2026-10-05', 1), ...semana('2026-09-28', 2)]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(1)
  })

  it('semana anterior abaixo da meta e semana atual incompleta: sequência 0', () => {
    const h = [...semana('2026-10-12', 1), ...semana('2026-10-05', 1), ...semana('2026-09-28', 2)]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(0)
  })

  it('semana sem nenhum treino no meio interrompe a contagem', () => {
    const h = [...semana('2026-10-12', 2), ...semana('2026-09-28', 2), ...semana('2026-09-21', 2)]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(1)
  })

  it('conta semanas, não dias: treinos acima da meta não aumentam a sequência', () => {
    const h = semana('2026-10-12', 7)
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(1)
  })

  it('a meta é comparada com o número de treinos, não de dias distintos', () => {
    const h = [treino('2026-10-13'), treino('2026-10-13', 'con')]
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(1)
  })

  it('sequência longa (10 semanas seguidas)', () => {
    const h = Array.from({ length: 10 }, (_, i) => {
      const seg = new Date(2026, 9, 12 - 7 * i)
      return treino(chaveDia(seg))
    })
    expect(sequenciaDeSemanas(h, 1, hoje)).toBe(10)
  })

  it('meta 0 é tratada como meta 1 (não trava e exige ao menos um treino)', () => {
    expect(sequenciaDeSemanas([], 0, hoje)).toBe(0)
    const h = [...semana('2026-10-12', 1), ...semana('2026-10-05', 1)]
    expect(sequenciaDeSemanas(h, 0, hoje)).toBe(2)
  })

  it('meta negativa também é tratada como 1', () => {
    expect(sequenciaDeSemanas(semana('2026-10-12', 1), -5, hoje)).toBe(1)
  })

  it('o limite entre semanas é segunda 00:00 (domingo 23:59 pertence à semana anterior)', () => {
    const h = [
      treino('2026-10-11', 'tec', { data: dia('2026-10-11', 23, 59).toISOString() }),
      treino('2026-10-12', 'tec', { data: dia('2026-10-12', 0, 0).toISOString() }),
    ]
    // meta 1: semana atual (segunda 00:00) = 1, semana anterior (domingo 23:59) = 1
    expect(sequenciaDeSemanas(h, 1, hoje)).toBe(2)
    // meta 2: nenhuma das duas semanas tem 2 treinos
    expect(sequenciaDeSemanas(h, 2, hoje)).toBe(0)
  })

  it('atravessa a virada de ano', () => {
    const h = [...semana('2027-01-04', 2), ...semana('2026-12-28', 2), ...semana('2026-12-21', 2)]
    expect(sequenciaDeSemanas(h, 2, dia('2027-01-06'))).toBe(3)
  })

  it('"hoje" no domingo ainda usa a semana que começou na segunda anterior', () => {
    const h = semana('2026-10-12', 2)
    expect(sequenciaDeSemanas(h, 2, dia('2026-10-18', 22, 0))).toBe(1)
    // Na segunda seguinte a semana nova está vazia (não quebra) e a anterior continua contando.
    expect(sequenciaDeSemanas(h, 2, dia('2026-10-19', 8, 0))).toBe(1)
    // Duas semanas depois, a semana intermediária vazia quebra a sequência.
    expect(sequenciaDeSemanas(h, 2, dia('2026-10-26', 8, 0))).toBe(0)
  })
})

// ── estatisticasDoMes ────────────────────────────────────────

describe('estatisticasDoMes', () => {
  const hoje = dia('2026-10-14')

  it('histórico vazio: zeros, rpeMedio nulo e todos os tipos presentes em porTipo', () => {
    expect(estatisticasDoMes([], hoje)).toEqual({
      treinos: 0, rounds: 0, minutos: 0, rpeMedio: null, porTipo: { tec: 0, con: 0, spa: 0 },
    })
  })

  it('soma treinos, rounds, minutos (rounds × min/round) e conta por tipo', () => {
    const h = [
      treino('2026-10-02', 'tec', { rounds: 6, minPorRound: 3, rpe: 6 }),
      treino('2026-10-09', 'con', { rounds: 4, minPorRound: 2, rpe: 8 }),
      treino('2026-10-13', 'tec', { rounds: 5, minPorRound: 3, rpe: 7 }),
    ]
    expect(estatisticasDoMes(h, hoje)).toEqual({
      treinos: 3,
      rounds: 15,
      minutos: 6 * 3 + 4 * 2 + 5 * 3,
      rpeMedio: 7,
      porTipo: { tec: 2, con: 1, spa: 0 },
    })
  })

  it('rpeMedio pode ser fracionário', () => {
    const h = [treino('2026-10-02', 'tec', { rpe: 6 }), treino('2026-10-03', 'spa', { rpe: 7 })]
    expect(estatisticasDoMes(h, hoje).rpeMedio).toBe(6.5)
  })

  it('inclui o primeiro instante do mês e o último; exclui o mês anterior e o seguinte', () => {
    const h = [
      treino('2026-09-30', 'tec', { data: dia('2026-09-30', 23, 59, 59, 999).toISOString() }),
      treino('2026-10-01', 'tec', { data: dia('2026-10-01', 0, 0).toISOString() }),
      treino('2026-10-31', 'tec', { data: dia('2026-10-31', 23, 59, 59, 999).toISOString() }),
      treino('2026-11-01', 'tec', { data: dia('2026-11-01', 0, 0).toISOString() }),
    ]
    expect(estatisticasDoMes(h, hoje).treinos).toBe(2)
  })

  it('o mês é o de "hoje", independentemente do dia (inclui treinos depois de hoje no mesmo mês)', () => {
    const h = [treino('2026-10-30')]
    expect(estatisticasDoMes(h, hoje).treinos).toBe(1)
  })

  it('dezembro: 31/12 entra e 01/01 do ano seguinte não', () => {
    const h = [treino('2026-12-31'), treino('2027-01-01')]
    expect(estatisticasDoMes(h, dia('2026-12-15')).treinos).toBe(1)
  })

  it('janeiro não puxa treinos de dezembro do ano anterior', () => {
    const h = [treino('2026-12-31'), treino('2027-01-01'), treino('2027-01-20')]
    expect(estatisticasDoMes(h, dia('2027-01-10')).treinos).toBe(2)
  })

  it('fevereiro de ano bissexto inclui o dia 29', () => {
    const h = [treino('2028-02-29'), treino('2028-03-01')]
    expect(estatisticasDoMes(h, dia('2028-02-10')).treinos).toBe(1)
  })

  it('mês sem treinos mas com histórico em outros meses', () => {
    const h = [treino('2026-09-10')]
    const r = estatisticasDoMes(h, hoje)
    expect(r.treinos).toBe(0)
    expect(r.rpeMedio).toBeNull()
  })
})

// ── volumeSemanal ────────────────────────────────────────────

describe('volumeSemanal', () => {
  const hoje = dia('2026-10-14') // segunda atual = 12/10

  it('por padrão devolve 8 semanas, da mais antiga para a atual', () => {
    const r = volumeSemanal([], hoje)
    expect(r).toHaveLength(8)
    expect(chaveDia(r[0].segunda)).toBe('2026-08-24')
    expect(chaveDia(r[7].segunda)).toBe('2026-10-12')
    for (let i = 1; i < r.length; i++) expect(r[i].segunda.getTime()).toBeGreaterThan(r[i - 1].segunda.getTime())
  })

  it('apenas a última semana é marcada como atual', () => {
    const r = volumeSemanal([], hoje, 4)
    expect(r.map(s => s.atual)).toEqual([false, false, false, true])
  })

  it('histórico vazio: tudo zero', () => {
    expect(volumeSemanal([], hoje, 3).every(s => s.rounds === 0 && s.treinos === 0)).toBe(true)
  })

  it('soma rounds e conta treinos em cada semana', () => {
    const h = [
      treino('2026-10-13', 'tec', { rounds: 6 }),
      treino('2026-10-15', 'con', { rounds: 4 }),
      treino('2026-10-07', 'tec', { rounds: 5 }),
      treino('2026-09-29', 'spa', { rounds: 3 }),
    ]
    const r = volumeSemanal(h, hoje, 3)
    expect(r.map(s => s.rounds)).toEqual([3, 5, 10])
    expect(r.map(s => s.treinos)).toEqual([1, 1, 2])
  })

  it('treinos mais antigos que a janela não aparecem', () => {
    const h = [treino('2026-09-20', 'tec', { rounds: 9 })]
    expect(volumeSemanal(h, hoje, 2).map(s => s.rounds)).toEqual([0, 0])
  })

  it('n = 1 devolve só a semana atual', () => {
    const r = volumeSemanal([treino('2026-10-12', 'tec', { rounds: 7 })], hoje, 1)
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ rounds: 7, treinos: 1, atual: true })
  })

  it('n = 0 devolve lista vazia', () => {
    expect(volumeSemanal([treino('2026-10-12')], hoje, 0)).toEqual([])
  })

  it('o limite entre semanas respeita segunda 00:00', () => {
    const h = [
      treino('2026-10-11', 'tec', { rounds: 2, data: dia('2026-10-11', 23, 59).toISOString() }),
      treino('2026-10-12', 'tec', { rounds: 8, data: dia('2026-10-12', 0, 0).toISOString() }),
    ]
    expect(volumeSemanal(h, hoje, 2).map(s => s.rounds)).toEqual([2, 8])
  })

  it('atravessa a virada de ano', () => {
    const r = volumeSemanal([treino('2026-12-31', 'tec', { rounds: 6 })], dia('2027-01-06'), 3)
    expect(r.map(s => chaveDia(s.segunda))).toEqual(['2026-12-21', '2026-12-28', '2027-01-04'])
    expect(r.map(s => s.rounds)).toEqual([0, 6, 0])
  })
})

// ── sugestaoSemPlano ─────────────────────────────────────────

describe('sugestaoSemPlano', () => {
  const hoje = dia('2026-10-14', 8, 0)

  it('histórico vazio: começa pela técnica, com a mensagem de base', () => {
    expect(sugestaoSemPlano([], hoje)).toEqual({
      tipo: 'tec', rounds: 6, minPorRound: 3, motivo: 'Comece pela base: técnica primeiro.',
    })
  })

  it('sugere o tipo menos treinado nos últimos 7 dias', () => {
    const h = [treino('2026-10-13', 'tec'), treino('2026-10-12', 'tec'), treino('2026-10-11', 'con')]
    const r = sugestaoSemPlano(h, hoje)
    expect(r.tipo).toBe('spa')
    expect(r.rounds).toBe(4)
    expect(r.minPorRound).toBe(2)
    expect(r.motivo).toBe('É o tipo que você menos treinou nos últimos 7 dias (0×).')
  })

  it('usa o padrão de rounds do tipo sugerido (condicionamento = 6 × 3)', () => {
    const h = [treino('2026-10-13', 'tec'), treino('2026-10-12', 'spa')]
    const r = sugestaoSemPlano(h, hoje)
    expect(r.tipo).toBe('con')
    expect(r).toMatchObject({ rounds: 6, minPorRound: 3 })
  })

  it('empate desempata pela ordem técnica, condicionamento, sparring', () => {
    const h = [treino('2026-10-13', 'tec'), treino('2026-10-13', 'con'), treino('2026-10-13', 'spa')]
    expect(sugestaoSemPlano(h, hoje).tipo).toBe('tec')
    const h2 = [treino('2026-10-13', 'tec'), treino('2026-10-13', 'tec')]
    expect(sugestaoSemPlano(h2, hoje).tipo).toBe('con')
  })

  it('o motivo mostra quantas vezes o tipo sugerido foi treinado', () => {
    const h = [
      treino('2026-10-13', 'tec'), treino('2026-10-12', 'tec'),
      treino('2026-10-13', 'con'),
      treino('2026-10-12', 'spa'), treino('2026-10-11', 'spa'),
    ]
    const r = sugestaoSemPlano(h, hoje)
    expect(r.tipo).toBe('con')
    expect(r.motivo).toContain('(1×)')
  })

  it('a janela é de 7 dias incluindo hoje: 6 dias atrás entra, 7 dias atrás não', () => {
    const dentro = [treino('2026-10-08', 'tec')] // hoje - 6
    const fora = [treino('2026-10-07', 'tec')] // hoje - 7
    expect(sugestaoSemPlano(dentro, hoje).motivo).not.toBe('Comece pela base: técnica primeiro.')
    expect(sugestaoSemPlano(fora, hoje).motivo).toBe('Comece pela base: técnica primeiro.')
  })

  it('treino de hoje (mesmo mais tarde que "agora") entra; treino de amanhã não', () => {
    const hojeTarde = treino('2026-10-14', 'tec', { data: dia('2026-10-14', 20, 0).toISOString() })
    const amanha = treino('2026-10-15', 'tec')
    expect(sugestaoSemPlano([hojeTarde], hoje).tipo).toBe('con')
    expect(sugestaoSemPlano([amanha], hoje).motivo).toBe('Comece pela base: técnica primeiro.')
  })

  it('treinos antigos não influenciam: só o histórico recente conta', () => {
    const h = [treino('2026-09-01', 'con'), treino('2026-09-02', 'spa')]
    const r = sugestaoSemPlano(h, hoje)
    expect(r.tipo).toBe('tec')
    expect(r.motivo).toBe('Comece pela base: técnica primeiro.')
  })

  it('janela atravessando a virada de ano', () => {
    const h = [treino('2026-12-30', 'tec'), treino('2027-01-02', 'con')]
    expect(sugestaoSemPlano(h, dia('2027-01-04')).tipo).toBe('spa')
  })

  it('não altera o histórico recebido', () => {
    const h = [treino('2026-10-13', 'tec')]
    const copia = structuredClone(h)
    sugestaoSemPlano(h, hoje)
    expect(h).toEqual(copia)
  })
})
