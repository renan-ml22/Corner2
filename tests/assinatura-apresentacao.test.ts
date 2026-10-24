import { describe, expect, it } from 'vitest'
import { NIVEIS, PRECO_MENSAL_CENTAVOS, RECURSOS, recurso, type RecursoId } from '@/lib/assinatura/catalogo'
import {
  economiaDoAnualPercentual, mensalEquivalenteEmCentavos, recursosNovosDoNivel, resumoDoEstado, rotuloDoBotao,
} from '@/lib/assinatura/apresentacao'
import { SEM_ASSINATURA, type EstadoAssinatura } from '@/lib/assinatura/regras'

const AGORA = new Date('2026-10-20T12:00:00.000Z')
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString()
const e = (p: Partial<EstadoAssinatura>): EstadoAssinatura => ({ situacao: 'ativa', nivel: 'amador', periodo: 'mensal', fimDoPeriodo: dias(20), fimDoTeste: null, cancelaNoFim: false, ...p })

describe('recursosNovosDoNivel (o que cada plano acrescenta)', () => {
  it('Iniciante acrescenta biblioteca técnica e plano Fundamentos', () => {
    expect(recursosNovosDoNivel('iniciante')).toEqual([recurso('biblioteca').nome, recurso('planoFundamentos').nome])
  })

  it('cada recurso aparece em exatamente um plano pago ou no gratuito (nunca em dois)', () => {
    const vistos = NIVEIS.flatMap(n => recursosNovosDoNivel(n))
    expect(new Set(vistos).size).toBe(vistos.length)
    const pagos = (Object.keys(RECURSOS) as RecursoId[]).filter(id => recurso(id).nivelMinimo !== 'gratuito')
    expect(vistos).toHaveLength(pagos.length)
  })

  it('o gratuito lista o que o app oferece sem assinatura', () => {
    expect(recursosNovosDoNivel('gratuito')).toContain(recurso('cronometro').nome)
    expect(recursosNovosDoNivel('gratuito')).toHaveLength(6)
  })
})

describe('preço do plano anual', () => {
  it('com 10 meses cobrados, a economia é de 2 em 12 meses (cerca de 17%)', () => {
    expect(economiaDoAnualPercentual()).toBe(17)
  })

  it('o equivalente mensal do anual é o preço anual dividido por 12, arredondado para centavos', () => {
    expect(mensalEquivalenteEmCentavos('iniciante')).toBe(Math.round((3990 * 10) / 12)) // 3325
    expect(mensalEquivalenteEmCentavos('profissional')).toBe(Math.round((6990 * 10) / 12)) // 5825
    for (const n of NIVEIS) expect(mensalEquivalenteEmCentavos(n)).toBeLessThan(PRECO_MENSAL_CENTAVOS[n])
  })
})

describe('resumoDoEstado (o que a tela diz sobre a assinatura)', () => {
  it('sem assinatura: plano gratuito', () => {
    const r = resumoDoEstado(SEM_ASSINATURA, AGORA)
    expect(r.titulo).toBe('Plano gratuito')
    expect(r.tom).toBe('neutro')
  })

  it('teste grátis: nome do plano, data do fim e quantos dias faltam', () => {
    const r = resumoDoEstado(e({ situacao: 'teste', nivel: 'profissional', fimDoTeste: dias(5) }), AGORA)
    expect(r.titulo).toBe('Teste grátis do Profissional')
    expect(r.detalhe).toContain('5 dias')
    expect(r.detalhe).toMatch(/25 de out/)
    expect(r.tom).toBe('destaque')
  })

  it('último dia do teste: "1 dia" no singular, e hoje é "hoje"', () => {
    expect(resumoDoEstado(e({ situacao: 'teste', fimDoTeste: dias(1) }), AGORA).detalhe).toContain('1 dia')
    expect(resumoDoEstado(e({ situacao: 'teste', fimDoTeste: dias(1) }), AGORA).detalhe).not.toContain('1 dias')
    expect(resumoDoEstado(e({ situacao: 'teste', fimDoTeste: dias(0.2) }), AGORA).detalhe).toContain('hoje')
  })

  it('teste grátis avisa que sem cartão ele volta ao gratuito', () => {
    expect(resumoDoEstado(e({ situacao: 'teste', fimDoTeste: dias(3) }), AGORA).detalhe).toMatch(/gratuito/)
  })

  it('ativa: plano, período e data da renovação', () => {
    const r = resumoDoEstado(e({ situacao: 'ativa', nivel: 'amador', periodo: 'anual', fimDoPeriodo: dias(30) }), AGORA)
    expect(r.titulo).toBe('Plano Amador anual')
    expect(r.detalhe).toMatch(/Renova em 19 de nov/)
    expect(r.tom).toBe('destaque')
  })

  it('ativa mas marcada para cancelar: avisa até quando vale e que depois volta ao gratuito', () => {
    const r = resumoDoEstado(e({ cancelaNoFim: true, fimDoPeriodo: dias(10) }), AGORA)
    expect(r.detalhe).toMatch(/Cancelada/)
    expect(r.detalhe).toMatch(/30 de out/)
    expect(r.detalhe).toMatch(/gratuito/)
    expect(r.tom).toBe('alerta')
  })

  it('pagamento atrasado: pede para atualizar o cartão', () => {
    const r = resumoDoEstado(e({ situacao: 'atrasada', fimDoPeriodo: dias(-1) }), AGORA)
    expect(r.titulo).toBe('Pagamento atrasado')
    expect(r.detalhe).toMatch(/cartão/)
    expect(r.tom).toBe('alerta')
  })

  it('cancelada: voltou ao gratuito e os dados continuam salvos', () => {
    const r = resumoDoEstado(e({ situacao: 'cancelada' }), AGORA)
    expect(r.titulo).toBe('Assinatura encerrada')
    expect(r.detalhe).toMatch(/dados continuam salvos/)
  })

  it('sem data do fim, não escreve "undefined" nem "Invalid Date"', () => {
    for (const st of [e({ situacao: 'ativa', fimDoPeriodo: null }), e({ situacao: 'teste', fimDoTeste: null }), e({ cancelaNoFim: true, fimDoPeriodo: null })]) {
      const r = resumoDoEstado(st, AGORA)
      expect(`${r.titulo} ${r.detalhe}`).not.toMatch(/undefined|Invalid|NaN|null/)
    }
  })
})

