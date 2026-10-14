import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// Avisos e confirmações vêm de lib/textos.ts. Um literal solto em showToast/confirm volta a espalhar textos.

const RAIZ = path.resolve(__dirname, '..')

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida)
    else if (/\.tsx?$/.test(nome)) saida.push(caminho)
  }
  return saida
}

describe('uso de TEXTOS', () => {
  const fontes = ['app', 'components', 'hooks'].flatMap(p => arquivos(path.join(RAIZ, p)))

  it.each(fontes.map(f => [path.relative(RAIZ, f).replace(/\\/g, '/'), f]))('%s não passa texto solto para showToast ou confirm', (_nome, caminho) => {
    const codigo = readFileSync(caminho, 'utf8')
    const soltos = [...codigo.matchAll(/(showToast|window\.confirm|setErro\w*)\(\s*(["'`])(?!\2)/g)].map(m => m[0])
    expect(soltos).toEqual([])
  })
})
