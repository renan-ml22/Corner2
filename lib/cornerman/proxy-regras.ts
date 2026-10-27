// Para onde o proxy (proxy.ts) manda cada pedido. Puro, para testar sem o Next.
// Além do login e do cadastro, cuida do convite do treinador: a página /convite/<token> é pública (para quem já entrou
// e para quem não entrou), e quem acaba de entrar (ou de criar a conta) com um convite guardado volta para ele.

import { ehTokenDeConvite } from './convite'

/** Telas públicas só para quem NÃO está logado (quem está logado vai para /hoje). */
const SO_PARA_DESLOGADOS = ['/login', '/onboarding']

/** `/convite/<algo>`: uma única parte depois de /convite/. A própria página decide se o token vale. */
const PAGINA_DO_CONVITE = /^\/convite\/[^/]+$/

export type DecisaoDeRota = { tipo: 'seguir' } | { tipo: 'redirecionar'; para: string }

export function decidirRota({ caminho, logado, cookieDoConvite }: { caminho: string; logado: boolean; cookieDoConvite: string | undefined }): DecisaoDeRota {
  if (PAGINA_DO_CONVITE.test(caminho)) return { tipo: 'seguir' }

  const soParaDeslogados = SO_PARA_DESLOGADOS.includes(caminho)
  if (!soParaDeslogados && !logado) return { tipo: 'redirecionar', para: '/login' }
  if (soParaDeslogados && logado) return { tipo: 'redirecionar', para: '/hoje' }

  // Login e cadastro terminam em /hoje. Com um convite guardado, o aluno volta para ele. O destino só pode ser
  // /convite/<43 caracteres base64url>: nada vindo do cookie vira endereço de outro site.
  if (logado && caminho === '/hoje' && ehTokenDeConvite(cookieDoConvite)) return { tipo: 'redirecionar', para: `/convite/${cookieDoConvite}` }

  return { tipo: 'seguir' }
}
