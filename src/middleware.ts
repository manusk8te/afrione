import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { hostname, pathname, search } = request.nextUrl
  const isProductionAlias =
    hostname === 'afrione-sepia.vercel.app' ||
    hostname === 'afrione-manusk8tes-projects.vercel.app' ||
    (process.env.VERCEL_ENV === 'production' && hostname.endsWith('.vercel.app'))

  // Canonicalize browser visits while allowing internal API and cron calls.
  if (isProductionAlias && (request.method === 'GET' || request.method === 'HEAD') && !pathname.startsWith('/api/')) {
    const canonical = new URL('https://www.afrioneapp.com')
    canonical.pathname = pathname
    canonical.search = search
    return NextResponse.redirect(canonical, 308)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg|.*\\.ico|.*\\.mp4|.*\\.webm).*)',
  ],
}
