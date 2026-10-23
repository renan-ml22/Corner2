// Regras do onboarding de quem acaba de criar a conta: níveis, dias por semana, plano recomendado e validação do cadastro.
// Puras e sem rede (valem no navegador e no servidor). A recomendação reaproveita as regras do perfil de atleta.

import { PLANOS, getPlano, type Plano } from '@/data/planos'
import { metaInicial } from '@/lib/perfil'
import type { Experiencia } from '@/lib/tipos'

// ── Nível ────────────────────────────────────────────────────

export type Nivel = 'iniciante' | 'intermediario' | 'avancado'

export interface OpcaoDeNivel {
  id: Nivel
  titulo: string
  descricao: string
  /** Nome do ícone do Phosphor (usado como `ph-fill ${icone}`). */
  icone: string
  /** Como o app já guarda a experiência de quem treina. */
  experiencia: Experiencia
}

export const NIVEIS: OpcaoDeNivel[] = [
  { id: 'iniciante', titulo: 'Iniciante', descricao: 'Estou começando ou treino há menos de 1 ano.', icone: 'ph-seedling', experiencia: 'ate1' },
  { id: 'intermediario', titulo: 'Intermediário', descricao: 'Treino há 1 a 3 anos e já domino o básico.', icone: 'ph-lightning', experiencia: '1a3' },
  { id: 'avancado', titulo: 'Avançado', descricao: 'Treino há mais de 3 anos ou já compito.', icone: 'ph-trophy', experiencia: 'mais3' },
]

export function experienciaDoNivel(nivel: Nivel): Experiencia {
  return (NIVEIS.find(n => n.id === nivel) ?? NIVEIS[0]).experiencia
}

/** "Nunca treinei" e "menos de 1 ano" contam como iniciante. `null` quando a pessoa ainda não informou. */
export function nivelDaExperiencia(experiencia: Experiencia | null | undefined): Nivel | null {
  switch (experiencia) {
    case 'nenhuma': case 'ate1': return 'iniciante'
    case '1a3': return 'intermediario'
    case 'mais3': return 'avancado'
    default: return null
  }
}

// ── Frequência e plano ───────────────────────────────────────

export const OPCOES_DE_DIAS = [2, 3, 4, 5] as const

/**
 * Plano recomendado para o nível e os dias por semana:
 * iniciante começa pelos Fundamentos; intermediário constrói a base aeróbica; avançado vai para a técnica avançada
 * e, treinando 5 dias, para a preparação de competição.
 */
export function planoDoOnboarding(nivel: Nivel, dias: number): Plano {
  const id =
    nivel === 'iniciante' ? 'fundamentos'
    : nivel === 'intermediario' ? 'base-aerobica'
    : dias >= 5 ? 'pre-competicao'
    : 'tecnica-avancada'
  return getPlano(id) ?? PLANOS[0]
}

/** Meta semanal inicial: os dias que a pessoa pode treinar, limitados ao que o plano pede. */
export function metaDoOnboarding(nivel: Nivel, dias: number): number {
  return metaInicial(dias, planoDoOnboarding(nivel, dias))
}

// ── Cadastro ─────────────────────────────────────────────────

export interface Cadastro { nome: string; email: string; senha: string }
export type CampoDoCadastro = keyof Cadastro
export type ResultadoDoCadastro = { ok: true; valores: Cadastro } | { ok: false; erros: Partial<Record<CampoDoCadastro, string>> }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NOME_MAX = 80
const EMAIL_MAX = 254
const SENHA_MIN = 8
/** O Supabase (bcrypt) ignora tudo depois de 72 bytes: melhor recusar do que aceitar uma senha cortada em silêncio. */
const SENHA_MAX_BYTES = 72

const texto = (v: unknown): string => (typeof v === 'string' ? v : '')

/** Confere o que a pessoa digitou e devolve os valores limpos. As mensagens nunca repetem a senha. */
export function validarCadastro(entrada: Partial<Record<CampoDoCadastro, unknown>>): ResultadoDoCadastro {
  const nome = texto(entrada.nome).trim().replace(/\s+/g, ' ')
  const email = texto(entrada.email).trim().toLowerCase()
  const senha = texto(entrada.senha)
  const erros: Partial<Record<CampoDoCadastro, string>> = {}

  if ((nome.match(/\p{L}/gu) ?? []).length < 2) erros.nome = 'Digite o seu nome completo.'
  else if (nome.length > NOME_MAX) erros.nome = `O nome pode ter no máximo ${NOME_MAX} caracteres.`

  if (!EMAIL.test(email)) erros.email = 'Digite um e-mail válido.'
  else if (email.length > EMAIL_MAX) erros.email = 'Este e-mail é comprido demais.'

  if (senha.trim() === '' || [...senha].length < SENHA_MIN) erros.senha = `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`
  else if (new TextEncoder().encode(senha).length > SENHA_MAX_BYTES) erros.senha = 'A senha é comprida demais. Use até 72 caracteres.'
  else if (senha.toLowerCase() === email) erros.senha = 'A senha não pode ser igual ao e-mail.'

  return Object.keys(erros).length > 0 ? { ok: false, erros } : { ok: true, valores: { nome, email, senha } }
}
