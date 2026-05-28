import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_KEY = process.env.BIENTOT_ADMIN_KEY || 'afrione-admin-2026'
const COOKIE_NAME = 'bientot_admin'

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl

  // Si la clé admin est dans l'URL → poser le cookie et rediriger proprement
  const keyParam = searchParams.get('key')
  if (keyParam === ADMIN_KEY) {
    const target = new URL(pathname, request.url)
    const response = NextResponse.redirect(target)
    response.cookies.set(COOKIE_NAME, ADMIN_KEY, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  }

  const isAdmin = request.cookies.get(COOKIE_NAME)?.value === ADMIN_KEY

  // Admin → accès libre partout
  if (isAdmin) return NextResponse.next()

  // Non-admin sur /bientot → laisser passer
  if (pathname === '/bientot') return NextResponse.next()

  // Non-admin sur n'importe quelle autre page → rediriger vers /bientot
  return NextResponse.redirect(new URL('/bientot', request.url))
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.mp4|.*\\.webm).*)',
  ],
}
