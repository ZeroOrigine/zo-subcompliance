'use client'

// CANONICAL — SubCompliance dashboard: one glance answers "am I safe to stay on
// the job?", and every at-risk document carries a one-click broker email draft.
// Profile comes from ProfileProvider (fetched once in the layout — lint #75);
// Toast and BrokerDraftModal are the shared single definitions.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ApiError,
  apiFetch,
  type AttentionItem,
  type BrokerRequestItem,
  type ComplianceSummary,
} from '@/lib/core/api-client'
import {
  DOCUMENT_STATUS_META,
  cx,
  expirationPhrase,
  firstNameOf,
  formatDate,
  greeting,
} from '@/lib/core/format'
import { BTN_PRIMARY, BTN_SECONDARY, Toast, type ToastState } from '@/components/dashboard/ui'
import BrokerDraftModal from '@/components/dashboard/broker-draft-modal'
import { useProfile } from '@/lib/core/profile-context'

function StatCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number
  hint: string
  tone?: 'amber' | 'sky' | 'default'
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p
        className={cx(
          'mt-1 font-display text-3xl font-bold',
          tone === 'amber' ? 'text-amber-600' : tone === 'sky' ? 'text-sky-600' : 'text-slate-900'
        )}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your compliance picture">
      <div className="space-y-2">
        <div className="sc-skeleton h-4 w-32" />
        <div className="sc-skeleton h-9 w-72 max-w-full" />
      </div>
      <div className="sc-skeleton h-32 w-full" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
        <div className="sc-skeleton h-28 w-full" />
      </div>
      <div className="sc-skeleton h-72 w-full" />
    </div>
  )
}

