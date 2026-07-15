// CANONICAL: GET /auth/callback — session establishment for OAuth (Google/GitHub) and
// PKCE email links (signup confirmation, password recovery). Tolerant of both formats:
//   ?code=…                        → exchangeCodeForSession (OAuth + PKCE links)
//   ?token_hash=…&type=…           → verifyOtp (custom Supabase email templates)
// Supabase auth config (Deploy Mind): Site URL + redirect URLs must include
// `${NEXT_PUBLIC_APP_URL}/auth/callback` — never hardcode a domain here.

import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function safeNext(raw: string | null, fallback: string): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // Recovery links land on the set-a-new-password page; everything else → dashboard.
  const fallback = type === 'recovery' ? '/reset-password' : '/dashboard'
  const next = safeNext(searchParams.get('next'), fallback)

  const supabase = await createClient()

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('[auth/callback] code exchange failed:', error.message)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('[auth/callback] token verification failed:', error.message)
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      "That link didn't work — it may have expired. Sign in, or request a fresh link."
    )}`
  )
}
