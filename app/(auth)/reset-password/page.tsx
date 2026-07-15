// CANONICAL: /reset-password — final step of the recovery flow. The email link is
// exchanged for a session by /auth/callback (or /auth/confirm), which redirects here
// so the user can set a new password via supabase.auth.updateUser().
// Spinner/EyeIcon imported from shared icons (lint #75).
'use client'

import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { EyeIcon, Spinner } from '@/components/auth/icons'

// QA-028: keep in lockstep with login/signup/forgot-password so every auth page
// fails soft the same way when Supabase env vars are missing.
const NOT_CONFIGURED_MESSAGE =
  "SubCompliance isn't connected to its account service yet, so we can't do that right now. If you're the site owner, add the Supabase environment variables and redeploy."

// createClient() throws when NEXT_PUBLIC_SUPABASE_* env vars are missing — return
// null instead so handlers/effects show the friendly message rather than crash.
function getSupabaseOrNull(): ReturnType<typeof createClient> | null {
  try {
    return createClient()
  } catch {
    return null
  }
}

function friendlyResetError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('different'))
    return 'Your new password needs to be different from the old one.'
  if (m.includes('session') || m.includes('expired'))
    return 'This reset link expired or was already used. Request a fresh one below.'
  if (m.includes('password'))
    return 'That password is too weak — use at least 8 characters.'
  return "We couldn't update your password just now. Try again in a moment."
}

export default function ResetPasswordPage() {
  const router = useRouter()

  const [sessionState, setSessionState] = useState<'checking' | 'ok' | 'missing'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // The recovery link must have produced a session — verify before showing the form.
  useEffect(() => {
    let cancelled = false
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setSessionState('missing')
      return
    }
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setSessionState(data.user ? 'ok' : 'missing')
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!done) return
    const t = setTimeout(() => {
      router.push('/dashboard')
      router.refresh()
    }, 1600)
    return () => clearTimeout(t)
  }, [done, router])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    if (password.length < 8) {
      setError('Make your password at least 8 characters.')
      return
    }
    if (password !== confirm) {
      setError("Those two passwords don't match. Give them another look.")
      return
    }

    setSubmitting(true)
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setSubmitting(false)
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (updateError) {
      const friendly = friendlyResetError(updateError.message)
      setError(friendly)
      if (friendly.includes('expired')) setSessionState('missing')
      return
    }
    setDone(true)
  }

  if (sessionState === 'checking') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
        <div className="h-7 w-52 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded bg-slate-100" />
        <div className="mt-6 space-y-4">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-200" />
        </div>
      </div>
    )
  }

  if (sessionState === 'missing') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
          That link has expired
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Reset links only work once and don’t last long. No worries — grab a fresh one.
        </p>
        <Link
          href="/forgot-password"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800"
        >
          Request a new reset link
        </Link>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/60">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-7 w-7 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
          Password updated
        </h1>
        <p className="mt-2 text-sm text-slate-600" aria-live="polite">
          You’re all set — taking you to your dashboard…
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
        Set a new password
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Pick something strong — this guards your GC and policy records.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700">
            New password
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
        </div>

        <div>
          <label htmlFor="confirm" className="block text-sm font-medium text-slate-700">
            Confirm new password
          </label>
          <input
            id="confirm"
            name="confirm"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Type it again"
            className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner />}
          {submitting ? 'Updating…' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