describe('rotuloDoBotao (o que está escrito em cada plano)', () => {
  it('quem nunca assinou começa o teste grátis', () => {
    expect(rotuloDoBotao(SEM_ASSINATURA, 'amador', 'mensal')).toEqual({ texto: 'Começar 7 dias grátis', acao: 'assinar' })
    expect(rotuloDoBotao(SEM_ASSINATURA, 'amador', 'anual')).toEqual({ texto: 'Começar 7 dias grátis', acao: 'assinar' })
  })

  it('quem já teve e cancelou assina direto, sem falar de teste grátis', () => {
    expect(rotuloDoBotao(e({ situacao: 'cancelada' }), 'amador', 'mensal')).toEqual({ texto: 'Assinar', acao: 'assinar' })
  })

  it('no plano e período atuais: "Plano atual" (sem ação)', () => {
    expect(rotuloDoBotao(e({ situacao: 'ativa', nivel: 'amador', periodo: 'mensal' }), 'amador', 'mensal')).toEqual({ texto: 'Plano atual', acao: 'nenhuma' })
    expect(rotuloDoBotao(e({ situacao: 'teste', nivel: 'amador', periodo: 'anual', fimDoTeste: dias(3) }), 'amador', 'anual')).toEqual({ texto: 'Plano atual', acao: 'nenhuma' })
  })

  it('no mesmo plano, mas em outro período: oferece trocar só o período', () => {
    expect(rotuloDoBotao(e({ situacao: 'ativa', nivel: 'amador', periodo: 'mensal' }), 'amador', 'anual')).toEqual({ texto: 'Mudar para o anual', acao: 'trocar' })
    expect(rotuloDoBotao(e({ situacao: 'ativa', nivel: 'amador', periodo: 'anual' }), 'amador', 'mensal')).toEqual({ texto: 'Mudar para o mensal', acao: 'trocar' })
  })

  it('em outro plano de quem já assina (ou está em teste): a troca abre a confirmação no portal', () => {
    expect(rotuloDoBotao(e({ situacao: 'ativa', nivel: 'amador' }), 'profissional', 'mensal')).toEqual({ texto: 'Mudar para este plano', acao: 'trocar' })
    expect(rotuloDoBotao(e({ situacao: 'ativa', nivel: 'amador' }), 'iniciante', 'mensal')).toEqual({ texto: 'Mudar para este plano', acao: 'trocar' })
    expect(rotuloDoBotao(e({ situacao: 'teste', nivel: 'amador', fimDoTeste: dias(3) }), 'profissional', 'mensal')).toEqual({ texto: 'Mudar para este plano', acao: 'trocar' })
  })

  it('pagamento atrasado: a ação é resolver no portal', () => {
    expect(rotuloDoBotao(e({ situacao: 'atrasada', fimDoPeriodo: dias(-1) }), 'amador', 'mensal')).toEqual({ texto: 'Resolver pagamento', acao: 'portal' })
    expect(rotuloDoBotao(e({ situacao: 'atrasada', fimDoPeriodo: dias(-1) }), 'profissional', 'anual')).toEqual({ texto: 'Resolver pagamento', acao: 'portal' })
  })
})
