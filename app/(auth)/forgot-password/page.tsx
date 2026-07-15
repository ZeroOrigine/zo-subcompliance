// CANONICAL: /forgot-password — sends a Supabase password-reset email that lands the
// user on /reset-password via /auth/callback. Spinner imported from shared icons.
'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Spinner } from '@/components/auth/icons'

// QA-020: keep this in lockstep with app/(auth)/login and signup so every auth page
// fails soft the same way when Supabase env vars are missing.
const NOT_CONFIGURED_MESSAGE =
  "SubCompliance isn't connected to its account service yet, so we can't do that right now. If you're the site owner, add the Supabase environment variables and redeploy."

// createClient() throws when NEXT_PUBLIC_SUPABASE_* env vars are missing — return
// null instead so handlers show the friendly message rather than crash (QA-020).
function getSupabaseOrNull(): ReturnType<typeof createClient> | null {
  try {
    return createClient()
  } catch {
    return null
  }
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setError(null)

    const trimmed = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setError("That email doesn't look quite right. Mind checking it?")
      return
    }

    setSubmitting(true)
    const supabase = getSupabaseOrNull()
    if (!supabase) {
      setSubmitting(false)
      setError(NOT_CONFIGURED_MESSAGE)
      return
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setSubmitting(false)

    if (resetError) {
      const m = resetError.message.toLowerCase()
      if (m.includes('rate') || m.includes('too many')) {
        setError('Too many reset requests in a row. Give it a minute and try again.')
      } else {
        setError("We couldn't send the reset email just now. Try again in a moment.")
      }
      return
    }
    setSentTo(trimmed)
  }

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
          Reset link on its way
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          If an account exists for <span className="font-semibold text-slate-900">{sentTo}</span>,
          you’ll get an email with a reset link in the next minute or two.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Nothing arriving? Check your spam folder, then try again.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/60">
      <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">
        Reset your password
      </h1>
      <p className="mt-1.5 text-sm text-slate-600">
        Enter the email on your account and we’ll send you a reset link.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

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
        <button
          type="submit"
          disabled={submitting}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting && <Spinner />}
          {submitting ? 'Sending the link…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-blue-700 hover:text-blue-800">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}
