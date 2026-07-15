'use client'

// CANONICAL — The ONE BrokerDraftModal (deterministic lint #75: previously defined
// twice, in the dashboard and GC detail pages). Shows the generated broker email,
// lets the contractor copy it, open it in their mail app, or mark it sent (which
// flags the linked document pending_renewal via the API).

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ApiError, apiFetch, type BrokerRequestItem } from '@/lib/core/api-client'
import { cx } from '@/lib/core/format'
import { BTN_PRIMARY, BTN_SECONDARY, FOCUS_RING } from '@/components/dashboard/ui'

export interface BrokerDraftModalProps {
  request: BrokerRequestItem
  brokerEmailMissing: boolean
  onClose: () => void
  onSent: () => void
}

export default function BrokerDraftModal({
  request,
  brokerEmailMissing,
  onClose,
  onSent,
}: BrokerDraftModalProps) {
  const [copied, setCopied] = useState(false)
  const [marking, setMarking] = useState(false)
  const [mailOpened, setMailOpened] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function copyDraft() {
    try {
      await navigator.clipboard.writeText(`Subject: ${request.subject}\n\n${request.body}`)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setActionError("Copying didn't work here — select the text and copy it by hand.")
    }
  }

  async function markSent() {
    setMarking(true)
    setActionError(null)
    try {
      await apiFetch<BrokerRequestItem>(`/api/broker-requests/${request.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'sent' }),
      })
      onSent()
    } catch (error) {
      setActionError(
        error instanceof ApiError ? error.message : "We couldn't mark that as sent. Try again in a moment."
      )
      setMarking(false)
    }
  }

  const mailtoHref = `mailto:${request.recipient_email ?? ''}?subject=${encodeURIComponent(
    request.subject
  )}&body=${encodeURIComponent(request.body)}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Broker request draft"
    >
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden="true" />
      <div className="sc-pop relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div>
            <h2 className="text-lg text-slate-900">Your broker email is written</h2>
            <p className="mt-1 text-sm text-slate-500">
              Built from your real policy details for {request.gc_relationship?.gc_name ?? 'this GC'}. Read it once, send it, done.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close draft"
            className={cx('rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600', FOCUS_RING)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
            <p className="text-slate-500">
              To:{' '}
              <span className="font-semibold text-slate-800">
                {request.recipient_name ?? 'Your broker'}
                {request.recipient_email ? ` <${request.recipient_email}>` : ''}
              </span>
            </p>
            <p className="mt-2 text-slate-500">
              Subject: <span className="font-semibold text-slate-800">{request.subject}</span>
            </p>
          </div>

          <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">
            {request.body}
          </div>

          {brokerEmailMissing && (
            <p className="rounded-lg bg-sky-50 px-4 py-3 text-sm text-sky-800">
              Tip: save your broker&apos;s email in{' '}
              <Link href="/settings" className="font-semibold underline">
                Settings
              </Link>{' '}
              and every draft arrives pre-addressed.
            </p>
          )}

          {actionError && <p className="text-sm font-medium text-red-600">{actionError}</p>}
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-end sm:p-6">
          <button type="button" onClick={() => void copyDraft()} className={BTN_SECONDARY}>
            {copied ? 'Copied ✓' : 'Copy email'}
          </button>
          <button
            type="button"
            onClick={() => void markSent()}
            disabled={marking}
            className={cx(BTN_SECONDARY, mailOpened && 'border-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100')}
          >
            {marking ? 'Tracking…' : mailOpened ? 'Sent it? Track the renewal' : 'Mark as sent'}
          </button>
          <a href={mailtoHref} onClick={() => setMailOpened(true)} className={BTN_PRIMARY}>
            Open in email app
          </a>
        </div>
      </div>
    </div>
  )
}
