// CANONICAL: SubCompliance root middleware — Supabase session refresh + route protection.
//
// Self-validation fixes:
//   • Route groups don't affect URLs — the dashboard group serves /gcs, /settings and
//     /billing (not /dashboard/gcs). Those prefixes are now protected too.
//   • /api/cron/* is exempt from the session gate: the scheduler authenticates with
//     Bearer CRON_SECRET (the route fails closed on its own), and it has no cookies —
//     the previous blanket 401 silently killed the daily status refresh + reminders.
//
// Responsibilities:
//   1. Refresh the Supabase auth session cookie on every matched request.
//   2. Protected pages → signed-out users are redirected to /login?next=…
//   3. /api/* (except /api/webhooks and /api/cron) → signed-out calls get 401 JSON.
//   4. /login and /signup → signed-in users are redirected to /dashboard.
//
// Required env (set on Netlify, never hardcoded):
//   NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PAGE_PREFIXES = ['/dashboard', '/gcs', '/settings', '/billing']
const SIGNED_IN_REDIRECT_PATHS = ['/login', '/signup']

function redirectWithCookies(url: URL, carrier: NextResponse): NextResponse {
  // Carry any refreshed auth cookies onto the redirect so the session survives it.
  const redirect = NextResponse.redirect(url)
  for (const cookie of carrier.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // No module-level throws (build safety). If env is missing we log and pass through —
  // every API route and server page re-checks auth itself (defense in depth).
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[middleware] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() validates the JWT with Supabase — never trust getSession() for gating.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // ---- API routes ------------------------------------------------------------
  if (pathname.startsWith('/api')) {
    // /api/webhooks: reserved for server-to-server traffic (the CENTRAL payments
    // service owns the single Stripe webhook — nothing here may intercept it).
    // /api/cron: the scheduler calls with Bearer CRON_SECRET and no cookies; the
    // route authenticates itself and fails closed without the secret.
    if (pathname.startsWith('/api/webhooks') || pathname.startsWith('/api/cron')) {
      return supabaseResponse
    }
    if (!user) {
      // Match the { data, error, code } envelope from lib/db/api.ts apiError().
      return NextResponse.json(
        {
          data: null,
          error: 'You need to be signed in for that. Sign in and try again.',
          code: 'UNAUTHORIZED',
        },
        { status: 401 }
      )
    }
    return supabaseResponse
  }

  // ---- Protected pages -------------------------------------------------------
  const needsAuth = PROTECTED_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  if (!user && needsAuth) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', pathname + request.nextUrl.search)
    return redirectWithCookies(url, supabaseResponse)
  }

  // ---- Keep signed-in users out of login/signup ------------------------------
  // Note: /reset-password is intentionally NOT here — the password-recovery flow
  // arrives with a valid session and must reach that page.
  if (user && SIGNED_IN_REDIRECT_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return redirectWithCookies(url, supabaseResponse)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on everything except static assets and images.
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|woff2?)$).*)',
  ],
}
