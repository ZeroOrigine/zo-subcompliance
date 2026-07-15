// CANONICAL — SubCompliance client-side API helper + shared response types.
// Every dashboard page talks to app/api/** through this one wrapper, so the
// { data, error, code, details } envelope is handled in exactly one place.
import type {
  SubcomplianceBrokerRequestStatus,
  SubcomplianceDocumentStatus,
  SubcomplianceGcStatus,
} from '@/lib/db/types'

export interface FieldErrors {
  [field: string]: string[]
}

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: FieldErrors

  constructor(message: string, code: string, status: number, details?: FieldErrors) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

interface Envelope<T> {
  data: T | null
  error: string | null
  code?: string
  details?: FieldErrors
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    })
  } catch {
    throw new ApiError(
      "We couldn't reach the server. Check your connection and try again.",
      'NETWORK_ERROR',
      0
    )
  }

  let envelope: Envelope<T> | null = null
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    envelope = null
  }

  if (!response.ok || !envelope || envelope.error) {
    throw new ApiError(
      envelope?.error ?? 'Something hiccuped on our side. Give it another try in a moment.',
      envelope?.code ?? 'UNKNOWN_ERROR',
      response.status,
      envelope?.details
    )
  }

  return envelope.data as T
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export interface Paginated<T> {
  items: T[]
  pagination: PaginationMeta
}

export interface ComplianceRollup {
  total_documents: number
  status_counts: Record<SubcomplianceDocumentStatus, number>
  next_expiration: string | null
  needs_attention: boolean
}

export interface GcListItem {
  id: string
  gc_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: SubcomplianceGcStatus
  notes: string | null
  created_at: string
  updated_at: string
  compliance: ComplianceRollup
}

export interface DocumentTypeItem {
  id: string
  code: string
  name: string
  description: string | null
  typical_validity_months: number | null
  sort_order: number
}

export interface ScheduledReminder {
  id: string
  remind_on: string
  days_before: number
  status: string
}

export interface DocumentItem {
  id: string
  gc_relationship_id?: string
  document_type_id: string
  custom_type_label: string | null
  carrier_name: string | null
  policy_number: string | null
  coverage_amount_cents: number | null
  effective_date: string | null
  expiration_date: string | null
  status: SubcomplianceDocumentStatus
  file_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
  document_type?: { id: string; code: string; name: string } | null
  gc_relationship?: { id: string; gc_name: string } | null
  scheduled_reminders?: ScheduledReminder[]
}

export interface GcDetail {
  id: string
  gc_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: SubcomplianceGcStatus
  notes: string | null
  created_at: string
  updated_at: string
  documents: DocumentItem[]
}

export interface AttentionItem {
  id: string
  status: SubcomplianceDocumentStatus
  expiration_date: string | null
  days_until_expiration: number | null
  document_label: string
  document_type_code: string | null
  gc: { id: string; gc_name: string } | null
}

export interface ComplianceSummary {
  generated_on: string
  gcs: { total: number; active: number; paused: number; archived: number }
  documents: {
    total: number
    valid: number
    expiring_soon: number
    expired: number
    missing: number
    pending_renewal: number
  }
  attention_items: AttentionItem[]
  renewals_in_progress: number
  reminders: { scheduled_next_30_days: number }
  all_clear: boolean
}

export interface BrokerRequestItem {
  id: string
  gc_relationship_id: string
  document_id: string | null
  recipient_name: string | null
  recipient_email: string | null
  subject: string
  body: string
  status: SubcomplianceBrokerRequestStatus
  sent_at: string | null
  created_at: string
  updated_at: string
  gc_relationship?: { id: string; gc_name: string } | null
}

export interface ProfileItem {
  id: string
  email: string | null
  full_name: string | null
  business_name: string | null
  trade: string | null
  phone: string | null
  broker_name: string | null
  broker_email: string | null
  broker_phone: string | null
  reminder_days: number[]
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}
