import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_KEY = process.env.BIENTOT_ADMIN_KEY || 'afrione-admin-2026'
const COOKIE_NAME = 'bientot_admin'

export function middleware(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const keyParam = searchParams.get('key')
  if (keyParam === ADMIN_KEY) {
    const response = NextResponse.redirect(new URL('/bientot', request.url))
    response.cookies.set(COOKIE_NAME, ADMIN_KEY, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return response
  }

  const cookie = request.cookies.get(COOKIE_NAME)
  if (cookie?.value !== ADMIN_KEY) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/bientot'],
}
