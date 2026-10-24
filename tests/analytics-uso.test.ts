import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { EVENTOS } from '@/lib/analytics'

// O app guarda dados de saúde. Este teste vigia o CÓDIGO: as métricas só saem por lib/analytics.ts (lista fechada),
// só um arquivo conversa com o posthog-js, cada evento combinado é de fato chamado em algum lugar, e as chamadas
// não carregam e-mail, nome, nota, lesão, peso nem nada parecido.

const RAIZ = path.resolve(__dirname, '..')
const PASTAS = ['app', 'components', 'hooks', 'lib']

function arquivos(dir: string, saida: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const caminho = path.join(dir, nome)
    if (statSync(caminho).isDirectory()) arquivos(caminho, saida)
    else if (/\.tsx?$/.test(nome)) saida.push(caminho)
  }
  return saida
}

const rel = (f: string) => path.relative(RAIZ, f).replace(/\\/g, '/')
const fontes = PASTAS.flatMap(p => arquivos(path.join(RAIZ, p))).map(f => ({ caminho: rel(f), texto: readFileSync(f, 'utf8') }))
const doCliente = fontes.filter(f => f.caminho !== 'lib/posthog.ts' && f.caminho !== 'lib/analytics.ts')

/** Cada chamada `track('evento', {...})` com o texto do objeto de propriedades. */
function chamadas() {
  const achadas: { arquivo: string; evento: string; props: string }[] = []
  for (const f of doCliente) {
    for (const m of f.texto.matchAll(/\btrack\(\s*['"]([a-z_]+)['"]\s*,\s*(\{[^}]*\})/g)) achadas.push({ arquivo: f.caminho, evento: m[1], props: m[2] })
  }
  return achadas
}

describe('métricas de produto: uso no código', () => {
  it('só lib/posthog.ts importa o posthog-js (os outros usam lib/analytics.ts, que é uma lista fechada)', () => {
    const importando = fontes.filter(f => f.caminho !== 'lib/posthog.ts' && /^\s*import\s+(?!type\b)[^;\n]*from\s+['"]posthog-js/m.test(f.texto)).map(f => f.caminho)
    expect(importando).toEqual([])
  })

  it('ninguém chama capture, identify, register, people ou group do PostHog direto', () => {
    const diretos = fontes.filter(f => f.caminho !== 'lib/posthog.ts' && /\bposthog\w*\.(capture|identify|register|people|group|set_config|opt_in_capturing|startSessionRecording)\b/.test(f.texto)).map(f => f.caminho)
    expect(diretos).toEqual([])
  })

  it('a chave do PostHog é lida só em lib/posthog.ts', () => {
    const lendo = fontes.filter(f => f.caminho !== 'lib/posthog.ts' && /NEXT_PUBLIC_POSTHOG/.test(f.texto)).map(f => f.caminho)
    expect(lendo).toEqual([])
  })

  it('toda chamada de track usa um evento da lista combinada', () => {
    const desconhecidos = chamadas().filter(c => !(EVENTOS as readonly string[]).includes(c.evento)).map(c => `${c.arquivo}: ${c.evento}`)
    expect(desconhecidos).toEqual([])
  })

  it.each(EVENTOS.filter(e => e !== 'onboarding_started'))('o evento %s é chamado em algum lugar do app, com propriedades', evento => {
    expect(chamadas().filter(c => c.evento === evento).length, `nenhuma chamada de ${evento}`).toBeGreaterThan(0)
  })

  it('onboarding_started é chamado em algum lugar do app', () => {
    const achou = doCliente.some(f => /\btrack\(\s*['"]onboarding_started['"]/.test(f.texto))
    expect(achou).toBe(true)
  })

  it('nenhuma chamada carrega e-mail, nome, senha, nota, lesão, peso, parceiro ou o resultado de uma pancada', () => {
    const proibido = /\b(email|e_mail|senha|password|nome|name|nota|lesao|lesoes|peso|kg|parceiro|cabeca|regiao|sparring|intensidade)\b/i
    const vazando = chamadas().filter(c => proibido.test(c.props)).map(c => `${c.arquivo}: ${c.evento} ${c.props}`)
    expect(vazando).toEqual([])
  })

  it('a identificação usa só o id (nada de e-mail ou nome como segundo argumento)', () => {
    const chamadasDeIdentificar = doCliente.flatMap(f => [...f.texto.matchAll(/\bidentificarUsuario\(([^)]*)\)/g)].map(m => ({ arquivo: f.caminho, args: m[1] })))
    expect(chamadasDeIdentificar.length).toBeGreaterThan(0)
    for (const c of chamadasDeIdentificar) {
      expect(c.args.includes(','), `${c.arquivo}: identificar com mais de um argumento`).toBe(false)
      expect(c.args, c.arquivo).not.toMatch(/email|nome|name/i)
    }
  })

  it('o provider do PostHog está no layout raiz', () => {
    const layout = fontes.find(f => f.caminho === 'app/layout.tsx')!
    expect(layout.texto).toMatch(/<PostHogProvider>/)
  })

  it('sair da conta esquece a pessoa (reset) antes de encerrar a sessão', () => {
    const sair = fontes.find(f => f.caminho === 'components/SairButton.tsx')!
    expect(sair.texto).toMatch(/resetarUsuario\(\)/)
  })
})
