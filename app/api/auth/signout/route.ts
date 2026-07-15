// CANONICAL: POST /api/auth/signout — server-side sign-out (clears the Supabase session).
// The dashboard (core step) calls this either as fetch (Accept: application/json → JSON)
// or as a plain <form method="post"> (→ 303 redirect home).
//
// UI contract:
//   fetch('/api/auth/signout', { method: 'POST', headers: { Accept: 'application/json' } })
//     → 200 { success: true } → router.push('/'); router.refresh()
//   A 401 from middleware means the session was already gone — treat as signed out.

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// CSRF guard: cookie-authenticated POST must originate from this site.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true // same-origin fetch/form posts may omit the header
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "That request didn't come from SubCompliance, so we stopped it." },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut()
  if (error) {
    console.error('[auth/signout] sign-out failed:', error.message)
    // Cookies are still cleared client-side by the SDK on the next load; report honestly.
    return NextResponse.json(
      { error: "We couldn't fully sign you out — refresh and try once more." },
      { status: 500 }
    )
  }

  const accepts = request.headers.get('accept') ?? ''
  if (accepts.includes('application/json')) {
    return NextResponse.json({ success: true })
  }
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
