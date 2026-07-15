'use client'

// CANONICAL — GC list: every general contractor you work under with a live
// compliance rollup, plus a one-minute add flow that lands you straight on the
// new GC's requirements page.

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ApiError,
  apiFetch,
  type FieldErrors,
  type GcListItem,
  type Paginated,
} from '@/lib/core/api-client'
import { cx, formatDate } from '@/lib/core/format'
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FOCUS_RING,
  INPUT,
  LABEL,
} from '@/components/dashboard/ui'

interface GcFormState {
  gc_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  notes: string
}

const EMPTY_FORM: GcFormState = {
  gc_name: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  notes: '',
}

function complianceBadge(gc: GcListItem): { label: string; className: string } {
  const counts = gc.compliance.status_counts
  if (counts.expired > 0) return { label: `${counts.expired} expired`, className: 'bg-red-100 text-red-700' }
  if (counts.expiring_soon > 0)
    return { label: `${counts.expiring_soon} expiring soon`, className: 'bg-amber-100 text-amber-800' }
  if (counts.missing > 0) return { label: `${counts.missing} missing`, className: 'bg-slate-200 text-slate-700' }
  if (counts.pending_renewal > 0) return { label: 'Renewal in motion', className: 'bg-sky-100 text-sky-800' }
  if (gc.compliance.total_documents > 0) return { label: 'All current', className: 'bg-emerald-100 text-emerald-800' }
  return { label: 'Nothing tracked yet', className: 'bg-slate-100 text-slate-500' }
}

