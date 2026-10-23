import { NextRequest, NextResponse } from 'next/server'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

// /onboarding (só a tela de cadastro, o primeiro passo) é pública; quem já está logado vai direto para /hoje.
// Os passos seguintes (/onboarding/nivel, /frequencia e /plano) exigem login e usam a sessão aberta no cadastro.
const PUBLIC_ROUTES = ['/login', '/onboarding']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isPublic = PUBLIC_ROUTES.includes(path)
  const session = await decrypt(req.cookies.get(SESSION_COOKIE)?.value)

  if (!isPublic && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL('/hoje', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  // sw.js, offline.html e os ícones precisam abrir sem login (o navegador os busca antes da sessão).
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)'],
}
