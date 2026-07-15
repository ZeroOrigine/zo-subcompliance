// CANONICAL — Compliance summary: the one-call dashboard insight.
// GET /api/compliance/summary → totals, what needs attention (with days until
// expiration), renewals in motion, and reminders coming up — everything the
// dashboard needs to answer "am I safe to stay on the job?" in a single request.
import {
  apiSuccess,
  internalError,
  requireAuthenticatedUser,
} from '@/lib/db/api'
import {
  DOCUMENT_STATUS_VALUES,
  GC_STATUS_VALUES,
  TABLES,
  type SubcomplianceDocumentStatus,
  type SubcomplianceGcStatus,
} from '@/lib/db/types'

export const dynamic = 'force-dynamic'

interface AttentionRow {
  id: string
  status: SubcomplianceDocumentStatus
  expiration_date: string | null
  custom_type_label: string | null
  document_type: { id: string; code: string; name: string } | null
  gc_relationship: { id: string; gc_name: string } | null
}

const MILLISECONDS_PER_DAY = 86_400_000

function daysBetweenIsoDates(fromIso: string, toIso: string): number {
  return Math.round(
    (Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / MILLISECONDS_PER_DAY
  )
}

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const todayIso = new Date().toISOString().slice(0, 10)

    const [documentCountResults, gcCountResults, attentionResult, reminderCountResult] =
      await Promise.all([
        Promise.all(
          DOCUMENT_STATUS_VALUES.map((status) =>
            supabase
              .from(TABLES.documents)
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', status)
          )
        ),
        Promise.all(
          GC_STATUS_VALUES.map((status) =>
            supabase
              .from(TABLES.gcRelationships)
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
              .eq('status', status)
          )
        ),
        supabase
          .from(TABLES.documents)
          .select(
            `id, status, expiration_date, custom_type_label, document_type:${TABLES.documentTypes}(id, code, name), gc_relationship:${TABLES.gcRelationships}(id, gc_name)`
          )
          .eq('user_id', user.id)
          .in('status', ['expired', 'expiring_soon', 'missing', 'pending_renewal'])
          .order('expiration_date', { ascending: true, nullsFirst: false })
          .limit(12),
        supabase
          .from(TABLES.reminders)
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'scheduled')
          .gte('remind_on', todayIso)
          .lte('remind_on', shiftIsoDate(todayIso, 30)),
      ])

    const documentCountError = documentCountResults.find((result) => result.error)?.error
    if (documentCountError) {
      console.error('[api/compliance/summary] Failed to count documents:', documentCountError.message)
      return internalError()
    }
    const gcCountError = gcCountResults.find((result) => result.error)?.error
    if (gcCountError) {
      console.error('[api/compliance/summary] Failed to count GCs:', gcCountError.message)
      return internalError()
    }
    if (attentionResult.error) {
      console.error('[api/compliance/summary] Failed to read attention items:', attentionResult.error.message)
      return internalError()
    }
    if (reminderCountResult.error) {
      console.error('[api/compliance/summary] Failed to count reminders:', reminderCountResult.error.message)
      return internalError()
    }

    const documentCounts = {} as Record<SubcomplianceDocumentStatus, number>
    DOCUMENT_STATUS_VALUES.forEach((status, index) => {
      documentCounts[status] = documentCountResults[index]?.count ?? 0
    })
    const documentsTotal = DOCUMENT_STATUS_VALUES.reduce(
      (sum, status) => sum + documentCounts[status],
      0
    )

    const gcCounts = {} as Record<SubcomplianceGcStatus, number>
    GC_STATUS_VALUES.forEach((status, index) => {
      gcCounts[status] = gcCountResults[index]?.count ?? 0
    })
    const gcsTotal = GC_STATUS_VALUES.reduce((sum, status) => sum + gcCounts[status], 0)

    const attentionItems = ((attentionResult.data ?? []) as unknown as AttentionRow[]).map(
      (row) => ({
        id: row.id,
        status: row.status,
        expiration_date: row.expiration_date,
        days_until_expiration: row.expiration_date
          ? daysBetweenIsoDates(todayIso, row.expiration_date)
          : null,
        document_label: row.custom_type_label ?? row.document_type?.name ?? 'Document',
        document_type_code: row.document_type?.code ?? null,
        gc: row.gc_relationship
          ? { id: row.gc_relationship.id, gc_name: row.gc_relationship.gc_name }
          : null,
      })
    )

    return apiSuccess({
      generated_on: todayIso,
      gcs: {
        total: gcsTotal,
        active: gcCounts.active,
        paused: gcCounts.paused,
        archived: gcCounts.archived,
      },
      documents: {
        total: documentsTotal,
        valid: documentCounts.valid,
        expiring_soon: documentCounts.expiring_soon,
        expired: documentCounts.expired,
        missing: documentCounts.missing,
        pending_renewal: documentCounts.pending_renewal,
      },
      attention_items: attentionItems,
      renewals_in_progress: documentCounts.pending_renewal,
      reminders: { scheduled_next_30_days: reminderCountResult.count ?? 0 },
      all_clear:
        documentCounts.expired + documentCounts.expiring_soon + documentCounts.missing === 0,
    })
  } catch (unexpected) {
    console.error('[api/compliance/summary] GET crashed:', unexpected)
    return internalError()
  }
}
