import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Num CSS Module, usar uma classe que não existe devolve `undefined` sem nenhum erro de compilação,
// e uma animação que aponta para um @keyframes global nunca roda. Este teste pega os dois problemas.

const RAIZ = path.resolve(__dirname, '..')
const PASTAS = ['app', 'components', 'hooks', 'lib']

function arquivos(dir: string, ext: RegExp, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, saida)
    else if (ext.test(nome)) saida.push(caminho)
  }
  return saida
}

const modulos = PASTAS.flatMap(p => arquivos(path.join(RAIZ, p), /\.module\.css$/))
const fontes = PASTAS.flatMap(p => arquivos(path.join(RAIZ, p), /\.(tsx|ts)$/))
const rel = (f: string) => path.relative(RAIZ, f).replace(/\\/g, '/')

/** Classes definidas no módulo (ignora o que está em :global(...) e dentro de comentários). */
function classesDefinidas(css: string): Set<string> {
  const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/:global\([^)]*\)/g, '')
  const seletores = [...limpo.matchAll(/([^{}]+)\{/g)].map(m => m[1]).filter(s => !s.trim().startsWith('@'))
  const classes = new Set<string>()
  for (const sel of seletores) for (const m of sel.matchAll(/\.([A-Za-z_][\w-]*)/g)) classes.add(m[1])
  return classes
}

describe('CSS Modules', () => {
  it('há módulos para conferir', () => {
    expect(modulos.length).toBeGreaterThan(5)
  })

  describe.each(modulos.map(m => [rel(m), m]))('%s', (_nome, caminho) => {
    const css = readFileSync(caminho, 'utf8')

    it('toda classe usada no código existe no CSS do módulo', () => {
      const definidas = classesDefinidas(css)
      const nomeArquivo = path.basename(caminho)
      const faltando: string[] = []
      for (const fonte of fontes) {
        const texto = readFileSync(fonte, 'utf8').replace(/^\s*import.*$/gm, '') // o caminho do import também tem pontos
        const completo = readFileSync(fonte, 'utf8')
        const imp = new RegExp(`import\\s+(\\w+)\\s+from\\s+['"][^'"]*${nomeArquivo.replace(/\./g, '\\.')}['"]`).exec(completo)
        if (!imp) continue
        // Só vale para o módulo que está na mesma pasta ou é referenciado pelo mesmo nome.
        const id = imp[1]
        for (const m of texto.matchAll(new RegExp(`\\b${id}\\.([A-Za-z_]\\w*)`, 'g'))) {
          if (!definidas.has(m[1])) faltando.push(`${rel(fonte)}: ${id}.${m[1]}`)
        }
        for (const m of texto.matchAll(new RegExp(`\\b${id}\\[['"]([^'"]+)['"]\\]`, 'g'))) {
          if (!definidas.has(m[1])) faltando.push(`${rel(fonte)}: ${id}['${m[1]}']`)
        }
      }
      expect(faltando, 'classes usadas que não existem no módulo').toEqual([])
    })

    it('animações apontam para @keyframes do próprio arquivo (nomes de @keyframes são locais ao módulo)', () => {
      const limpo = css.replace(/\/\*[\s\S]*?\*\//g, '')
      const locais = new Set([...limpo.matchAll(/@keyframes\s+([\w-]+)/g)].map(m => m[1]))
      const ignorar = new Set(['none', 'infinite', 'forwards', 'backwards', 'both', 'normal', 'reverse', 'alternate', 'alternate-reverse', 'running', 'paused', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'step-start', 'step-end', 'initial', 'inherit', 'unset', 'revert'])
      const sem: string[] = []
      for (const m of limpo.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
        const valor = m[1].replace(/[\w-]+\([^)]*\)/g, '') // tira cubic-bezier(...), steps(...)
        for (const token of valor.split(/[\s,]+/)) {
          if (!/^[A-Za-z_][\w-]*$/.test(token) || ignorar.has(token) || /^\d/.test(token)) continue
          if (!locais.has(token) && !token.startsWith('var')) sem.push(token)
        }
      }
      expect(sem, 'animação cujo @keyframes não está neste arquivo').toEqual([])
    })
  })
})
