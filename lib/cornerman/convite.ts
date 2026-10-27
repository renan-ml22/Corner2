// O convite do treinador para o aluno: o que vale no navegador e no servidor (puro, sem rede).
// O token de 32 bytes só existe no link; o banco guarda apenas o hash (veja convite-token.ts).

export const VALIDADE_DO_CONVITE_DIAS = 14

/** Cookie que leva o token do convite do aluno pelo login ou pelo cadastro, até a tela de aceite. */
export const COOKIE_DO_CONVITE = 'corner_convite'
export const VALIDADE_DO_COOKIE_SEGUNDOS = 3600

const DIA_MS = 24 * 60 * 60 * 1000

/** 32 bytes em base64url = exatamente 43 caracteres. Qualquer outra coisa nunca chega ao banco. */
export const ehTokenDeConvite = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v)

export const expiraEm = (agora: Date): string => new Date(agora.getTime() + VALIDADE_DO_CONVITE_DIAS * DIA_MS).toISOString()

export const linkDoConvite = (origem: string, token: string): string => `${origem}/convite/${token}`
