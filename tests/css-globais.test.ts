import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Uma classe escrita como texto num className ("surface-card", "btn-primary") só funciona se houver uma
// regra global para ela. Se a regra for movida para um CSS Module, a tela perde o estilo em silêncio.

const RAIZ = path.resolve(__dirname, '..')

function arquivos(dir: string, ext: RegExp, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    if (nome === 'node_modules' || nome === '.next') continue
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, ext, saida)
    else if (ext.test(nome)) saida.push(caminho)
  }
  return saida
}

const rel = (f: string) => path.relative(RAIZ, f).replace(/\\/g, '/')
const semComentarios = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/** Classes que existem globalmente: seletores dos arquivos globais e o que está em :global(...) nos módulos. */
function classesGlobais(): Set<string> {
  const globais = new Set<string>()
  for (const f of arquivos(path.join(RAIZ, 'app'), /\.css$/).filter(f => !f.endsWith('.module.css'))) {
    const css = semComentarios(readFileSync(f, 'utf8'))
    for (const m of [...css.matchAll(/([^{}]+)\{/g)].filter(m => !m[1].trim().startsWith('@'))) {
      for (const c of m[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) globais.add(c[1])
    }
  }
  for (const f of arquivos(RAIZ, /\.module\.css$/)) {
    const css = semComentarios(readFileSync(f, 'utf8'))
    for (const g of css.matchAll(/:global\(([^)]*)\)/g)) {
      for (const c of g[1].matchAll(/\.([A-Za-z_][\w-]*)/g)) globais.add(c[1])
    }
  }
  return globais
}

/** Trechos de texto (literais) dentro de cada atributo className de um arquivo TSX. */
function textosDeClassName(codigo: string): string[] {
  const textos: string[] = []

  const literais = (expr: string) => {
    let i = 0
    while (i < expr.length) {
      const ch = expr[i]
      if (ch === '"' || ch === "'") {
        const fim = expr.indexOf(ch, i + 1)
        // Literal comparado com === / !== (ex.: nivel === "descanso") é um valor, não uma classe.
        const antes = expr.slice(0, i).trimEnd()
        const depois = expr.slice(fim + 1).trimStart()
        const comparado = /[!=]==?$/.test(antes) || /^[!=]==?/.test(depois)
        if (!comparado) textos.push(expr.slice(i + 1, fim))
        i = fim + 1
      } else if (ch === '`') {
        let j = i + 1
        let atual = ''
        while (j < expr.length && expr[j] !== '`') {
          if (expr[j] === '$' && expr[j + 1] === '{') {
            textos.push(atual + '\u0000') // marca o corte: um prefixo colado em ${...} é dinâmico
            atual = ''
            let prof = 1
            let k = j + 2
            while (k < expr.length && prof) {
              if (expr[k] === '{') prof++
              else if (expr[k] === '}') prof--
              k++
            }
            literais(expr.slice(j + 2, k - 1))
            j = k
          } else {
            atual += expr[j++]
          }
        }
        textos.push(atual)
        i = j + 1
      } else i++
    }
  }

  for (const m of codigo.matchAll(/className=/g)) {
    const j = m.index! + m[0].length
    if (codigo[j] === '"') {
      textos.push(codigo.slice(j + 1, codigo.indexOf('"', j + 1)))
    } else if (codigo[j] === '{') {
      let prof = 1
      let k = j + 1
      while (k < codigo.length && prof) {
        if (codigo[k] === '{') prof++
        else if (codigo[k] === '}') prof--
        k++
      }
      literais(codigo.slice(j + 1, k - 1))
    }
  }
  return textos
}

describe('classes globais usadas nos componentes', () => {
  const globais = classesGlobais()
  const fontes = [...arquivos(path.join(RAIZ, 'app'), /\.tsx$/), ...arquivos(path.join(RAIZ, 'components'), /\.tsx$/)]

  it('o CSS global define as classes básicas do app', () => {
    for (const c of ['surface-card', 'btn-primary', 'page-container', 'field-input']) expect(globais.has(c), c).toBe(true)
  })

  it.each(fontes.map(f => [rel(f), f]))('%s só cita classes que existem', (_nome, caminho) => {
    const codigo = readFileSync(caminho, 'utf8')
    const sem: string[] = []
    for (const texto of textosDeClassName(codigo)) {
      for (const token of texto.split(/\s+/)) {
        if (!token || token.includes('\u0000') || /[${}]/.test(token)) continue
        if (token === 'ph' || token.startsWith('ph-')) continue // ícones Phosphor (vêm de fora)
        if (!globais.has(token)) sem.push(token)
      }
    }
    expect([...new Set(sem)], 'classes sem regra global').toEqual([])
  })
})
