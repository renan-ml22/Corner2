import { afterEach, describe, expect, it, vi } from 'vitest'
import { ErroCornerman } from '@/lib/cornerman/servico'
import { LIMITE_DO_CORPO_BYTES, respostaDeErroDoCornerman } from '@/lib/cornerman/http'

vi.mock('server-only', () => ({}))

afterEach(() => vi.restoreAllMocks())

describe('limite do corpo', () => {
  it('100 000 bytes: cabe uma ficha com foto (cerca de 14 000) e notas de 2 000 caracteres', () => {
    expect(LIMITE_DO_CORPO_BYTES).toBe(100_000)
  })
})

describe('respostaDeErroDoCornerman', () => {
  it('erro conhecido: o status, o código e o texto próprios', () => {
    const r = respostaDeErroDoCornerman(new ErroCornerman('limite_de_alunos', 'Você já tem 20 alunos.', 409))
    expect(r).toEqual({ status: 409, corpo: { erro: 'Você já tem 20 alunos.', codigo: 'limite_de_alunos' } })
  })

  it('qualquer outro erro vira 502 genérico, sem a mensagem original na resposta', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = respostaDeErroDoCornerman(new Error('Supabase (gravar aluno): duplicate key "Nome Identificável" beto@exemplo.com'))
    expect(r.status).toBe(502)
    expect(r.corpo.codigo).toBe('falha_no_banco')
    expect(JSON.stringify(r)).not.toMatch(/Identificável|beto@|duplicate/)
  })

  it('o registro de erros guarda só onde falhou, nunca o que veio depois dos dois pontos (pode ter dados da ficha)', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    respostaDeErroDoCornerman(new Error('Supabase (gravar aluno): valor "Nome Identificável" e beto@exemplo.com'))
    respostaDeErroDoCornerman(new TypeError('beto@exemplo.com não é válido'))
    respostaDeErroDoCornerman('texto solto com beto@exemplo.com')
    const tudo = log.mock.calls.flat().join('\n')
    expect(tudo).toContain('Supabase (gravar aluno)')
    expect(tudo).not.toMatch(/Identificável|beto@/)
    expect(log).toHaveBeenCalledTimes(3)
  })
})
