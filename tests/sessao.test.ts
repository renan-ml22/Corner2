import { describe, expect, it } from 'vitest'
import type { Plano } from '@/data/planos'
import { lerParamsTreino, nivelDoAtleta, urlTreino, type ParamsTreino } from '@/lib/sessao'

// Só o campo `nivel` importa para nivelDoAtleta.
const planoDeNivel = (nivel: Plano['nivel']) => ({ nivel }) as Plano

const ler = (consulta: string) => lerParamsTreino(new URLSearchParams(consulta))

const PADRAO: ParamsTreino = {
  tipo: 'tec',
  rounds: 4,
  minPorRound: 3,
  descansoSeg: 60,
  nivel: 'intermediario',
  sessaoId: undefined,
}

describe('nivelDoAtleta', () => {
  it('o nível do plano ativo vence a experiência', () => {
    expect(nivelDoAtleta(planoDeNivel('avancado'), 'nenhuma')).toBe('avancado')
    expect(nivelDoAtleta(planoDeNivel('iniciante'), 'mais3')).toBe('iniciante')
    expect(nivelDoAtleta(planoDeNivel('intermediario'), null)).toBe('intermediario')
  })

  it('sem plano, nenhuma experiência ou até 1 ano é iniciante', () => {
    expect(nivelDoAtleta(null, 'nenhuma')).toBe('iniciante')
    expect(nivelDoAtleta(null, 'ate1')).toBe('iniciante')
  })

  it('sem plano, mais de 3 anos é avançado', () => {
    expect(nivelDoAtleta(null, 'mais3')).toBe('avancado')
  })

  it('sem plano, de 1 a 3 anos é intermediário', () => {
    expect(nivelDoAtleta(null, '1a3')).toBe('intermediario')
  })

  it('sem plano e sem experiência informada cai em intermediário', () => {
    expect(nivelDoAtleta(null, null)).toBe('intermediario')
  })
})

describe('urlTreino', () => {
  const base: ParamsTreino = { tipo: 'con', rounds: 6, minPorRound: 2, descansoSeg: 45, nivel: 'avancado' }

  it('monta a rota /treino com todos os parâmetros', () => {
    const url = urlTreino(base)
    expect(url.startsWith('/treino?')).toBe(true)
    const q = new URLSearchParams(url.split('?')[1])
    expect(q.get('tipo')).toBe('con')
    expect(q.get('rounds')).toBe('6')
    expect(q.get('min')).toBe('2')
    expect(q.get('descanso')).toBe('45')
    expect(q.get('nivel')).toBe('avancado')
  })

  it('omite o parâmetro sessao quando não há sessaoId', () => {
    expect(urlTreino(base)).not.toContain('sessao')
  })

  it('inclui sessao quando há sessaoId', () => {
    const q = new URLSearchParams(urlTreino({ ...base, sessaoId: 'ini-1-seg' }).split('?')[1])
    expect(q.get('sessao')).toBe('ini-1-seg')
  })

  it('codifica caracteres especiais do sessaoId', () => {
    const url = urlTreino({ ...base, sessaoId: 'a b&c=d' })
    expect(url).not.toContain('a b&c=d')
    expect(new URLSearchParams(url.split('?')[1]).get('sessao')).toBe('a b&c=d')
  })

  it('mantém minutos fracionados', () => {
    expect(urlTreino({ ...base, minPorRound: 0.5 })).toContain('min=0.5')
  })
})