function GcCard({ gc }: { gc: GcListItem }) {
  const badge = complianceBadge(gc)
  const contactLine =
    [gc.contact_name, gc.contact_email].filter(Boolean).join(' · ') || 'No contact saved'
  return (
    <li>
      <Link
        href={`/gcs/${gc.id}`}
        className={cx(
          'block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-amber-400 hover:shadow-md',
          FOCUS_RING,
          gc.status === 'archived' && 'opacity-70'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">{gc.gc_name}</h3>
          <span className={cx('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', badge.className)}>
            {badge.label}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-500">{contactLine}</p>
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-500">
          <span>
            {gc.compliance.total_documents} document{gc.compliance.total_documents === 1 ? '' : 's'}
          </span>
          <span>
            {gc.compliance.next_expiration
              ? `Next: ${formatDate(gc.compliance.next_expiration)}`
              : 'No dates tracked'}
          </span>
        </div>
      </Link>
    </li>
  )
}

export default function GcsPage() {
  const router = useRouter()
  const [gcs, setGcs] = useState<GcListItem[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<GcFormState>(EMPTY_FORM)
  const [moreOpen, setMoreOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [planMessage, setPlanMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<Paginated<GcListItem>>('/api/gcs?limit=100')
      setGcs(data.items)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "We couldn't load your GCs. Refresh to try again."
      )
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const loading = gcs === null && !loadError
  const isEmpty = gcs !== null && gcs.length === 0
  const current = (gcs ?? []).filter((gc) => gc.status !== 'archived')
  const archived = (gcs ?? []).filter((gc) => gc.status === 'archived')

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.gc_name.trim()) {
      setFieldErrors({ gc_name: ["Tell us the general contractor's name — that's all we need."] })
      return
    }
    setSubmitting(true)
    setFieldErrors({})
    setPlanMessage(null)
    try {
      const created = await apiFetch<{ id: string }>('/api/gcs', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      router.push(`/gcs/${created.id}`)
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'PLAN_LIMIT_REACHED') setPlanMessage(error.message)
        else if (error.details) setFieldErrors(error.details)
        else setFieldErrors({ _form: [error.message] })
      } else {
        setFieldErrors({ _form: ['Something hiccuped. Try again in a moment.'] })
      }
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your GCs">
        <div className="sc-skeleton h-9 w-72 max-w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="sc-skeleton h-36 w-full" />
          <div className="sc-skeleton h-36 w-full" />
          <div className="sc-skeleton h-36 w-full" />
          <div className="sc-skeleton h-36 w-full" />
        </div>
      </div>
    )
  }

  if (loadError && gcs === null) {
    return (
      <div className="sc-rise mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl text-slate-900">We couldn&apos;t load your GCs</h2>
        <p className="mt-2 text-sm text-slate-500">{loadError}</p>
        <button
          type="button"
          onClick={() => {
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

  return (
    <div className="space-y-6">
      <header className="sc-rise flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl text-slate-900 sm:text-3xl">General Contractors</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isEmpty
              ? 'Every GC keeps a list on you. Time to keep one on them.'
              : `${current.length} relationship${current.length === 1 ? '' : 's'} tracked`}
          </p>
        </div>
        {!isEmpty && !formOpen && (
          <button type="button" onClick={() => setFormOpen(true)} className={BTN_PRIMARY}>
            + Add GC
          </button>
        )}
      </header>

      {isEmpty && (
        <section className="sc-rise rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
          <h2 className="text-xl sm:text-2xl">Track your first GC</h2>
          <p className="mt-2 max-w-xl text-sm text-slate-300">
            Every GC you work under has a document list that can pull you off the job. Add the GC below —
            we&apos;ll keep that list green for you.
          </p>
        </section>
      )}

      {(formOpen || isEmpty) && (
        <section className="sc-pop rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">{isEmpty ? 'Who do you work under?' : 'Add a general contractor'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            The company name is enough to start — contact details help route paperwork later.
          </p>

          {planMessage && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">{planMessage}</p>
              <Link href="/billing" className={cx(BTN_PRIMARY, 'mt-3')}>
                See Pro — $9/mo
              </Link>
            </div>
          )}

          <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-4" noValidate>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="gc_name" className={LABEL}>
                  GC company name
                </label>
                <input
                  id="gc_name"
                  value={form.gc_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, gc_name: event.target.value }))}
                  className={INPUT}
                  placeholder="Meridian Builders"
                  required
                />
                {fieldErrors.gc_name && <p className={ERROR_TEXT}>{fieldErrors.gc_name[0]}</p>}
              </div>
              <div>
                <label htmlFor="contact_email" className={LABEL}>
                  Compliance contact email <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <input
                  id="contact_email"
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                  className={INPUT}
                  placeholder="compliance@meridian.com"
                />
                {fieldErrors.contact_email && <p className={ERROR_TEXT}>{fieldErrors.contact_email[0]}</p>}
              </div>
            </div>

            {moreOpen ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact_name" className={LABEL}>
                    Contact name
                  </label>
                  <input
                    id="contact_name"
                    value={form.contact_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))}
                    className={INPUT}
                    placeholder="Dana in the office"
                  />
                  {fieldErrors.contact_name && <p className={ERROR_TEXT}>{fieldErrors.contact_name[0]}</p>}
                </div>
                <div>
                  <label htmlFor="contact_phone" className={LABEL}>
                    Contact phone
                  </label>
                  <input
                    id="contact_phone"
                    value={form.contact_phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact_phone: event.target.value }))}
                    className={INPUT}
                    placeholder="(555) 210-4478"
                  />
                  {fieldErrors.contact_phone && <p className={ERROR_TEXT}>{fieldErrors.contact_phone[0]}</p>}
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="notes" className={LABEL}>
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    rows={2}
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className={INPUT}
                    placeholder="Requires additional insured endorsement on every job"
                  />
                  {fieldErrors.notes && <p className={ERROR_TEXT}>{fieldErrors.notes[0]}</p>}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                className={cx('rounded text-sm font-semibold text-amber-700 transition-colors hover:text-amber-800', FOCUS_RING)}
              >
                + Add contact name, phone, or notes
              </button>
            )}

            {fieldErrors._form && <p className={ERROR_TEXT}>{fieldErrors._form[0]}</p>}

            <div className="flex items-center gap-3">
              <button type="submit" disabled={submitting} className={BTN_PRIMARY}>
                {submitting ? 'Adding…' : 'Add GC'}
              </button>
              {!isEmpty && (
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false)
                    setForm(EMPTY_FORM)
                    setFieldErrors({})
                    setPlanMessage(null)
                  }}
                  className={BTN_SECONDARY}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
          {isEmpty && <p className="mt-4 text-xs text-slate-400">Free plan tracks up to 3 GCs. Pro is unlimited.</p>}
        </section>
      )}

      {current.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {current.map((gc) => (
            <GcCard key={gc.id} gc={gc} />
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-400">Archived</h2>
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {archived.map((gc) => (
              <GcCard key={gc.id} gc={gc} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
