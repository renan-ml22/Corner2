import { describe, expect, it, vi } from 'vitest'
import { criarFonte } from '@/lib/dados/fonte'
import { criarRepositorioLocal } from '@/lib/dados/repositorio-local'
import { ENTIDADES } from '@/lib/dados/entidades'

const peso = (id: string) => ({ id, data: '2026-10-14', kg: 70 })

function repo() {
  const dados = new Map<string, string>()
  return criarRepositorioLocal({
    usuarioId: 'u1',
    storage: { getItem: k => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v) },
    eventos: null,
  })
}

describe('criarFonte (cabo entre o repositório e o useSyncExternalStore)', () => {
  it('no servidor devolve sempre o valor inicial, sem tocar no armazenamento', () => {
    const f = criarFonte(repo(), 'pesos')
    expect(f.obterNoServidor()).toBe(ENTIDADES.pesos.inicial)
  })

  it('no cliente devolve o que está no repositório, com a mesma referência até mudar', () => {
    const r = repo()
    const f = criarFonte(r, 'pesos')
    r.gravar('pesos', [peso('a')])
    const primeiro = f.obter()
    expect(primeiro).toEqual([peso('a')])
    expect(f.obter()).toBe(primeiro)
  })

  it('definir aceita um valor direto', () => {
    const f = criarFonte(repo(), 'pesos')
    f.definir([peso('a')])
    expect(f.obter()).toEqual([peso('a')])
  })

  it('definir com função recebe o valor mais recente, então atualizações em sequência não se perdem', () => {
    const f = criarFonte(repo(), 'pesos')
    f.definir(anterior => [...anterior, peso('a')])
    f.definir(anterior => [...anterior, peso('b')])
    expect(f.obter().map(p => p.id)).toEqual(['a', 'b'])
  })

  it('definir enxerga mudanças feitas por outro caminho (outra fonte da mesma entidade)', () => {
    const r = repo()
    const f1 = criarFonte(r, 'pesos')
    const f2 = criarFonte(r, 'pesos')
    f1.definir([peso('a')])
    f2.definir(anterior => [...anterior, peso('b')])
    expect(f1.obter().map(p => p.id)).toEqual(['a', 'b'])
  })

  it('assinar avisa quando qualquer fonte grava', () => {
    const r = repo()
    const f = criarFonte(r, 'config')
    const cb = vi.fn()
    f.assinar(cb)
    f.definir(anterior => ({ ...anterior, metaSemanal: 5 }))
    expect(cb).toHaveBeenCalledTimes(1)
    expect(f.obter()).toEqual({ metaSemanal: 5 })
  })

  it('o definir e o assinar mantêm a mesma identidade (seguros como dependência de hooks)', () => {
    const f = criarFonte(repo(), 'pesos')
    expect(f.definir).toBe(f.definir)
    expect(f.assinar).toBe(f.assinar)
  })
})
