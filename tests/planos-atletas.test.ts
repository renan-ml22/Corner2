import { describe, expect, it } from 'vitest'
import { ATLETAS } from '@/data/atletas'
import { EXERCICIOS } from '@/data/exercicios'
import { PLANOS, getPlano, sessoesDaSemana, type Plano } from '@/data/planos'
import { PLANOS_DE_ATLETAS, idDoPlanoDoAtleta, planoDoAtleta } from '@/data/planos-atletas'
import { RECURSOS, RECURSO_DO_PLANO_DE_TREINO, type NivelAssinatura } from '@/lib/assinatura/catalogo'
import { SEM_ASSINATURA, planoDeTreinoLiberado, type EstadoAssinatura } from '@/lib/assinatura/regras'
import { isRegType } from '@/lib/tipos'

// Os dez treinos "no estilo de" um atleta: 4 semanas cada, exclusivos do plano Profissional.

const SEMANAS = [1, 2, 3, 4]

/** Exercícios da biblioteca que o texto do plano cita pelo nome (sem os parênteses: "Jab", "Slip interno", "1-2"). */
function exerciciosCitados(p: Plano) {
  const texto = [p.resumo, ...p.sessoes.flatMap(s => [s.titulo, s.descricao, ...s.checklist])].join(' ').toLowerCase()
  return EXERCICIOS.filter(e => {
    const nome = e.nome.split(' (')[0].toLowerCase().replace(/-/g, '[- ]')
    return new RegExp(`(^|[^a-zà-ú0-9])${nome}($|[^a-zà-ú0-9])`).test(texto)
  })
}

