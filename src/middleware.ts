import { NextRequest, NextResponse } from 'next/server'

// Redirige la racine "/" vers "/bientot" si pas de session active
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname === '/') {
    const token =
      request.cookies.get('sb-access-token')?.value ||
      request.cookies.get('sb-refresh-token')?.value ||
      // format cookie Supabase SSR : sb-<project_ref>-auth-token
      [...request.cookies.getAll()].find(c => c.name.includes('-auth-token'))?.value

    if (!token) {
      return NextResponse.redirect(new URL('/bientot', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/'],
}
