import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Um nome de ícone Phosphor que não existe NÃO dá erro nenhum: o ícone só some (fica um espaço em branco), e os testes
// de navegador bloqueiam o CDN dos ícones, então ninguém percebe. Já aconteceu: `ph-seedling` não existe no Phosphor 2.1.1
// e o cartão "Iniciante" do onboarding foi para o ar sem ícone.
//
// Este teste compara cada ícone usado no código com a lista oficial da versão que o app carrega (a mesma do layout raiz).
// A lista está em tests/phosphor-2.1.1-icones.txt. Se o app passar a carregar outra versão do Phosphor, atualize o arquivo.

const RAIZ = path.resolve(__dirname, '..')
const OFICIAIS = new Set(readFileSync(path.join(__dirname, 'phosphor-2.1.1-icones.txt'), 'utf8').split(/\r?\n/).filter(Boolean))
const ESTILOS = new Set(['fill', 'bold', 'duotone', 'thin', 'light', 'regular'])

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida)
    else if (/\.(tsx?|css)$/.test(nome)) saida.push(caminho)
  }
  return saida
}

const usados = new Map<string, Set<string>>()
for (const pasta of ['app', 'components', 'hooks', 'lib', 'data']) {
  for (const arquivo of arquivos(path.join(RAIZ, pasta))) {
    const texto = readFileSync(arquivo, 'utf8')
    for (const m of texto.matchAll(/\bph-([a-z0-9]+(?:-[a-z0-9]+)*)/g)) {
      if (ESTILOS.has(m[1])) continue
      if (!usados.has(m[1])) usados.set(m[1], new Set())
      usados.get(m[1])!.add(path.relative(RAIZ, arquivo).split(path.sep).join('/'))
    }
  }
}

describe('ícones do Phosphor', () => {
  it('a lista oficial está completa (mais de mil ícones)', () => {
    expect(OFICIAIS.size).toBeGreaterThan(1000)
    expect(OFICIAIS.has('boxing-glove')).toBe(true)
  })

  it('o app usa ícones (senão o teste não está olhando para nada)', () => {
    expect(usados.size).toBeGreaterThan(30)
  })

  it('todo ícone usado no código existe no Phosphor 2.1.1', () => {
    const inexistentes = [...usados.entries()].filter(([nome]) => !OFICIAIS.has(nome)).map(([nome, onde]) => `ph-${nome} em ${[...onde].join(', ')}`)
    expect(inexistentes).toEqual([])
  })
})