describe('planos dos atletas: o conjunto', () => {
  it('há um plano para cada atleta, na mesma ordem, com id atleta-<id>', () => {
    expect(PLANOS_DE_ATLETAS.map(p => p.id)).toEqual(ATLETAS.map(a => `atleta-${a.id}`))
    for (const a of ATLETAS) expect(idDoPlanoDoAtleta(a.id)).toBe(`atleta-${a.id}`)
  })

  it('não entram em PLANOS (a lista dos quatro planos de sempre) e não repetem os ids deles', () => {
    expect(PLANOS).toHaveLength(4)
    for (const p of PLANOS_DE_ATLETAS) expect(PLANOS.map(x => x.id)).not.toContain(p.id)
  })

  it('getPlano acha os planos dos atletas e os de sempre, devolvendo a mesma referência', () => {
    for (const p of [...PLANOS, ...PLANOS_DE_ATLETAS]) expect(getPlano(p.id)).toBe(p)
    expect(getPlano('atleta-nao-existe')).toBeNull()
    expect(getPlano('atleta-')).toBeNull()
  })

  it('planoDoAtleta acha pelo id do atleta', () => {
    for (const a of ATLETAS) expect(planoDoAtleta(a.id)?.id).toBe(`atleta-${a.id}`)
    expect(planoDoAtleta('nao-existe')).toBeNull()
    expect(planoDoAtleta(undefined)).toBeNull()
  })

  it('os ids das sessões não se repetem em nenhum plano do app (o histórico do treino se apoia neles)', () => {
    const ids = [...PLANOS, ...PLANOS_DE_ATLETAS].flatMap(p => p.sessoes.map(s => s.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe.each(PLANOS_DE_ATLETAS.map(p => [p.nome, p] as const))('%s', (_nome, p: Plano) => {
  it('tem nome "Estilo …", resumo, 4 semanas e nível válido', () => {
    expect(p.nome).toMatch(/^Estilo \S/)
    expect(p.resumo.trim().length).toBeGreaterThan(40)
    expect(p.resumo.length).toBeLessThan(260)
    expect(p.semanas).toBe(4)
    expect(['iniciante', 'intermediario', 'avancado']).toContain(p.nivel)
    expect(p.nivelLabel.trim().length).toBeGreaterThan(3)
    expect(p.diasPorSemana).toBeGreaterThanOrEqual(3)
    expect(p.diasPorSemana).toBeLessThanOrEqual(5)
  })

  it('toda semana tem exatamente diasPorSemana sessões, em dias diferentes e em ordem', () => {
    for (const semana of SEMANAS) {
      const sessoes = sessoesDaSemana(p, semana)
      expect(sessoes, `semana ${semana}`).toHaveLength(p.diasPorSemana)
      const dias = sessoes.map(s => s.diaSemana)
      expect(new Set(dias).size).toBe(dias.length)
    }
  })

  it('nenhuma sessão fica órfã e todas têm dia, tipo, rounds e descanso válidos', () => {
    const usadas = new Set(SEMANAS.flatMap(sem => sessoesDaSemana(p, sem).map(s => s.id)))
    for (const s of p.sessoes) {
      expect(usadas.has(s.id), s.id).toBe(true)
      expect(Number.isInteger(s.diaSemana) && s.diaSemana >= 0 && s.diaSemana <= 6, s.id).toBe(true)
      expect(isRegType(s.tipo), s.id).toBe(true)
      expect(s.rounds, s.id).toBeGreaterThanOrEqual(3)
      expect(s.rounds, s.id).toBeLessThanOrEqual(12)
      expect(s.minPorRound, s.id).toBeGreaterThanOrEqual(2)
      expect(s.minPorRound, s.id).toBeLessThanOrEqual(3)
      expect(s.descansoSeg, s.id).toBe(60)
    }
  })

  it('cada sessão tem título, descrição e um checklist de 3 a 5 itens que cita os rounds', () => {
    for (const s of p.sessoes) {
      expect(s.titulo.trim().length, s.id).toBeGreaterThan(5)
      expect(s.descricao.trim().length, s.id).toBeGreaterThan(40)
      expect(s.checklist.length, s.id).toBeGreaterThanOrEqual(3)
      expect(s.checklist.length, s.id).toBeLessThanOrEqual(5)
      const itens = s.checklist.join(' | ')
      expect(itens, `${s.id}: sobrou um {r} sem trocar pelo número de rounds`).not.toContain('{r}')
      expect(s.checklist.some(i => new RegExp(`^${s.rounds} (rounds|estações) `).test(i)), `${s.id}: nenhum item começa com "${s.rounds} rounds" ou "${s.rounds} estações"`).toBe(true)
      for (const item of s.checklist) expect(item, s.id).toBe(item.trim())
    }
  })

  it('o volume sobe com calma da semana 1 para a semana 4: no máximo 1 round a mais por sessão, e o sparring não aumenta', () => {
    const total = (semana: number) => sessoesDaSemana(p, semana).reduce((soma, s) => soma + s.rounds, 0)
    expect(total(4)).toBeGreaterThan(total(1))
    expect(total(2)).toBeGreaterThanOrEqual(total(1))
    expect(total(3)).toBeGreaterThanOrEqual(total(2))
    const porDia = (semana: number) => new Map(sessoesDaSemana(p, semana).map(s => [s.diaSemana, s]))
    const inicio = porDia(1)
    for (const [dia, depois] of porDia(4)) {
      const antes = inicio.get(dia)!
      expect(depois.rounds - antes.rounds, `${depois.id}: salto de rounds`).toBeLessThanOrEqual(1)
      expect(depois.rounds, depois.id).toBeLessThanOrEqual(12)
      if (depois.tipo === 'spa') expect(depois.rounds, `${depois.id}: o sparring não pode subir`).toBe(antes.rounds)
    }
  })

  it('tem ao menos uma sessão técnica e no máximo um sparring por semana, sempre leve', () => {
    for (const semana of SEMANAS) {
      const sessoes = sessoesDaSemana(p, semana)
      expect(sessoes.some(s => s.tipo === 'tec'), `semana ${semana}`).toBe(true)
      const sparrings = sessoes.filter(s => s.tipo === 'spa')
      expect(sparrings.length, `semana ${semana}`).toBeLessThanOrEqual(1)
      for (const s of sparrings) {
        expect(s.descricao, s.id).toMatch(/leve/i)
        expect(s.descricao, s.id).toMatch(/50%/)
        expect(s.rounds, s.id).toBeLessThanOrEqual(4)
        // Sparring pede equipamento completo e alguém por perto, nunca só bandagem e protetor bucal.
        expect(s.checklist.join(' '), s.id).toMatch(/luvas/i)
        expect(s.checklist.join(' '), s.id).toMatch(/capacete/i)
        expect(s.checklist.join(' '), s.id).toMatch(/treinador/i)
      }
    }
  })

  it('o título, a descrição e o checklist não afirmam ser o treino real do atleta nem prometem resultado', () => {
    const tudo = [p.nome, p.resumo, ...p.sessoes.flatMap(s => [s.titulo, s.descricao, ...s.checklist])].join(' ')
    expect(tudo).not.toMatch(/treino (real|oficial|original)|rotina (real|oficial)|método (oficial|original)|endossad|garantid|infal[ií]vel|vire (campe|nocaute)/i)
  })

  it('trabalha golpes e defesas da biblioteca de exercícios (cita pelo menos 3 exercícios pelo nome)', () => {
    expect(exerciciosCitados(p).length, exerciciosCitados(p).map(e => e.nome).join(', ')).toBeGreaterThanOrEqual(3)
  })

  it('o nível do plano não é menor que o do exercício mais difícil que ele cita (iniciante não recebe exercício avançado)', () => {
    const ordem = ['iniciante', 'intermediario', 'avancado']
    for (const e of exerciciosCitados(p)) {
      expect(ordem.indexOf(p.nivel), `${p.nome} (${p.nivel}) cita ${e.nome} (${e.nivel})`).toBeGreaterThanOrEqual(ordem.indexOf(e.nivel))
    }
  })
})

describe('planos dos atletas: o acesso é do plano Profissional', () => {
  it('todos estão ligados ao recurso treinosDeAtletas, que exige o nível profissional', () => {
    expect(RECURSOS.treinosDeAtletas.nivelMinimo).toBe('profissional')
    for (const p of PLANOS_DE_ATLETAS) expect(RECURSO_DO_PLANO_DE_TREINO[p.id], p.id).toBe('treinosDeAtletas')
  })

  it('só quem tem o Profissional ativo libera os planos dos atletas', () => {
    const agora = new Date('2026-06-01T12:00:00Z')
    const ativa = (nivel: NivelAssinatura): EstadoAssinatura => ({
      situacao: 'ativa', nivel, periodo: 'mensal', fimDoPeriodo: '2026-07-01T00:00:00Z', fimDoTeste: null, cancelaNoFim: false,
    })
    for (const p of PLANOS_DE_ATLETAS) {
      expect(planoDeTreinoLiberado(p.id, SEM_ASSINATURA, agora), `${p.id} sem assinatura`).toBe(false)
      expect(planoDeTreinoLiberado(p.id, ativa('iniciante'), agora), `${p.id} iniciante`).toBe(false)
      expect(planoDeTreinoLiberado(p.id, ativa('amador'), agora), `${p.id} amador`).toBe(false)
      expect(planoDeTreinoLiberado(p.id, ativa('profissional'), agora), `${p.id} profissional`).toBe(true)
    }
  })
})
