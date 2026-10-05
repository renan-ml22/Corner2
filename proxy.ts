import { NextRequest, NextResponse } from 'next/server'
import { decrypt, SESSION_COOKIE } from '@/lib/session'

const PUBLIC_ROUTES = ['/login']

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
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:png|svg|jpg|jpeg|webp|ico)$).*)'],
}