function FirstRunPanel() {
  const steps = [
    { number: '1', title: 'Add a GC you work under', copy: 'Just the company name gets you started.' },
    { number: '2', title: 'List what they require', copy: 'GL certificate, workers’ comp, W-9 — a tap each.' },
    { number: '3', title: 'We watch every date', copy: 'Warnings fire before anything lapses, with the broker email already written.' },
  ]
  return (
    <section className="sc-rise overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="bg-slate-900 p-6 sm:p-8">
        <h2 className="text-xl text-white sm:text-2xl">Let&apos;s make sure you never get pulled off a job.</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-300">
          Most contractors set up their first GC in about a minute. Here&apos;s the whole system:
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-3 sm:p-8">
        {steps.map((step) => (
          <div key={step.number} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 font-display text-sm font-bold text-slate-900">
              {step.number}
            </span>
            <h3 className="mt-3 text-sm font-bold text-slate-900">{step.title}</h3>
            <p className="mt-1 text-sm text-slate-500">{step.copy}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col items-start gap-3 px-6 pb-6 sm:flex-row sm:items-center sm:px-8 sm:pb-8">
        <Link href="/gcs" className={BTN_PRIMARY}>
          Add your first GC
        </Link>
        <p className="text-xs text-slate-400">Free plan tracks up to 3 GCs. No card needed.</p>
      </div>
    </section>
  )
}

function ExamplePreview() {
  return (
    <section aria-hidden="true">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">What this page becomes</p>
      <div className="mt-2 space-y-2 opacity-70">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                General Liability COI
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400">Example</span>
              </p>
              <p className="text-xs text-slate-500">Meridian Builders · Expires in 12 days</p>
            </div>
          </div>
          <span className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
            Draft broker email
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Workers&apos; Compensation COI
                <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-400">Example</span>
              </p>
              <p className="text-xs text-slate-500">Meridian Builders · Expires in 214 days</p>
            </div>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Current</span>
        </div>
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const { profile, profileLoading } = useProfile()
  const [summary, setSummary] = useState<ComplianceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [draft, setDraft] = useState<BrokerRequestItem | null>(null)
  const [draftingId, setDraftingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const summaryData = await apiFetch<ComplianceSummary>('/api/compliance/summary')
      setSummary(summaryData)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : 'Something hiccuped loading your dashboard. Refresh to try again.'
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function draftBrokerRequest(item: AttentionItem) {
    if (!item.gc) return
    setDraftingId(item.id)
    try {
      const request = await apiFetch<BrokerRequestItem>('/api/broker-requests', {
        method: 'POST',
        body: JSON.stringify({ gc_relationship_id: item.gc.id, document_id: item.id }),
      })
      setDraft(request)
    } catch (error) {
      setToast({
        tone: 'error',
        message:
          error instanceof ApiError ? error.message : "We couldn't write that draft. Try again in a moment.",
      })
    } finally {
      setDraftingId(null)
    }
  }

  if (loading || profileLoading) return <DashboardSkeleton />

  if (loadError || !summary) {
    return (
      <div className="sc-rise mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl text-slate-900">We couldn&apos;t load your dashboard</h2>
        <p className="mt-2 text-sm text-slate-500">{loadError ?? 'Give it another try in a moment.'}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            setLoadError(null)
            void load()
          }}
          className={cx(BTN_PRIMARY, 'mt-6')}
        >
          Try again
        </button>
      </div>
    )
  }

  const isFirstRun = summary.gcs.total === 0
  const noDocumentsYet = !isFirstRun && summary.documents.total === 0
  const urgentItems = summary.attention_items.filter((item) => item.status !== 'pending_renewal')
  const inMotionItems = summary.attention_items.filter((item) => item.status === 'pending_renewal')
  const urgentTotal = summary.documents.expired + summary.documents.expiring_soon + summary.documents.missing
  const hasExpired = summary.documents.expired > 0

  return (
    <div className="space-y-8">
      <header className="sc-rise">
        <p className="text-sm font-medium text-slate-500">{formatDate(summary.generated_on)}</p>
        <h1 className="mt-1 text-2xl text-slate-900 sm:text-3xl">
          {greeting()}, {firstNameOf(profile?.full_name, profile?.email)}.
        </h1>
      </header>

      {isFirstRun ? (
        <>
          <FirstRunPanel />
          <ExamplePreview />
        </>
      ) : (
        <>
          {noDocumentsYet ? (
            <section className="sc-rise rounded-2xl border border-amber-200 bg-amber-50 p-6 sm:p-8">
              <h2 className="text-xl text-amber-900">Your GCs are in — now list what they require.</h2>
              <p className="mt-1 text-sm text-amber-800">
                Open a GC and add the documents they ask for. We&apos;ll take it from there.
              </p>
              <Link href="/gcs" className={cx(BTN_PRIMARY, 'mt-4')}>
                Open your GC list
              </Link>
            </section>
          ) : summary.all_clear ? (
            <section className="sc-rise rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-500 p-6 text-white shadow-sm sm:p-8">
              <div className="flex items-start gap-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </span>
                <div>
                  <h2 className="text-xl sm:text-2xl">You&apos;re clear to work.</h2>
                  <p className="mt-1 text-sm text-emerald-50">
                    {summary.documents.total === 1
                      ? 'Your 1 tracked document is'
                      : `All ${summary.documents.total} tracked documents are`}{' '}
                    current across {summary.gcs.active} active GC{summary.gcs.active === 1 ? '' : 's'}.{' '}
                    {summary.reminders.scheduled_next_30_days > 0
                      ? `${summary.reminders.scheduled_next_30_days} reminder${
                          summary.reminders.scheduled_next_30_days === 1 ? ' stands' : 's stand'
                        } watch over the next 30 days.`
                      : "We'll flag anything the moment it gets close."}
                    {summary.renewals_in_progress > 0 &&
                      ` ${summary.renewals_in_progress} renewal${
                        summary.renewals_in_progress === 1 ? ' is' : 's are'
                      } in motion.`}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section
              className={cx(
                'sc-rise rounded-2xl border p-6 sm:p-8',
                hasExpired ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
              )}
            >
              <h2 className={cx('text-xl sm:text-2xl', hasExpired ? 'text-red-900' : 'text-amber-900')}>
                {urgentTotal} document{urgentTotal === 1 ? ' needs' : 's need'} your attention.
              </h2>
              <p className={cx('mt-1 text-sm', hasExpired ? 'text-red-800' : 'text-amber-800')}>
                Handle these before a GC pulls you off the job — each one comes with a ready-to-send broker email.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {summary.documents.expired > 0 && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                    {summary.documents.expired} expired
                  </span>
                )}
                {summary.documents.expiring_soon > 0 && (
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    {summary.documents.expiring_soon} expiring soon
                  </span>
                )}
                {summary.documents.missing > 0 && (
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                    {summary.documents.missing} missing
                  </span>
                )}
              </div>
            </section>
          )}

          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Active GCs"
              value={summary.gcs.active}
              hint={summary.gcs.paused > 0 ? `${summary.gcs.paused} paused` : 'relationships tracked'}
            />
            <StatCard label="Documents tracked" value={summary.documents.total} hint={`${summary.documents.valid} current`} />
            <StatCard
              label="Expiring soon"
              value={summary.documents.expiring_soon}
              hint="within the next 30 days"
              tone={summary.documents.expiring_soon > 0 ? 'amber' : 'default'}
            />
            <StatCard
              label="Renewals in motion"
              value={summary.renewals_in_progress}
              hint="broker requests sent"
              tone={summary.renewals_in_progress > 0 ? 'sky' : 'default'}
            />
          </section>

          {urgentItems.length > 0 && (
            <section className="sc-rise">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg text-slate-900">Needs your attention</h2>
                <span className="text-sm text-slate-500">
                  {urgentTotal} item{urgentTotal === 1 ? '' : 's'}
                </span>
              </div>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {urgentItems.map((item) => {
                  const meta = DOCUMENT_STATUS_META[item.status]
                  return (
                    <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div className="flex items-start gap-3">
                        <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
                        <div>
                          <p className="font-semibold text-slate-900">{item.document_label}</p>
                          <p className="text-sm text-slate-500">
                            {item.gc?.gc_name ?? 'Unknown GC'} · {expirationPhrase(item.status, item.expiration_date)}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 pl-5 sm:pl-0">
                        <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', meta.badge)}>{meta.label}</span>
                        {(item.status === 'expired' || item.status === 'expiring_soon') && item.gc && (
                          <button
                            type="button"
                            onClick={() => void draftBrokerRequest(item)}
                            disabled={draftingId === item.id}
                            className={BTN_PRIMARY}
                          >
                            {draftingId === item.id ? 'Writing…' : 'Draft broker email'}
                          </button>
                        )}
                        {item.status === 'missing' && item.gc && (
                          <Link href={`/gcs/${item.gc.id}`} className={BTN_SECONDARY}>
                            Add details
                          </Link>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
              {urgentTotal > urgentItems.length && (
                <p className="mt-2 text-xs text-slate-400">
                  Showing the {urgentItems.length} most urgent. The rest live on each GC&apos;s page.
                </p>
              )}
            </section>
          )}

          {inMotionItems.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg text-slate-900">Renewals in motion</h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {inMotionItems.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-slate-900">{item.document_label}</p>
                        <p className="text-sm text-slate-500">
                          {item.gc?.gc_name ?? 'Unknown GC'} · {expirationPhrase(item.status, item.expiration_date)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">
                      Renewal in motion
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                When the new certificate lands, update the document&apos;s expiration date and it flips back to current automatically.
              </p>
            </section>
          )}
        </>
      )}

      {draft && (
        <BrokerDraftModal
          request={draft}
          brokerEmailMissing={!profile?.broker_email}
          onClose={() => setDraft(null)}
          onSent={() => {
            setDraft(null)
            setToast({ tone: 'success', message: 'Renewal in motion — that document is now marked pending renewal.' })
            void load()
          }}
        />
      )}
      {toast && <Toast toast={toast} />}
    </div>
  )
}
