import { describe, expect, it } from 'vitest'
import { decidirRota } from '@/lib/cornerman/proxy-regras'

// Para onde o proxy manda cada pedido: login, cadastro, página do convite e a volta do aluno ao convite depois do login.

const TOKEN = 'A'.repeat(43)
const seguir = { tipo: 'seguir' }
const para = (destino: string) => ({ tipo: 'redirecionar', para: destino })

describe('como era antes (sem convite)', () => {
  it('sem sessão em uma página do app: vai para /login', () => {
    for (const caminho of ['/hoje', '/plano', '/perfil', '/alunos', '/assinatura']) {
      expect(decidirRota({ caminho, logado: false, cookieDoConvite: undefined }), caminho).toEqual(para('/login'))
    }
  })

  it('sem sessão em /login e /onboarding: segue (são públicas)', () => {
    expect(decidirRota({ caminho: '/login', logado: false, cookieDoConvite: undefined })).toEqual(seguir)
    expect(decidirRota({ caminho: '/onboarding', logado: false, cookieDoConvite: undefined })).toEqual(seguir)
  })

  it('com sessão em /login e /onboarding: vai para /hoje', () => {
    expect(decidirRota({ caminho: '/login', logado: true, cookieDoConvite: undefined })).toEqual(para('/hoje'))
    expect(decidirRota({ caminho: '/onboarding', logado: true, cookieDoConvite: undefined })).toEqual(para('/hoje'))
  })

  it('com sessão em qualquer página do app, sem cookie de convite: segue', () => {
    for (const caminho of ['/hoje', '/plano', '/perfil', '/alunos', '/onboarding/nivel']) {
      expect(decidirRota({ caminho, logado: true, cookieDoConvite: undefined }), caminho).toEqual(seguir)
    }
  })
})

describe('página do convite', () => {
  it('é pública para quem não está logado', () => {
    expect(decidirRota({ caminho: `/convite/${TOKEN}`, logado: false, cookieDoConvite: undefined })).toEqual(seguir)
    expect(decidirRota({ caminho: '/convite/qualquer-coisa', logado: false, cookieDoConvite: undefined })).toEqual(seguir)
  })

  it('quem JÁ está logado também a abre (não é jogado para /hoje)', () => {
    expect(decidirRota({ caminho: `/convite/${TOKEN}`, logado: true, cookieDoConvite: undefined })).toEqual(seguir)
    expect(decidirRota({ caminho: `/convite/${TOKEN}`, logado: true, cookieDoConvite: TOKEN })).toEqual(seguir)
  })

  it.each(['/convite', '/convite/', '/conviteX/abc', '/convites/abc', `/convite/${TOKEN}/extra`, '/x/convite/abc'])('%s não é pública: sem sessão, vai para /login', caminho => {
    expect(decidirRota({ caminho, logado: false, cookieDoConvite: undefined })).toEqual(para('/login'))
  })
})

describe('a volta ao convite depois do login ou do onboarding (cookie corner_convite)', () => {
  it('com sessão e cookie válido, /hoje leva ao convite do cookie', () => {
    expect(decidirRota({ caminho: '/hoje', logado: true, cookieDoConvite: TOKEN })).toEqual(para(`/convite/${TOKEN}`))
    const outro = 'aB3-_xYz'.repeat(5) + 'abc'
    expect(decidirRota({ caminho: '/hoje', logado: true, cookieDoConvite: outro })).toEqual(para(`/convite/${outro}`))
  })

  it('só /hoje é desviado: as outras telas abrem normalmente', () => {
    for (const caminho of ['/plano', '/perfil', '/progresso', '/timer', '/alunos', '/onboarding/nivel', '/hoje/outra']) {
      expect(decidirRota({ caminho, logado: true, cookieDoConvite: TOKEN }), caminho).toEqual(seguir)
    }
  })

  it('sem sessão o cookie não muda nada: /hoje vai para /login, /login segue', () => {
    expect(decidirRota({ caminho: '/hoje', logado: false, cookieDoConvite: TOKEN })).toEqual(para('/login'))
    expect(decidirRota({ caminho: '/login', logado: false, cookieDoConvite: TOKEN })).toEqual(seguir)
    expect(decidirRota({ caminho: '/onboarding', logado: false, cookieDoConvite: TOKEN })).toEqual(seguir)
  })

  it.each([
    ['caminho relativo', '../x'],
    ['curto', 'abc'],
    ['44 caracteres', 'A'.repeat(44)],
    ['42 caracteres', 'A'.repeat(42)],
    ['endereço', 'https://mau.com'],
    ['dupla barra', '//mau.com'],
    ['barra no começo', `/${'A'.repeat(42)}`],
    ['com quebra de linha', `${TOKEN}\n`],
    ['vazio', ''],
  ])('cookie malformado (%s) é ignorado: /hoje segue, sem redirecionamento aberto', (_nome, cookie) => {
    expect(decidirRota({ caminho: '/hoje', logado: true, cookieDoConvite: cookie })).toEqual(seguir)
  })

  it('o destino do redirecionamento é sempre um caminho do próprio site', () => {
    const r = decidirRota({ caminho: '/hoje', logado: true, cookieDoConvite: TOKEN })
    expect(r.tipo).toBe('redirecionar')
    if (r.tipo === 'redirecionar') expect(r.para).toMatch(/^\/convite\/[A-Za-z0-9_-]{43}$/)
  })
})
