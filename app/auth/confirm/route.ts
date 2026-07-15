// CANONICAL: GET /auth/confirm — email confirmation handler. Primary path is the
// token_hash flow used by Supabase email templates ({{ .TokenHash }}); also tolerates
// ?code=… so either template style completes the flow. Same-URL contract as required
// by the spec (route groups don't affect URLs, so this IS /auth/confirm).

import { NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function safeNext(raw: string | null, fallback: string): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')

  const fallback = type === 'recovery' ? '/reset-password' : '/dashboard'
  const next = safeNext(searchParams.get('next'), fallback)

  const supabase = await createClient()

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('[auth/confirm] token verification failed:', error.message)
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(`${origin}${next}`)
    console.error('[auth/confirm] code exchange failed:', error.message)
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent(
      'That confirmation link didn’t work — it may have expired. Sign in to get a fresh one.'
    )}`
  )
}
