import { describe, expect, it, vi } from 'vitest'
import { LIMITE_DO_CORPO_BYTES, lerCorpoJson, respostaDeErro } from '@/lib/dados/servidor/http'
import { ErroDados } from '@/lib/dados/servidor/servico'

const pedido = (corpo: BodyInit | null, headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/dados', { method: 'PUT', body: corpo, headers })

describe('lerCorpoJson', () => {
  it('lê um JSON válido', async () => {
    expect(await lerCorpoJson(pedido(JSON.stringify({ pesos: [] })))).toEqual({ ok: true, valor: { pesos: [] } })
  })

  it.each([
    ['vazio', ''],
    ['texto que não é JSON', 'isso não é json'],
    ['JSON cortado', '{"pesos":['],
  ])('corpo %s: 400, sem derrubar nada', async (_nome, texto) => {
    const r = await lerCorpoJson(pedido(texto))
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'pedido_invalido', status: 400 } })
  })

  it('corpo maior que o limite: 413, mesmo sem Content-Length', async () => {
    const grande = JSON.stringify({ nota: 'x'.repeat(LIMITE_DO_CORPO_BYTES) })
    expect(await lerCorpoJson(pedido(grande))).toMatchObject({ ok: false, erro: { codigo: 'muito_grande', status: 413 } })
  })

  it('Content-Length acima do limite: 413 antes de ler o corpo', async () => {
    const r = await lerCorpoJson(pedido('{}', { 'content-length': String(LIMITE_DO_CORPO_BYTES + 1) }))
    expect(r).toMatchObject({ ok: false, erro: { codigo: 'muito_grande', status: 413 } })
  })

  it('o limite conta bytes, não letras (acentos e emojis ocupam mais de um byte)', async () => {
    const emojis = JSON.stringify({ nota: '🥊'.repeat(Math.ceil(LIMITE_DO_CORPO_BYTES / 4)) })
    expect(emojis.length).toBeLessThan(LIMITE_DO_CORPO_BYTES)
    expect(await lerCorpoJson(pedido(emojis))).toMatchObject({ ok: false, erro: { status: 413 } })
  })
})

describe('respostaDeErro', () => {
  it('erro conhecido de dados mantém código, texto e status', () => {
    expect(respostaDeErro(new ErroDados('dado_invalido', 'Os dados de pesos não têm o formato esperado.', 400)))
      .toEqual({ status: 400, corpo: { erro: 'Os dados de pesos não têm o formato esperado.', codigo: 'dado_invalido' } })
  })

  it('qualquer outro erro vira 502 genérico: sem detalhes do banco na resposta e sem chaves no log', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = respostaDeErro(new Error('Supabase (gravar treinos): relation "workouts" does not exist'))
    expect(r.status).toBe(502)
    expect(r.corpo.codigo).toBe('falha_no_banco')
    expect(JSON.stringify(r.corpo)).not.toContain('workouts')
    expect(log).toHaveBeenCalledOnce()
    log.mockRestore()
  })

  it('valor que nem é um Error também não quebra', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(respostaDeErro('texto solto').status).toBe(502)
    log.mockRestore()
  })
})