describe('lerParamsTreino', () => {
  it('lê parâmetros válidos', () => {
    expect(ler('tipo=spa&rounds=8&min=2.5&descanso=30&nivel=avancado&sessao=xyz')).toEqual({
      tipo: 'spa',
      rounds: 8,
      minPorRound: 2.5,
      descansoSeg: 30,
      nivel: 'avancado',
      sessaoId: 'xyz',
    })
  })

  it('aceita os três tipos de treino', () => {
    expect(ler('tipo=tec').tipo).toBe('tec')
    expect(ler('tipo=con').tipo).toBe('con')
    expect(ler('tipo=spa').tipo).toBe('spa')
  })

  it('aceita os três níveis', () => {
    expect(ler('nivel=iniciante').nivel).toBe('iniciante')
    expect(ler('nivel=intermediario').nivel).toBe('intermediario')
    expect(ler('nivel=avancado').nivel).toBe('avancado')
  })

  describe('ida e volta com urlTreino', () => {
    const casos: ParamsTreino[] = [
      { tipo: 'tec', rounds: 4, minPorRound: 3, descansoSeg: 60, nivel: 'intermediario' },
      { tipo: 'con', rounds: 12, minPorRound: 0.5, descansoSeg: 0, nivel: 'iniciante', sessaoId: 'sessao-1' },
      { tipo: 'spa', rounds: 20, minPorRound: 10, descansoSeg: 300, nivel: 'avancado', sessaoId: 'a b&c' },
    ]
    it.each(casos)('preserva %o', p => {
      const url = urlTreino(p)
      const lido = lerParamsTreino(new URLSearchParams(url.split('?')[1]))
      expect(lido).toEqual({ sessaoId: undefined, ...p })
    })
  })

  describe('valores inválidos caem em padrão seguro', () => {
    it('tipo desconhecido vira técnica', () => {
      expect(ler('tipo=yoga').tipo).toBe('tec')
      expect(ler('tipo=').tipo).toBe('tec')
      expect(ler('tipo=TEC').tipo).toBe('tec')
    })

    it('nível desconhecido vira intermediário', () => {
      expect(ler('nivel=expert').nivel).toBe('intermediario')
      expect(ler('nivel=').nivel).toBe('intermediario')
      expect(ler('nivel=Avancado').nivel).toBe('intermediario')
    })

    it('números não numéricos usam o valor padrão', () => {
      const r = ler('rounds=abc&min=xyz&descanso=--')
      expect(r.rounds).toBe(4)
      expect(r.minPorRound).toBe(3)
      expect(r.descansoSeg).toBe(60)
    })

    it('infinito e NaN usam o valor padrão', () => {
      const r = ler('rounds=Infinity&min=NaN&descanso=-Infinity')
      expect(r.rounds).toBe(4)
      expect(r.minPorRound).toBe(3)
      expect(r.descansoSeg).toBe(60)
    })
  })

  describe('limites numéricos', () => {
    it('rounds fica entre 1 e 20', () => {
      expect(ler('rounds=0').rounds).toBe(1)
      expect(ler('rounds=-5').rounds).toBe(1)
      expect(ler('rounds=21').rounds).toBe(20)
      expect(ler('rounds=9999').rounds).toBe(20)
    })

    it('rounds fracionado é arredondado', () => {
      expect(ler('rounds=3.4').rounds).toBe(3)
      expect(ler('rounds=3.6').rounds).toBe(4)
    })

    it('minutos por round ficam entre 0,05 e 10 e aceitam fração', () => {
      expect(ler('min=0.5').minPorRound).toBe(0.5)
      expect(ler('min=0.01').minPorRound).toBe(0.05)
      expect(ler('min=-1').minPorRound).toBe(0.05)
      expect(ler('min=60').minPorRound).toBe(10)
    })

    it('descanso fica entre 0 e 300 segundos e é arredondado', () => {
      expect(ler('descanso=0').descansoSeg).toBe(0)
      expect(ler('descanso=-10').descansoSeg).toBe(0)
      expect(ler('descanso=301').descansoSeg).toBe(300)
      expect(ler('descanso=45.5').descansoSeg).toBe(46)
    })
  })

  describe('sessaoId', () => {
    it('é indefinido quando o parâmetro não existe', () => {
      expect(ler('tipo=tec').sessaoId).toBeUndefined()
    })

    it('é repassado como veio, sem validação', () => {
      expect(ler('sessao=qualquer-coisa').sessaoId).toBe('qualquer-coisa')
    })

    it('string vazia é mantida como string vazia', () => {
      expect(ler('sessao=').sessaoId).toBe('')
    })
  })

  describe('parâmetros ausentes', () => {
    it('tipo e nível ausentes caem no padrão (técnica, intermediário)', () => {
      const r = ler('')
      expect(r.tipo).toBe('tec')
      expect(r.nivel).toBe('intermediario')
    })

    // Number(null) === 0 é finito: sem tratamento, parâmetro ausente cairia no MÍNIMO do intervalo.
    it('rounds ausente usa o padrão de 4 rounds', () => {
      expect(ler('').rounds).toBe(4)
    })

    it('minutos por round ausente usa o padrão de 3 minutos', () => {
      expect(ler('').minPorRound).toBe(3)
    })

    it('descanso ausente usa o padrão de 60 segundos', () => {
      expect(ler('').descansoSeg).toBe(60)
    })

    it('parâmetro numérico vazio (rounds=) usa o padrão', () => {
      expect(ler('rounds=').rounds).toBe(4)
    })

    it('uma URL totalmente vazia devolve todos os padrões', () => {
      expect(ler('')).toEqual(PADRAO)
    })
  })
})
