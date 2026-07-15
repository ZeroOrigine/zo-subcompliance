// CANONICAL: /login — email/password + Google/GitHub sign-in for SubCompliance.
// Icons come from the shared components/auth/icons (lint #75 — single definitions).
'use client'

import { Suspense, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EyeIcon, GitHubIcon, GoogleIcon, Spinner } from '@/components/auth/icons'

type OAuthProvider = 'google' | 'github'

// QA-025: keep this constant and guard in lockstep with app/(auth)/signup/page.tsx
// (canonical NOT_CONFIGURED_MESSAGE) so every auth page fails soft the same way when
// Supabase env vars are missing, instead of throwing uncaught from a click handler.
const NOT_CONFIGURED_MESSAGE =
  "SubCompliance isn't connected to its account service yet, so we can't do that right now. If you're the site owner, add the Supabase environment variables and redeploy."

// createClient() throws when NEXT_PUBLIC_SUPABASE_* env vars are missing — return
// null instead so handlers show the friendly message above rather than crash (QA-025).
function getSupabaseOrNull(): ReturnType<typeof createClient> | null {
  try {
    return createClient()
  } catch {
    return null
  }
}

// Open-redirect protection: only same-site paths are honored.
function safeNext(raw: string | null): string {
  return raw && raw.startsWith('/') && !raw.startsWith('//') ? raw : '/dashboard'
}

function friendlySignInError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials'))
    return "That email and password don't match our records. Double-check and try again."
  if (m.includes('email not confirmed'))
    return "Almost there — your email isn't confirmed yet. Find our confirmation email and click the link."
  if (m.includes('rate') || m.includes('too many'))
    return 'Too many attempts in a row. Take a breather and try again in a minute.'
  if (m.includes('network') || m.includes('fetch'))
    return "We couldn't reach the server. Check your connection and try again."
  return "We couldn't sign you in just now. Give it another try in a moment."
}

function LoginSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <div className="h-7 w-44 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-4 w-64 animate-pulse rounded bg-slate-100" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="mt-6 space-y-4">
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
      </div>
    </div>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = safeNext(searchParams.get('next'))
  const linkError = searchParams.get('error')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(linkError)
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)

  const busy = submitting || oauthLoading !== null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)

    const trimmed = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("That email doesn't look quite right. Mind checking it?")
      return
    }
    if (password.length === 0) {
      setError("Enter your password and you're in.")
      return
    }

    setSubmitting(true)
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setSubmitting(false)
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: trimmed,
      password,
    })
    if (signInError) {
      setSubmitting(false)
      setError(friendlySignInError(signInError.message))
      return
    }
    router.push(next)
    router.refresh()
  }

  async function handleOAuth(provider: OAuthProvider) {
    if (busy) return
    setError(null)
    setOauthLoading(provider)
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setOauthLoading(null)
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })
    if (oauthError) {
      setOauthLoading(null)
      setError(
        `We couldn't start ${provider === 'google' ? 'Google' : 'GitHub'} sign-in. Try again, or use your email below.`
      )
    }
    // On success the browser navigates to the provider — nothing else to do here.
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Sign in to see where every GC stands — and what’s coming due.
      </p>

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => handleOAuth('google')}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
          Google
        </button>
        <button
          type="button"
          onClick={() => handleOAuth('github')}
          disabled={busy}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {oauthLoading === 'github' ? <Spinner /> : <GitHubIcon />}
          GitHub
        </button>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">or with email</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@yourtrade.com"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <Link href="/forgot-password" className="text-xs font-medium text-blue-700 hover:text-blue-800">
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-11 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner />}
          {submitting ? 'Signing you in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        New here?{' '}
        <Link href="/signup" className="font-semibold text-blue-700 hover:text-blue-800">
          Create your free account
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  // useSearchParams() requires a Suspense boundary in Next.js 14+ prerendering.
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginForm />
    </Suspense>
  )
}
