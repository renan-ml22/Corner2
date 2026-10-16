import { describe, expect, it } from 'vitest'
import { lerPedidoDeCheckout, origemDoSite, origemPermitida } from '@/lib/assinatura/http'

const req = (headers: Record<string, string>, url = 'https://corner2.vercel.app/api/assinatura/checkout') => new Request(url, { method: 'POST', headers })

describe('origemPermitida (só aceita pedidos vindos do próprio site)', () => {
  it('Origin igual ao endereço do site: sim', () => {
    expect(origemPermitida(req({ origin: 'https://corner2.vercel.app', host: 'corner2.vercel.app' }))).toBe(true)
  })

  it('Origin de outro site: não', () => {
    expect(origemPermitida(req({ origin: 'https://site-malicioso.com', host: 'corner2.vercel.app' }))).toBe(false)
  })

  it('Origin parecido (subdomínio ou sufixo enganoso): não', () => {
    expect(origemPermitida(req({ origin: 'https://corner2.vercel.app.evil.com', host: 'corner2.vercel.app' }))).toBe(false)
    expect(origemPermitida(req({ origin: 'https://evil-corner2.vercel.app', host: 'corner2.vercel.app' }))).toBe(false)
  })

  it('sem Origin (nem Referer): não (um formulário de outro site não escapa da checagem)', () => {
    expect(origemPermitida(req({ host: 'corner2.vercel.app' }))).toBe(false)
  })

  it('sem Origin, mas com Referer do próprio site: sim', () => {
    expect(origemPermitida(req({ referer: 'https://corner2.vercel.app/assinatura', host: 'corner2.vercel.app' }))).toBe(true)
  })

  it('Origin com texto inválido: não, sem lançar erro', () => {
    expect(origemPermitida(req({ origin: 'isto nao e url', host: 'corner2.vercel.app' }))).toBe(false)
  })

  it('atrás do proxy da Vercel, vale o host que o proxy informou', () => {
    expect(origemPermitida(req({ origin: 'https://corner2.vercel.app', 'x-forwarded-host': 'corner2.vercel.app', host: 'interno:3000' }))).toBe(true)
  })

  it('em desenvolvimento (http://localhost:3000): sim', () => {
    expect(origemPermitida(req({ origin: 'http://localhost:3000', host: 'localhost:3000' }, 'http://localhost:3000/api/assinatura/checkout'))).toBe(true)
  })
})

describe('origemDoSite (para montar os endereços de retorno)', () => {
  it('usa o protocolo e o host informados pelo proxy', () => {
    expect(origemDoSite(req({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'corner2.vercel.app' }))).toBe('https://corner2.vercel.app')
  })

  it('sem proxy, usa o endereço do próprio pedido', () => {
    expect(origemDoSite(req({}, 'http://localhost:3000/api/x'))).toBe('http://localhost:3000')
  })

  it('com vários valores no cabeçalho, usa o primeiro', () => {
    expect(origemDoSite(req({ 'x-forwarded-proto': 'https, http', 'x-forwarded-host': 'corner2.vercel.app, interno' }))).toBe('https://corner2.vercel.app')
  })

  it('nunca usa um host que não seja do próprio pedido para http (evita retorno para site alheio)', () => {
    expect(origemDoSite(req({ 'x-forwarded-proto': 'javascript', 'x-forwarded-host': 'corner2.vercel.app' }))).toBe('https://corner2.vercel.app')
  })
})

describe('lerPedidoDeCheckout (valida o corpo: nível e período vêm de uma lista fechada)', () => {
  it('aceita nível e período válidos', () => {
    expect(lerPedidoDeCheckout({ nivel: 'amador', periodo: 'anual' })).toEqual({ nivel: 'amador', periodo: 'anual' })
  })

  it.each([
    [null], [undefined], ['amador'], [42], [[]], [{}],
    [{ nivel: 'amador' }], [{ periodo: 'mensal' }],
    [{ nivel: 'ouro', periodo: 'mensal' }], [{ nivel: 'amador', periodo: 'semanal' }],
    [{ nivel: 'AMADOR', periodo: 'mensal' }], [{ nivel: ['amador'], periodo: 'mensal' }],
    [{ nivel: 'amador', periodo: 'mensal', price: 'price_x' }],
  ])('recusa %j', corpo => {
    // Campos extras (como um id de preço escolhido pelo navegador) tornam o pedido inválido.
    expect(lerPedidoDeCheckout(corpo)).toBeNull()
  })
})
