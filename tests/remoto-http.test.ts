import { describe, expect, it, vi } from 'vitest'
import { criarRemotoHttp } from '@/lib/dados/remoto-http'

const resposta = (corpo: unknown, status = 200) => new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status })

describe('carregar', () => {
  it('pede os dados da própria origem, sem cache', async () => {
    const f = vi.fn().mockResolvedValue(resposta({ ativo: true, dados: {} }))
    await criarRemotoHttp(f).carregar()
    expect(f).toHaveBeenCalledWith('/api/dados', expect.objectContaining({ cache: 'no-store' }))
    expect(f.mock.calls[0][1].method ?? 'GET').toBe('GET')
  })

  it('conta ligada: devolve os dados', async () => {
    const dados = { pesos: [{ id: 'p', data: '2026-10-13', kg: 70 }], plano: null }
    expect(await criarRemotoHttp(async () => resposta({ ativo: true, dados })).carregar()).toEqual(dados)
  })

  it('conta desligada neste ambiente: null', async () => {
    expect(await criarRemotoHttp(async () => resposta({ ativo: false })).carregar()).toBeNull()
  })

  it.each([
    ['sessão expirada (401)', resposta({ erro: 'x' }, 401)],
    ['servidor com erro (500)', resposta({ erro: 'x' }, 500)],
    ['banco fora do ar (502)', resposta({ erro: 'x' }, 502)],
    ['resposta que não é JSON', resposta('<html>erro</html>')],
    ['JSON sem o formato esperado', resposta({ qualquer: 1 })],
    ['ativo sem dados', resposta({ ativo: true })],
    ['dados que não são um objeto', resposta({ ativo: true, dados: [1] })],
  ])('%s: falha (o app trata como "não deu para confirmar" e tenta de novo)', async (_nome, r) => {
    await expect(criarRemotoHttp(async () => r).carregar()).rejects.toThrow()
  })

  it('erro de rede também falha, sem ser engolido', async () => {
    await expect(criarRemotoHttp(async () => { throw new TypeError('Failed to fetch') }).carregar()).rejects.toThrow('Failed to fetch')
  })
})

describe('enviar', () => {
  it('manda um PUT em JSON para a própria origem com o que mudou', async () => {
    const f = vi.fn().mockResolvedValue(resposta({ ok: true }))
    await criarRemotoHttp(f).enviar({ pesos: [] })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('/api/dados')
    expect(init.method).toBe('PUT')
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' })
    expect(JSON.parse(init.body)).toEqual({ pesos: [] })
  })

  it('keepalive só quando pedido (envio ao fechar a página)', async () => {
    const f = vi.fn().mockResolvedValue(resposta({ ok: true }))
    const remoto = criarRemotoHttp(f)
    await remoto.enviar({ pesos: [] })
    await remoto.enviar({ pesos: [] }, { keepalive: true })
    expect(f.mock.calls[0][1].keepalive).toBeFalsy()
    expect(f.mock.calls[1][1].keepalive).toBe(true)
  })

  it.each([400, 401, 403, 413, 500, 502, 503])('resposta %i falha, para o app manter a pendência', async status => {
    await expect(criarRemotoHttp(async () => resposta({ erro: 'x', codigo: 'y' }, status)).enviar({ pesos: [] })).rejects.toThrow(String(status))
  })

  it('a mensagem do erro não inclui os dados enviados', async () => {
    const segredo = 'nota-muito-pessoal-do-atleta'
    const e = await criarRemotoHttp(async () => resposta({}, 500)).enviar({ historico: [{ id: 'a', nota: segredo }] } as never).catch((x: Error) => x)
    expect((e as Error).message).not.toContain(segredo)
  })
})
