import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyJWT } from '@/lib/auth'

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value
  const { pathname } = request.nextUrl

  // Define protected paths
  const isDashboardPath = pathname.startsWith('/dashboard')
  const isProtectedApiPath = pathname.startsWith('/api/research') || pathname.startsWith('/api/suggestions')
  const isAuthPath = pathname.startsWith('/login')

  // Verify JWT if token is present
  const user = token ? await verifyJWT(token) : null

  if (isDashboardPath) {
    if (!user) {
      // Redirect to login if not authenticated
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  if (isProtectedApiPath) {
    if (!user) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized. Please log in.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  if (isAuthPath) {
    if (user) {
      // Redirect to dashboard if already logged in
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/research/:path*', '/api/suggestions/:path*', '/login'],
}
