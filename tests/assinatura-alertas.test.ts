import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { filtrarAlertas, recursoDoAlerta } from '@/lib/assinatura/alertas'
import { SEM_ASSINATURA, podeUsar, type EstadoAssinatura } from '@/lib/assinatura/regras'
import type { Alerta } from '@/lib/saude'

const alerta = (id: string): Alerta => ({ id, nivel: 'atencao', icone: 'ph-x', titulo: id, texto: id })
const ativa = (nivel: EstadoAssinatura['nivel']): EstadoAssinatura => ({ situacao: 'ativa', nivel, periodo: 'mensal', fimDoPeriodo: '2999-01-01T00:00:00.000Z', fimDoTeste: null, cancelaNoFim: false })

describe('recursoDoAlerta: de qual recurso cada alerta depende', () => {
  it.each(['cabeca-recente', 'cabeca-retorno', 'sparring-intervalo', 'rpe-alto', 'lesao-abc', 'lesao-123-xyz'])('%s é de segurança (gratuito)', id => {
    expect(recursoDoAlerta(id)).toBe('alertasSeguranca')
  })

  it.each(['carga', 'retorno-pausa'])('%s depende da carga de treino', id => {
    expect(recursoDoAlerta(id)).toBe('carga')
  })

  it.each(['meta-batida', 'meta-risco'])('%s (meta da semana) é do registro de treino, gratuito', id => {
    expect(recursoDoAlerta(id)).toBe('registroTreino')
  })

  it('alerta que ninguém classificou nunca fica escondido: cai em segurança (gratuito)', () => {
    expect(recursoDoAlerta('alerta-novo-que-ninguem-mapeou')).toBe('alertasSeguranca')
    expect(recursoDoAlerta('')).toBe('alertasSeguranca')
  })

  it('todo alerta que lib/saude.ts pode gerar tem uma classificação explícita (senão cairia no padrão sem ninguém perceber)', () => {
    const fonte = readFileSync(path.resolve(__dirname, '../lib/saude.ts'), 'utf8')
    const ids = [...fonte.matchAll(/\bid: '([a-z-]+)'/g)].map(m => m[1])
    expect(ids.length).toBeGreaterThanOrEqual(8)
    for (const id of ids) {
      const explicito = ['cabeca-recente', 'cabeca-retorno', 'sparring-intervalo', 'rpe-alto', 'carga', 'retorno-pausa', 'meta-batida', 'meta-risco'].includes(id)
      expect(explicito, `alerta "${id}" sem classificação em lib/assinatura/alertas.ts`).toBe(true)
    }
  })
})

describe('filtrarAlertas', () => {
  const todos = ['cabeca-recente', 'lesao-1', 'sparring-intervalo', 'rpe-alto', 'carga', 'retorno-pausa', 'meta-risco'].map(alerta)
  const ids = (a: Alerta[]) => a.map(x => x.id)

  it('no gratuito: todos os de segurança e a meta; sem os de carga', () => {
    const r = filtrarAlertas(todos, id => podeUsar(id, SEM_ASSINATURA))
    expect(ids(r)).toEqual(['cabeca-recente', 'lesao-1', 'sparring-intervalo', 'rpe-alto', 'meta-risco'])
  })

  it('no Iniciante: igual ao gratuito (carga é do Amador)', () => {
    expect(ids(filtrarAlertas(todos, id => podeUsar(id, ativa('iniciante'))))).toEqual(['cabeca-recente', 'lesao-1', 'sparring-intervalo', 'rpe-alto', 'meta-risco'])
  })

  it('no Amador e no Profissional: todos', () => {
    for (const n of ['amador', 'profissional'] as const) expect(ids(filtrarAlertas(todos, id => podeUsar(id, ativa(n))))).toEqual(ids(todos))
  })

  it('mantém a ordem e não altera a lista recebida', () => {
    const copia = [...todos]
    filtrarAlertas(todos, () => true)
    expect(todos).toEqual(copia)
  })

  it('NUNCA esconde um alerta crítico de segurança, em nenhum plano', () => {
    const criticos = ['cabeca-recente', 'lesao-x'].map(alerta)
    for (const estado of [SEM_ASSINATURA, ativa('iniciante')]) expect(filtrarAlertas(criticos, id => podeUsar(id, estado))).toHaveLength(2)
  })
})
