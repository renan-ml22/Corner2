import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_DO_CONVITE } from '@/lib/cornerman/convite'
import { decidirRota } from '@/lib/cornerman/proxy-regras'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

// Quem decide para onde cada pedido vai é `decidirRota` (lib/cornerman/proxy-regras.ts, com testes):
// - /login e /onboarding (só a tela de cadastro, o primeiro passo) são públicos; quem já está logado vai para /hoje.
//   Os passos seguintes do onboarding (/onboarding/nivel, /frequencia e /plano) exigem login e usam a sessão aberta no cadastro.
// - /convite/<token> é público para todos (o aluno precisa vê-lo antes e depois de entrar).
// - Quem entra com um convite guardado (cookie) volta para ele em vez de ficar em /hoje.
export default async function proxy(req: NextRequest) {
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value)
  const decisao = decidirRota({
    caminho: req.nextUrl.pathname,
    logado: !!session?.userId,
    cookieDoConvite: req.cookies.get(COOKIE_DO_CONVITE)?.value,
  })
  if (decisao.tipo === 'redirecionar') return NextResponse.redirect(new URL(decisao.para, req.nextUrl))
  return NextResponse.next()
}

export const config = {
  // sw.js, offline.html e os ícones precisam abrir sem login (o navegador os busca antes da sessão).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)'],
}
