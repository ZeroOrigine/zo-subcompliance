// CANONICAL: /signup — SubCompliance registration with email confirmation.
// The DB trigger subcompliance_handle_new_user auto-creates the profile (reading
// raw_user_meta_data.full_name) plus a free subscription row — so signup here only
// needs three fields. Shared icons come from components/auth/icons (lint #75).
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EyeIcon, GitHubIcon, GoogleIcon, Spinner } from '@/components/auth/icons'

type OAuthProvider = 'google' | 'github'

const NOT_CONFIGURED_MESSAGE =
  "SubCompliance isn't connected to its account service yet, so we can't do that right now. If you're the site owner, add the Supabase environment variables and redeploy."

// createClient() throws when NEXT_PUBLIC_SUPABASE_* env vars are missing — return
// null instead so handlers can show a friendly message rather than crash (QA-012).
function getSupabaseOrNull(): ReturnType<typeof createClient> | null {
  try {
    return createClient()
  } catch {
    return null
  }
}

function friendlySignUpError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('already registered'))
    return 'You already have an account with this email. Sign in instead?'
  if (m.includes('password'))
    return 'That password is too weak — use at least 8 characters.'
  if (m.includes('rate') || m.includes('too many'))
    return 'Too many attempts in a row. Give it a minute and try again.'
  if (m.includes('invalid'))
    return "That email doesn't look quite right. Mind checking it?"
  return "We couldn't create your account just now. Try again in a moment."
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-4 w-4 flex-none text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null)

  // Email-confirmation state
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [resending, setResending] = useState(false)
  const [resendNote, setResendNote] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const busy = submitting || oauthLoading !== null

  useEffect(() => {
    if (cooldown === 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setError(null)

    const name = fullName.trim()
    const trimmedEmail = email.trim()
    if (name.length === 0) {
      setError('Tell us your name — it goes on your broker requests.')
      return
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      setError("That email doesn't look quite right. Mind checking it?")
      return
    }
    if (password.length < 8) {
      setError('Make your password at least 8 characters.')
      return
    }

    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }

    setSubmitting(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
    setSubmitting(false)

    if (signUpError) {
      setError(friendlySignUpError(signUpError.message))
      return
    }
    // Supabase obfuscates existing accounts: user returned with zero identities.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      setError('You already have an account with this email. Sign in instead?')
      return
    }
    if (data.session) {
      // Email confirmation disabled in this environment — straight to the dashboard.
      router.push('/dashboard')
      router.refresh()
      return
    }
    setSentTo(trimmedEmail)
  }

  async function handleOAuth(provider: OAuthProvider) {
    if (busy) return
    setError(null)
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    setOauthLoading(provider)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
    if (oauthError) {
      setOauthLoading(null)
      setError(
        `We couldn't start ${provider === 'google' ? 'Google' : 'GitHub'} sign-up. Try again, or use your email below.`
      )
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending || !sentTo) return
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setResendNote(NOT_CONFIGURED_MESSAGE)
      return
    }
    setResending(true)
    setResendNote(null)
    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email: sentTo,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
      },
    })
    setResending(false)
    if (resendError) {
      setResendNote("Couldn't resend just now — wait a minute and try again.")
    } else {
      setResendNote('Sent! Check your inbox (and the spam folder, just in case).')
      setCooldown(60)
    }
  }

  // ---- Post-signup: check-your-inbox panel -----------------------------------
  if (sentTo) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 6h16v12H4z" />
            <path d="m4 7 8 6 8-6" />
          </svg>
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
          Check your inbox
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          We sent a confirmation link to <span className="font-semibold text-slate-900">{sentTo}</span>.
          Click it and you’ll land in your dashboard, ready to add your first GC.
        </p>
        <ol className="mx-auto mt-5 max-w-xs space-y-2 text-left text-sm text-slate-600">
          <li className="flex gap-2"><span className="font-semibold text-blue-700">1.</span> Open the email from SubCompliance</li>
          <li className="flex gap-2"><span className="font-semibold text-blue-700">2.</span> Click the confirmation link</li>
          <li className="flex gap-2"><span className="font-semibold text-blue-700">3.</span> Add the first GC you work under</li>
        </ol>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || resending}
          className="mt-6 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending && <Spinner />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend the email'}
        </button>
        {resendNote && (
          <p aria-live="polite" className="mt-3 text-xs text-slate-500">{resendNote}</p>
        )}
        <p className="mt-6 text-xs text-slate-500">
          Wrong email?{' '}
          <button
            type="button"
            onClick={() => {
              setSentTo(null)
              setResendNote(null)
              setCooldown(0)
            }}
            className="font-semibold text-blue-700 hover:text-blue-800"
          >
            Start over
          </button>
        </p>
      </div>
    )
  }

  // ---- Signup form ------------------------------------------------------------
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
        Stay on every job. No lapses.
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Track COIs and compliance docs for every GC you work under.
      </p>

      <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
        <li className="flex gap-2"><CheckIcon /> Track up to 3 GC relationships free — no card needed</li>
        <li className="flex gap-2"><CheckIcon /> Reminders before anything lapses</li>
        <li className="flex gap-2"><CheckIcon /> Broker request drafts in one click</li>
      </ul>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}{' '}
          {error.includes('Sign in instead') && (
            <Link href="/login" className="font-semibold underline">Go to sign in</Link>
          )}
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3">
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
          <label htmlFor="fullName" className="block text-sm font-medium text-slate-700">
            Your name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Rivera"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

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
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            Password
          </label>
          <div className="relative mt-1.5">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
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
          <p className="mt-1.5 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner />}
          {submitting ? 'Creating your account…' : 'Create free account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already tracking with us?{' '}
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Sign in
        </Link>
      </p>
    </div>
  )
}
