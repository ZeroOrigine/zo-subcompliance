'use client'

// CANONICAL — GC detail: the documents this GC requires, their expiration dates,
// smart quick-adds, and one-click broker email drafts for anything at risk.
// Uses the shared Toast/BrokerDraftModal (lint #75) and the ProfileProvider profile.

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import type { SubcomplianceDocumentStatus, SubcomplianceGcStatus } from '@/lib/db/types'
import {
  ApiError,
  apiFetch,
  type BrokerRequestItem,
  type DocumentItem,
  type DocumentTypeItem,
  type FieldErrors,
  type GcDetail,
} from '@/lib/core/api-client'
import {
  DOCUMENT_STATUS_META,
  GC_STATUS_META,
  addMonthsIso,
  cx,
  expirationPhrase,
  formatCoverage,
  joinDays,
  todayIso,
} from '@/lib/core/format'
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  ERROR_TEXT,
  FOCUS_RING,
  INPUT,
  LABEL,
  Toast,
  type ToastState,
} from '@/components/dashboard/ui'
import BrokerDraftModal from '@/components/dashboard/broker-draft-modal'
import { useProfile } from '@/lib/core/profile-context'
import { createClient } from '@/lib/supabase/client'

const SUGGESTED_TYPE_CODES = ['coi_general_liability', 'coi_workers_comp', 'w9']
const DOCUMENTS_BUCKET = 'documents'
const MAX_FILE_BYTES = 10 * 1024 * 1024

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const panel = panelRef.current
    const firstFocusable = panel?.querySelector<HTMLElement>(selector)
    if (firstFocusable) firstFocusable.focus()
    else panel?.focus()

    function trapTab(event: KeyboardEvent) {
      if (event.key !== 'Tab') return
      const container = panelRef.current
      if (!container) return
      const focusables = Array.from(container.querySelectorAll<HTMLElement>(selector))
      if (focusables.length === 0) {
        event.preventDefault()
        container.focus()
        return
      }
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey) {
        if (active === first || !container.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (active === last || !container.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', trapTab, true)
    return () => {
      document.removeEventListener('keydown', trapTab, true)
      previouslyFocused?.focus()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/60" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} className="sc-pop relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg text-slate-900">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={cx('rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600', FOCUS_RING)}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

interface DocFormState {
  document_type_id: string
  custom_type_label: string
  expiration_date: string
  carrier_name: string
  policy_number: string
  coverage_dollars: string
  notes: string
}

const EMPTY_DOC_FORM: DocFormState = {
  document_type_id: '',
  custom_type_label: '',
  expiration_date: '',
  carrier_name: '',
  policy_number: '',
  coverage_dollars: '',
  notes: '',
}

interface GcFormState {
  gc_name: string
  contact_name: string
  contact_email: string
  contact_phone: string
  status: SubcomplianceGcStatus
  notes: string
}

export default function GcDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { profile } = useProfile()

  const [gc, setGc] = useState<GcDetail | null>(null)
  const [docTypes, setDocTypes] = useState<DocumentTypeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)

  const [docFormOpen, setDocFormOpen] = useState(false)
  const [docForm, setDocForm] = useState<DocFormState>(EMPTY_DOC_FORM)
  const [editingDocId, setEditingDocId] = useState<string | null>(null)
  const [autoFilled, setAutoFilled] = useState(false)
  const [policyOpen, setPolicyOpen] = useState(false)
  const [docSubmitting, setDocSubmitting] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [docFile, setDocFile] = useState<File | null>(null)
  const [removeFile, setRemoveFile] = useState(false)

  const [gcFormOpen, setGcFormOpen] = useState(false)
  const [gcForm, setGcForm] = useState<GcFormState | null>(null)
  const [gcSubmitting, setGcSubmitting] = useState(false)
  const [gcFieldErrors, setGcFieldErrors] = useState<FieldErrors>({})

  const [confirmingDeleteGc, setConfirmingDeleteGc] = useState(false)
  const [deletingGc, setDeletingGc] = useState(false)
  const [confirmDocId, setConfirmDocId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  const [draft, setDraft] = useState<BrokerRequestItem | null>(null)
  const [draftingDocId, setDraftingDocId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [gcData, typesData] = await Promise.all([
        apiFetch<GcDetail>(`/api/gcs/${params.id}`),
        apiFetch<{ items: DocumentTypeItem[] }>('/api/document-types'),
      ])
      setGc(gcData)
      setDocTypes(typesData.items)
      setLoadError(null)
    } catch (error) {
      setLoadError(
        error instanceof ApiError ? error.message : "We couldn't load this GC. Refresh to try again."
      )
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function openDocCreate(typeId?: string) {
    const nextForm = { ...EMPTY_DOC_FORM }
    let filled = false
    if (typeId) {
      nextForm.document_type_id = typeId
      const selected = docTypes.find((type) => type.id === typeId)
      if (selected?.typical_validity_months) {
        nextForm.expiration_date = addMonthsIso(todayIso(), selected.typical_validity_months)
        filled = true
      }
    }
    setEditingDocId(null)
    setDocForm(nextForm)
    setDocFile(null)
    setRemoveFile(false)
    setAutoFilled(filled)
    setPolicyOpen(false)
    setFieldErrors({})
    setDocFormOpen(true)
  }

  function openDocEdit(doc: DocumentItem) {
    setEditingDocId(doc.id)
    setDocForm({
      document_type_id: doc.document_type_id,
      custom_type_label: doc.custom_type_label ?? '',
      expiration_date: doc.expiration_date ?? '',
      carrier_name: doc.carrier_name ?? '',
      policy_number: doc.policy_number ?? '',
      coverage_dollars: doc.coverage_amount_cents != null ? String(doc.coverage_amount_cents / 100) : '',
      notes: doc.notes ?? '',
    })
    setDocFile(null)
    setRemoveFile(false)
    setAutoFilled(false)
    setPolicyOpen(Boolean(doc.carrier_name || doc.policy_number || doc.coverage_amount_cents != null || doc.notes))
    setFieldErrors({})
    setDocFormOpen(true)
  }

  function closeDocForm() {
    setDocFormOpen(false)
    setFieldErrors({})
  }

  function handleTypeChange(nextTypeId: string) {
    const nextType = docTypes.find((type) => type.id === nextTypeId)
    setDocForm((prev) => {
      const next = { ...prev, document_type_id: nextTypeId }
      if (!editingDocId && nextType?.typical_validity_months && !prev.expiration_date) {
        next.expiration_date = addMonthsIso(todayIso(), nextType.typical_validity_months)
        setAutoFilled(true)
      }
      return next
    })
  }

  async function submitDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gc) return
    if (!docForm.document_type_id) {
      setFieldErrors({ document_type_id: ['Pick a document type — General Liability COI is the most common.'] })
      return
    }
    const selected = docTypes.find((type) => type.id === docForm.document_type_id)
    if (selected?.code === 'other' && !docForm.custom_type_label.trim()) {
      setFieldErrors({ custom_type_label: ['Give it a short label so you can recognize it later.'] })
      return
    }
    let coverageCents: number | null = null
    const rawCoverage = docForm.coverage_dollars.replace(/[$,\s]/g, '')
    if (rawCoverage) {
      const parsed = Number(rawCoverage)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setFieldErrors({ coverage_amount_cents: ['Enter a dollar amount, like 1000000.'] })
        return
      }
      coverageCents = Math.round(parsed * 100)
    }

    if (docFile && docFile.size > MAX_FILE_BYTES) {
      setFieldErrors({ file_url: ['Keep the file under 10 MB — a photo or PDF of the certificate is plenty.'] })
      return
    }

    setDocSubmitting(true)
    setFieldErrors({})
    const existing = editingDocId ? gc.documents.find((doc) => doc.id === editingDocId) : undefined

    let fileUrl = removeFile ? '' : existing?.file_url ?? ''
    if (docFile) {
      try {
        const supabase = createClient()
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError || !userData.user) throw userError ?? new Error('Not signed in')
        const extension = (docFile.name.split('.').pop() ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
        const objectPath = `${userData.user.id}/${gc.id}/${crypto.randomUUID()}${extension ? `.${extension}` : ''}`
        const { error: uploadError } = await supabase.storage
          .from(DOCUMENTS_BUCKET)
          .upload(objectPath, docFile, { contentType: docFile.type || undefined, upsert: false })
        if (uploadError) throw uploadError
        fileUrl = objectPath
      } catch {
        setFieldErrors({ file_url: ["The file didn't upload — check your connection and try again."] })
        setDocSubmitting(false)
        return
      }
    }

    const payload: Record<string, unknown> = {
      document_type_id: docForm.document_type_id,
      custom_type_label: docForm.custom_type_label,
      carrier_name: docForm.carrier_name,
      policy_number: docForm.policy_number,
      coverage_amount_cents: coverageCents,
      expiration_date: docForm.expiration_date,
      notes: docForm.notes,
      file_url: fileUrl,
    }

    try {
      if (editingDocId) {
        await apiFetch<DocumentItem>(`/api/documents/${editingDocId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        })
        setToast({
          tone: 'success',
          message: docForm.expiration_date ? 'Saved — reminders now match the new date.' : 'Saved.',
        })
      } else {
        const created = await apiFetch<DocumentItem>('/api/documents', {
          method: 'POST',
          body: JSON.stringify({ ...payload, gc_relationship_id: gc.id }),
        })
        const days = (created.scheduled_reminders ?? []).map((reminder) => reminder.days_before)
        setToast({
          tone: 'success',
          message:
            created.status === 'missing'
              ? "On the list — it'll show as missing until it's on file."
              : days.length > 0
                ? `Tracked. We'll warn you ${joinDays(days)} days before it lapses.`
                : 'Tracked — this one never expires. One less date to watch.',
        })
      }
      setDocFormOpen(false)
      await load()
    } catch (error) {
      if (error instanceof ApiError && error.details) setFieldErrors(error.details)
      else
        setFieldErrors({
          _form: [error instanceof ApiError ? error.message : 'Something hiccuped. Try again in a moment.'],
        })
    } finally {
      setDocSubmitting(false)
    }
  }

  async function deleteDocument(documentId: string) {
    setDeletingDocId(documentId)
    try {
      await apiFetch<{ id: string }>(`/api/documents/${documentId}`, { method: 'DELETE' })
      setConfirmDocId(null)
      setToast({ tone: 'success', message: 'Removed.' })
      await load()
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof ApiError ? error.message : "Couldn't remove that. Try again.",
      })
    } finally {
      setDeletingDocId(null)
    }
  }

  function openGcEdit() {
    if (!gc) return
    setGcForm({
      gc_name: gc.gc_name,
      contact_name: gc.contact_name ?? '',
      contact_email: gc.contact_email ?? '',
      contact_phone: gc.contact_phone ?? '',
      status: gc.status,
      notes: gc.notes ?? '',
    })
    setGcFieldErrors({})
    setGcFormOpen(true)
  }

  async function submitGcEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!gc || !gcForm) return
    if (!gcForm.gc_name.trim()) {
      setGcFieldErrors({ gc_name: ["The GC name can't be empty — that's how you find them in your list."] })
      return
    }
    setGcSubmitting(true)
    setGcFieldErrors({})
    try {
      await apiFetch<GcDetail>(`/api/gcs/${gc.id}`, { method: 'PATCH', body: JSON.stringify(gcForm) })
      setGcFormOpen(false)
      setToast({ tone: 'success', message: 'Saved.' })
      await load()
    } catch (error) {
      if (error instanceof ApiError && error.details) setGcFieldErrors(error.details)
      else
        setGcFieldErrors({
          _form: [error instanceof ApiError ? error.message : 'Something hiccuped. Try again in a moment.'],
        })
    } finally {
      setGcSubmitting(false)
    }
  }

  async function deleteGc() {
    if (!gc) return
    setDeletingGc(true)
    try {
      await apiFetch<{ id: string }>(`/api/gcs/${gc.id}`, { method: 'DELETE' })
      router.push('/gcs')
    } catch (error) {
      setToast({
        tone: 'error',
        message: error instanceof ApiError ? error.message : "Couldn't delete that GC. Try again.",
      })
      setDeletingGc(false)
      setConfirmingDeleteGc(false)
    }
  }

  async function viewFile(doc: DocumentItem) {
    if (!doc.file_url || doc.file_url === 'on-file') return
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(doc.file_url, 600)
      if (error || !data?.signedUrl) throw error ?? new Error('No URL')
      window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch {
      setToast({ tone: 'error', message: "Couldn't open that file. Try again in a moment." })
    }
  }

  async function draftForDocument(doc: DocumentItem) {
    if (!gc) return
    setDraftingDocId(doc.id)
    try {
      const request = await apiFetch<BrokerRequestItem>('/api/broker-requests', {
        method: 'POST',
        body: JSON.stringify({ gc_relationship_id: gc.id, document_id: doc.id }),
      })
      setDraft(request)
    } catch (error) {
      setToast({
        tone: 'error',
        message:
          error instanceof ApiError ? error.message : "We couldn't write that draft. Try again in a moment.",
      })
    } finally {
      setDraftingDocId(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading this GC">
        <div className="sc-skeleton h-5 w-24" />
        <div className="sc-skeleton h-10 w-80 max-w-full" />
        <div className="sc-skeleton h-8 w-64 max-w-full" />
        <div className="sc-skeleton h-96 w-full" />
      </div>
    )
  }

  if (loadError || !gc) {
    return (
      <div className="sc-rise mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl text-slate-900">We couldn&apos;t open that GC</h2>
        <p className="mt-2 text-sm text-slate-500">{loadError ?? 'It may have been removed.'}</p>
        <Link href="/gcs" className={cx(BTN_PRIMARY, 'mt-6')}>
          Back to your GC list
        </Link>
      </div>
    )
  }

  const docCounts = gc.documents.reduce(
    (accumulator, doc) => {
      accumulator[doc.status] += 1
      return accumulator
    },
    { valid: 0, expiring_soon: 0, expired: 0, missing: 0, pending_renewal: 0 } as Record<
      SubcomplianceDocumentStatus,
      number
    >
  )
  const contactLine = [gc.contact_name, gc.contact_email, gc.contact_phone].filter(Boolean).join(' · ')
  const selectedType = docTypes.find((type) => type.id === docForm.document_type_id)
  const editingDoc = editingDocId ? gc.documents.find((doc) => doc.id === editingDocId) : undefined
  const existingFileUrl = editingDoc?.file_url ?? null
  const suggestedTypes = SUGGESTED_TYPE_CODES.map((code) => docTypes.find((type) => type.code === code)).filter(
    (type): type is DocumentTypeItem => Boolean(type)
  )
  const gcStatusMeta = GC_STATUS_META[gc.status]

  return (
    <div className="space-y-6">
      <Link
        href="/gcs"
        className={cx('inline-flex items-center gap-1.5 rounded text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800', FOCUS_RING)}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        All GCs
      </Link>

      <header className="sc-rise flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl text-slate-900 sm:text-3xl">{gc.gc_name}</h1>
            {gc.status !== 'active' && (
              <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', gcStatusMeta.badge)}>
                {gcStatusMeta.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {contactLine || 'No contact saved — add one so paperwork has somewhere to go.'}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={openGcEdit} className={BTN_SECONDARY}>
            Edit GC
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDeleteGc(true)}
            className={cx(
              'inline-flex min-h-[44px] items-center justify-center rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 shadow-sm transition-all hover:bg-red-50',
              FOCUS_RING
            )}
          >
            Delete
          </button>
        </div>
      </header>

      {gc.documents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {docCounts.expired + docCounts.expiring_soon + docCounts.missing === 0 && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              All current ✓
            </span>
          )}
          {docCounts.expired > 0 && (
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              {docCounts.expired} expired
            </span>
          )}
          {docCounts.expiring_soon > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              {docCounts.expiring_soon} expiring soon
            </span>
          )}
          {docCounts.missing > 0 && (
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
              {docCounts.missing} missing
            </span>
          )}
          {docCounts.pending_renewal > 0 && (
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
              {docCounts.pending_renewal} renewal{docCounts.pending_renewal === 1 ? '' : 's'} in motion
            </span>
          )}
        </div>
      )}

      <section className="sc-rise">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg text-slate-900">Required documents</h2>
          {gc.documents.length > 0 && (
            <button type="button" onClick={() => openDocCreate()} className={BTN_PRIMARY}>
              + Add document
            </button>
          )}
        </div>

        {gc.documents.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white p-8 text-center">
            <h3 className="text-base font-bold text-slate-900">What does {gc.gc_name} require from you?</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Most GCs start with these. Add one in a tap — we pre-fill the typical expiration so you only
              confirm the date.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {suggestedTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => openDocCreate(type.id)}
                  className={cx(
                    'min-h-[44px] rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100',
                    FOCUS_RING
                  )}
                >
                  {type.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => openDocCreate()}
                className={cx(
                  'min-h-[44px] rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50',
                  FOCUS_RING
                )}
              >
                Something else
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {gc.documents.map((doc) => {
              const meta = DOCUMENT_STATUS_META[doc.status]
              const label = doc.custom_type_label ?? doc.document_type?.name ?? 'Document'
              const coverage = formatCoverage(doc.coverage_amount_cents)
              const detailLine = [expirationPhrase(doc.status, doc.expiration_date), doc.carrier_name, doc.policy_number ? `#${doc.policy_number}` : null]
                .filter(Boolean)
                .join(' · ')
              return (
                <li key={doc.id} className="flex flex-col gap-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className={cx('mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', meta.dot)} aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-slate-900">{label}</p>
                        <p className="text-sm text-slate-500">{detailLine}</p>
                        {coverage && <p className="mt-0.5 text-xs text-slate-400">Coverage {coverage}</p>}
                      </div>
                    </div>
                    <span className={cx('rounded-full px-2.5 py-1 text-xs font-semibold', meta.badge)}>{meta.label}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-[22px]">
                    {(doc.status === 'expired' || doc.status === 'expiring_soon') && (
                      <button
                        type="button"
                        onClick={() => void draftForDocument(doc)}
                        disabled={draftingDocId === doc.id}
                        className={BTN_PRIMARY}
                      >
                        {draftingDocId === doc.id ? 'Writing…' : 'Draft broker email'}
                      </button>
                    )}
                    {doc.status === 'missing' && (
                      <button type="button" onClick={() => openDocEdit(doc)} className={BTN_PRIMARY}>
                        Add dates &amp; details
                      </button>
                    )}
                    {doc.file_url && doc.file_url !== 'on-file' && (
                      <button type="button" onClick={() => void viewFile(doc)} className={BTN_SECONDARY}>
                        View file
                      </button>
                    )}
                    <button type="button" onClick={() => openDocEdit(doc)} className={BTN_SECONDARY}>
                      Edit
                    </button>
                    {confirmDocId === doc.id ? (
                      <span className="inline-flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-600">Remove it?</span>
                        <button
                          type="button"
                          onClick={() => void deleteDocument(doc.id)}
                          disabled={deletingDocId === doc.id}
                          className={cx('min-h-[44px] rounded px-2 py-2 font-semibold text-red-600 hover:text-red-700 disabled:opacity-60', FOCUS_RING)}
                        >
                          {deletingDocId === doc.id ? 'Removing…' : 'Yes, remove'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDocId(null)}
                          className={cx('min-h-[44px] rounded px-2 py-2 font-semibold text-slate-500 hover:text-slate-700', FOCUS_RING)}
                        >
                          Keep
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDocId(doc.id)}
                        className={cx('min-h-[44px] rounded px-2 py-1 text-sm font-semibold text-slate-400 transition-colors hover:text-red-600', FOCUS_RING)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {docFormOpen && (
        <ModalShell
          title={editingDocId ? 'Edit document' : `What does ${gc.gc_name} require?`}
          subtitle={
            editingDocId
              ? 'New certificate arrived? Update the expiration date and the status recalculates itself.'
              : "Don't have it yet? Add it anyway — we'll flag it as missing so it can't slip."
          }
          onClose={closeDocForm}
        >
          <form onSubmit={(event) => void submitDocument(event)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="document_type_id" className={LABEL}>
                Document type
              </label>
              <select
                id="document_type_id"
                value={docForm.document_type_id}
                onChange={(event) => handleTypeChange(event.target.value)}
                className={INPUT}
              >
                <option value="">Pick a document type…</option>
                {docTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
              {selectedType?.description && <p className="mt-1.5 text-xs text-slate-500">{selectedType.description}</p>}
              {fieldErrors.document_type_id && <p className={ERROR_TEXT}>{fieldErrors.document_type_id[0]}</p>}
            </div>

            {selectedType?.code === 'other' && (
              <div>
                <label htmlFor="custom_type_label" className={LABEL}>
                  What should we call it?
                </label>
                <input
                  id="custom_type_label"
                  value={docForm.custom_type_label}
                  onChange={(event) => setDocForm((prev) => ({ ...prev, custom_type_label: event.target.value }))}
                  className={INPUT}
                  placeholder="Site badge renewal"
                />
                {fieldErrors.custom_type_label && <p className={ERROR_TEXT}>{fieldErrors.custom_type_label[0]}</p>}
              </div>
            )}

            <div>
              <label htmlFor="expiration_date" className={LABEL}>
                Expiration date
              </label>
              <input
                id="expiration_date"
                type="date"
                value={docForm.expiration_date}
                onChange={(event) => {
                  setAutoFilled(false)
                  setDocForm((prev) => ({ ...prev, expiration_date: event.target.value }))
                }}
                className={INPUT}
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {autoFilled && selectedType?.typical_validity_months
                  ? `Pre-filled from the typical ${selectedType.typical_validity_months}-month term — adjust to match your policy.`
                  : selectedType && !selectedType.typical_validity_months
                    ? "This type usually doesn't expire — leave it blank."
                    : 'Leave blank if it never expires.'}
              </p>
              {fieldErrors.expiration_date && <p className={ERROR_TEXT}>{fieldErrors.expiration_date[0]}</p>}
            </div>

            <div>
              <label htmlFor="doc_file" className={LABEL}>
                Attach a copy (PDF or photo)
              </label>
              <input
                id="doc_file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(event) => {
                  setRemoveFile(false)
                  setDocFile(event.target.files?.[0] ?? null)
                }}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-amber-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-amber-800 hover:file:bg-amber-200"
              />
              {existingFileUrl && !docFile && (
                <p className="mt-1.5 text-xs text-slate-600">
                  {removeFile ? (
                    <>
                      The stored copy will be removed when you save.{' '}
                      <button
                        type="button"
                        onClick={() => setRemoveFile(false)}
                        className={cx('rounded font-semibold text-amber-700 hover:text-amber-800', FOCUS_RING)}
                      >
                        Keep it
                      </button>
                    </>
                  ) : (
                    <>
                      A copy is already on file — pick a new file to replace it, or{' '}
                      <button
                        type="button"
                        onClick={() => setRemoveFile(true)}
                        className={cx('rounded font-semibold text-red-600 hover:text-red-700', FOCUS_RING)}
                      >
                        remove it
                      </button>
                      .
                    </>
                  )}
                </p>
              )}
              <p className="mt-1.5 text-xs text-slate-500">
                {docForm.expiration_date || existingFileUrl || docFile
                  ? "Optional, up to 10 MB — it's on hand the moment a GC asks."
                  : "Optional, up to 10 MB. No date and no copy yet? We'll track it as missing until one is on file."}
              </p>
              {fieldErrors.file_url && <p className={ERROR_TEXT}>{fieldErrors.file_url[0]}</p>}
            </div>

            {policyOpen ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="carrier_name" className={LABEL}>
                    Carrier
                  </label>
                  <input
                    id="carrier_name"
                    value={docForm.carrier_name}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, carrier_name: event.target.value }))}
                    className={INPUT}
                    placeholder="Hartford"
                  />
                  {fieldErrors.carrier_name && <p className={ERROR_TEXT}>{fieldErrors.carrier_name[0]}</p>}
                </div>
                <div>
                  <label htmlFor="policy_number" className={LABEL}>
                    Policy number
                  </label>
                  <input
                    id="policy_number"
                    value={docForm.policy_number}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, policy_number: event.target.value }))}
                    className={INPUT}
                    placeholder="GL-2841-0092"
                  />
                  {fieldErrors.policy_number && <p className={ERROR_TEXT}>{fieldErrors.policy_number[0]}</p>}
                </div>
                <div>
                  <label htmlFor="coverage_dollars" className={LABEL}>
                    Coverage amount ($)
                  </label>
                  <input
                    id="coverage_dollars"
                    inputMode="numeric"
                    value={docForm.coverage_dollars}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, coverage_dollars: event.target.value }))}
                    className={INPUT}
                    placeholder="1,000,000"
                  />
                  {fieldErrors.coverage_amount_cents && <p className={ERROR_TEXT}>{fieldErrors.coverage_amount_cents[0]}</p>}
                </div>
                <div>
                  <label htmlFor="doc_notes" className={LABEL}>
                    Notes
                  </label>
                  <input
                    id="doc_notes"
                    value={docForm.notes}
                    onChange={(event) => setDocForm((prev) => ({ ...prev, notes: event.target.value }))}
                    className={INPUT}
                    placeholder="Names GC as additional insured"
                  />
                  {fieldErrors.notes && <p className={ERROR_TEXT}>{fieldErrors.notes[0]}</p>}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setPolicyOpen(true)}
                className={cx('rounded text-sm font-semibold text-amber-700 transition-colors hover:text-amber-800', FOCUS_RING)}
              >
                + Add carrier, policy number, or notes
              </button>
            )}

            {fieldErrors._form && <p className={ERROR_TEXT}>{fieldErrors._form[0]}</p>}

            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={closeDocForm} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button type="submit" disabled={docSubmitting} className={BTN_PRIMARY}>
                {docSubmitting ? 'Saving…' : editingDocId ? 'Save changes' : 'Track this document'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {gcFormOpen && gcForm && (
        <ModalShell title={`Edit ${gc.gc_name}`} onClose={() => setGcFormOpen(false)}>
          <form onSubmit={(event) => void submitGcEdit(event)} className="space-y-4" noValidate>
            <div>
              <label htmlFor="edit_gc_name" className={LABEL}>
                GC company name
              </label>
              <input
                id="edit_gc_name"
                value={gcForm.gc_name}
                onChange={(event) => setGcForm((prev) => (prev ? { ...prev, gc_name: event.target.value } : prev))}
                className={INPUT}
              />
              {gcFieldErrors.gc_name && <p className={ERROR_TEXT}>{gcFieldErrors.gc_name[0]}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit_contact_name" className={LABEL}>
                  Contact name
                </label>
                <input
                  id="edit_contact_name"
                  value={gcForm.contact_name}
                  onChange={(event) => setGcForm((prev) => (prev ? { ...prev, contact_name: event.target.value } : prev))}
                  className={INPUT}
                />
                {gcFieldErrors.contact_name && <p className={ERROR_TEXT}>{gcFieldErrors.contact_name[0]}</p>}
              </div>
              <div>
                <label htmlFor="edit_contact_email" className={LABEL}>
                  Contact email
                </label>
                <input
                  id="edit_contact_email"
                  type="email"
                  value={gcForm.contact_email}
                  onChange={(event) => setGcForm((prev) => (prev ? { ...prev, contact_email: event.target.value } : prev))}
                  className={INPUT}
                />
                {gcFieldErrors.contact_email && <p className={ERROR_TEXT}>{gcFieldErrors.contact_email[0]}</p>}
              </div>
              <div>
                <label htmlFor="edit_contact_phone" className={LABEL}>
                  Contact phone
                </label>
                <input
                  id="edit_contact_phone"
                  value={gcForm.contact_phone}
                  onChange={(event) => setGcForm((prev) => (prev ? { ...prev, contact_phone: event.target.value } : prev))}
                  className={INPUT}
                />
                {gcFieldErrors.contact_phone && <p className={ERROR_TEXT}>{gcFieldErrors.contact_phone[0]}</p>}
              </div>
              <div>
                <label htmlFor="edit_status" className={LABEL}>
                  Status
                </label>
                <select
                  id="edit_status"
                  value={gcForm.status}
                  onChange={(event) =>
                    setGcForm((prev) => (prev ? { ...prev, status: event.target.value as SubcomplianceGcStatus } : prev))
                  }
                  className={INPUT}
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
                <p className="mt-1.5 text-xs text-slate-500">Archived GCs keep their history and free up a plan slot.</p>
              </div>
            </div>
            <div>
              <label htmlFor="edit_notes" className={LABEL}>
                Notes
              </label>
              <textarea
                id="edit_notes"
                rows={2}
                value={gcForm.notes}
                onChange={(event) => setGcForm((prev) => (prev ? { ...prev, notes: event.target.value } : prev))}
                className={INPUT}
              />
              {gcFieldErrors.notes && <p className={ERROR_TEXT}>{gcFieldErrors.notes[0]}</p>}
            </div>
            {gcFieldErrors._form && <p className={ERROR_TEXT}>{gcFieldErrors._form[0]}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={() => setGcFormOpen(false)} className={BTN_SECONDARY}>
                Cancel
              </button>
              <button type="submit" disabled={gcSubmitting} className={BTN_PRIMARY}>
                {gcSubmitting ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {confirmingDeleteGc && (
        <ModalShell title={`Delete ${gc.gc_name}?`} onClose={() => setConfirmingDeleteGc(false)}>
          <p className="text-sm text-slate-600">
            This removes {gc.documents.length} tracked document{gc.documents.length === 1 ? '' : 's'} and every
            reminder tied to them. There&apos;s no undo. If you just stopped working with them, archive instead —
            it frees the plan slot and keeps the history.
          </p>
          <div className="mt-5 flex justify-end gap-3">
            <button type="button" onClick={() => setConfirmingDeleteGc(false)} className={BTN_SECONDARY}>
              Keep it
            </button>
            <button type="button" onClick={() => void deleteGc()} disabled={deletingGc} className={BTN_DANGER}>
              {deletingGc ? 'Deleting…' : 'Delete GC'}
            </button>
          </div>
        </ModalShell>
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
