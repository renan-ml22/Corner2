import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { prepararRota, estadoNoServidor } = vi.hoisted(() => ({ prepararRota: vi.fn(), estadoNoServidor: vi.fn() }))
vi.mock('@/lib/assinatura/rota', () => ({
  prepararRota,
  erro: (codigo: string, mensagem: string, status: number) => Response.json({ erro: mensagem, codigo }, { status }),
}))
vi.mock('@/lib/assinatura/estado-servidor', () => ({ estadoNoServidor }))

import { NIVEIS, type NivelAssinatura } from '@/lib/assinatura/catalogo'
import { DIAS_DE_TOLERANCIA, SEM_ASSINATURA, type EstadoAssinatura } from '@/lib/assinatura/regras'
import { prepararRotaDoTreinador, treinadorPodeGerir } from '@/lib/cornerman/acesso'

// Quem pode usar a área do treinador (plano Cornerman ou Profissional), decidido NO SERVIDOR.

const AGORA = new Date('2026-10-27T12:00:00.000Z')
const dias = (n: number) => new Date(AGORA.getTime() + n * 86_400_000).toISOString()
const estado = (p: Partial<EstadoAssinatura>): EstadoAssinatura => ({
  situacao: 'ativa', nivel: 'cornerman', periodo: 'mensal', fimDoPeriodo: dias(20), fimDoTeste: null, cancelaNoFim: false, ...p,
})
const comEstado = (e: EstadoAssinatura) => ({ pagamentoAtivo: true as const, estado: e, origem: 'cache' as const })

describe('treinadorPodeGerir', () => {
  it.each<NivelAssinatura>(['cornerman', 'profissional'])('assinatura ativa do %s: pode', nivel => {
    expect(treinadorPodeGerir(comEstado(estado({ nivel })), AGORA)).toBe(true)
  })

  it.each<NivelAssinatura>(['cornerman', 'profissional'])('teste grátis do %s: pode (conta como o plano)', nivel => {
    expect(treinadorPodeGerir(comEstado(estado({ nivel, situacao: 'teste', fimDoTeste: dias(5) })), AGORA)).toBe(true)
  })

  it('pagamento atrasado dentro da tolerância: pode', () => {
    expect(treinadorPodeGerir(comEstado(estado({ situacao: 'atrasada', fimDoPeriodo: dias(-(DIAS_DE_TOLERANCIA - 1)) })), AGORA)).toBe(true)
  })

  it.each<NivelAssinatura>(['iniciante', 'amador'])('assinatura ativa do %s: não pode', nivel => {
    expect(treinadorPodeGerir(comEstado(estado({ nivel })), AGORA)).toBe(false)
  })

  it('sem assinatura (gratuito): não pode', () => {
    expect(treinadorPodeGerir(comEstado(SEM_ASSINATURA), AGORA)).toBe(false)
  })

  it.each(NIVEIS)('assinatura cancelada do %s: não pode', nivel => {
    expect(treinadorPodeGerir(comEstado(estado({ nivel, situacao: 'cancelada', fimDoPeriodo: dias(-30) })), AGORA)).toBe(false)
  })

  it('teste grátis vencido e pagamento atrasado além da tolerância: não pode', () => {
    expect(treinadorPodeGerir(comEstado(estado({ situacao: 'teste', fimDoTeste: dias(-1) })), AGORA)).toBe(false)
    expect(treinadorPodeGerir(comEstado(estado({ situacao: 'atrasada', fimDoPeriodo: dias(-(DIAS_DE_TOLERANCIA + 1)) })), AGORA)).toBe(false)
  })

  it('pagamento desligado no ambiente (sem chave do Stripe): o app todo fica liberado, então pode', () => {
    expect(treinadorPodeGerir({ pagamentoAtivo: false }, AGORA)).toBe(true)
  })
})

describe('prepararRotaDoTreinador', () => {
  const usuario = { id: 'u_ana', email: 'ana@exemplo.com', name: 'Ana' }
  const pedido = new Request('https://corner2.vercel.app/api/cornerman/alunos')
  const corpoDe = async (r: Response) => ({ status: r.status, json: await r.json(), cache: r.headers.get('cache-control') })

  beforeEach(() => {
    prepararRota.mockReset()
    estadoNoServidor.mockReset()
    prepararRota.mockResolvedValue({ ok: true, usuario, origem: 'https://corner2.vercel.app' })
  })

  it('sem sessão ou de origem errada: devolve a resposta da checagem comum e nem olha a assinatura', async () => {
    const recusa = Response.json({ erro: 'Entre na sua conta para continuar.', codigo: 'nao_autenticado' }, { status: 401 })
    prepararRota.mockResolvedValue({ ok: false, resposta: recusa })
    const r = await prepararRotaDoTreinador(pedido, { mutavel: false })
    expect(r).toEqual({ ok: false, resposta: recusa })
    expect(estadoNoServidor).not.toHaveBeenCalled()
  })

  it('repassa se o pedido muda algo (para a checagem de origem)', async () => {
    estadoNoServidor.mockResolvedValue(comEstado(estado({})))
    await prepararRotaDoTreinador(pedido, { mutavel: true })
    expect(prepararRota).toHaveBeenCalledWith(pedido, { mutavel: true })
  })

  it('plano Cornerman: libera e devolve o usuário da sessão', async () => {
    estadoNoServidor.mockResolvedValue(comEstado(estado({})))
    const r = await prepararRotaDoTreinador(pedido, { mutavel: false })
    expect(r).toEqual({ ok: true, usuario })
    expect(estadoNoServidor).toHaveBeenCalledWith(usuario, { forcar: false })
  })

  it.each([
    ['gratuito', SEM_ASSINATURA],
    ['Iniciante', estado({ nivel: 'iniciante' })],
    ['Amador', estado({ nivel: 'amador' })],
    ['assinatura cancelada', estado({ situacao: 'cancelada' })],
  ])('%s: 403 "plano_insuficiente"', async (_nome, e) => {
    estadoNoServidor.mockResolvedValue(comEstado(e))
    const r = await prepararRotaDoTreinador(pedido, { mutavel: false })
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(await corpoDe(r.resposta)).toMatchObject({ status: 403, json: { codigo: 'plano_insuficiente', erro: 'Esta área é do plano Cornerman ou Profissional.' } })
  })

  it('Stripe fora do ar: 502 e NÃO libera (sem como saber o plano), sem repetir a mensagem do erro', async () => {
    estadoNoServidor.mockRejectedValue(new Error('chave sk_test_SEGREDO inválida'))
    const r = await prepararRotaDoTreinador(pedido, { mutavel: false })
    expect(r.ok).toBe(false)
    if (r.ok) return
    const corpo = await corpoDe(r.resposta)
    expect(corpo).toMatchObject({ status: 502, json: { codigo: 'falha_no_pagamento' } })
    expect(JSON.stringify(corpo)).not.toContain('SEGREDO')
  })

  it('pagamento desligado: libera', async () => {
    estadoNoServidor.mockResolvedValue({ pagamentoAtivo: false })
    expect((await prepararRotaDoTreinador(pedido, { mutavel: false })).ok).toBe(true)
  })
})
