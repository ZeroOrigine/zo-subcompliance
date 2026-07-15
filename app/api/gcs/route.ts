// CANONICAL — GC relationships collection.
// GET  /api/gcs  → paginated list, each GC with a compliance rollup (context, not rows).
// POST /api/gcs  → create a GC relationship, enforcing the plan's max_gcs server-side.
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  buildPaginationMeta,
  escapeIlikePattern,
  internalError,
  parseJsonBody,
  parsePagination,
  requireAuthenticatedUser,
  validationErrorFromZod,
} from '@/lib/db/api'
import {
  GC_STATUS_VALUES,
  PRODUCT_ID,
  TABLES,
  type SubcomplianceDocumentStatus,
  type SubcomplianceGcStatus,
} from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const GC_COLUMNS =
  'id, gc_name, contact_name, contact_email, contact_phone, status, notes, created_at, updated_at'

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const optionalText = (maximumLength: number, tooLongMessage: string) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(maximumLength, tooLongMessage).nullable().optional()
  )

const createGcSchema = z.object({
  gc_name: z
    .string({ required_error: "Tell us the general contractor's name — that's all we need to start." })
    .trim()
    .min(1, "Tell us the general contractor's name — that's all we need to start.")
    .max(200, 'Keep the GC name under 200 characters.'),
  contact_name: optionalText(200, 'Keep the contact name under 200 characters.'),
  contact_email: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .email("That contact email doesn't look quite right. Mind checking it?")
      .max(320, 'Email addresses are capped at 320 characters.')
      .nullable()
      .optional()
  ),
  contact_phone: optionalText(40, 'Keep the phone number under 40 characters.'),
  status: z
    .enum(GC_STATUS_VALUES, {
      errorMap: () => ({ message: 'Status can be active, paused, or archived.' }),
    })
    .optional(),
  notes: optionalText(5000, 'Notes are capped at 5,000 characters.'),
})

interface EmbeddedDocumentSummary {
  id: string
  status: SubcomplianceDocumentStatus
  expiration_date: string | null
}

interface GcListRow {
  id: string
  gc_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: SubcomplianceGcStatus
  notes: string | null
  created_at: string
  updated_at: string
  documents: EmbeddedDocumentSummary[] | null
}

function buildComplianceRollup(documents: EmbeddedDocumentSummary[]) {
  const statusCounts: Record<SubcomplianceDocumentStatus, number> = {
    missing: 0,
    valid: 0,
    expiring_soon: 0,
    expired: 0,
    pending_renewal: 0,
  }
  let nextExpiration: string | null = null

  for (const document of documents) {
    statusCounts[document.status] += 1
    if (
      document.expiration_date &&
      (!nextExpiration || document.expiration_date < nextExpiration)
    ) {
      nextExpiration = document.expiration_date
    }
  }

  const attentionCount = statusCounts.missing + statusCounts.expired + statusCounts.expiring_soon

  return {
    total_documents: documents.length,
    status_counts: statusCounts,
    next_expiration: nextExpiration,
    needs_attention: attentionCount > 0,
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams)

    const statusFilter = searchParams.get('status')
    if (statusFilter && !(GC_STATUS_VALUES as readonly string[]).includes(statusFilter)) {
      return apiError(
        'The status filter can be active, paused, or archived.',
        'VALIDATION_ERROR',
        400
      )
    }
    const search = searchParams.get('search')?.trim()

    let query = supabase
      .from(TABLES.gcRelationships)
      .select(`${GC_COLUMNS}, documents:${TABLES.documents}(id, status, expiration_date)`, {
        count: 'exact',
      })
      .eq('user_id', user.id)
      .order('gc_name', { ascending: true })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (search) query = query.ilike('gc_name', `%${escapeIlikePattern(search)}%`)

    const { data, error, count } = await query
    if (error) {
      console.error('[api/gcs] Failed to list GC relationships:', error.message)
      return internalError()
    }

    const rows = (data ?? []) as GcListRow[]
    const items = rows.map((row) => {
      const { documents, ...gcFields } = row
      return { ...gcFields, compliance: buildComplianceRollup(documents ?? []) }
    })

    return apiSuccess({ items, pagination: buildPaginationMeta(page, limit, count ?? 0) })
  } catch (unexpected) {
    console.error('[api/gcs] GET crashed:', unexpected)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    const parsed = createGcSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    // Plan enforcement — the value metric is GC relationships tracked
    // (Free = 3 non-archived GCs, Pro = unlimited). Enforced server-side, always.
    const { data: subscription, error: subscriptionError } = await supabase
      .from(TABLES.subscriptions)
      .select('plan, status')
      .eq('user_id', user.id)
      .maybeSingle()
    if (subscriptionError) {
      console.error('[api/gcs] Failed to read subscription:', subscriptionError.message)
      return internalError()
    }

    const effectivePlanCode =
      subscription && ['active', 'trialing'].includes(subscription.status)
        ? subscription.plan
        : 'free'

    const { data: plan, error: planError } = await supabase
      .from(TABLES.plans)
      .select('code, name, max_gcs')
      .eq('code', effectivePlanCode)
      .maybeSingle()
    if (planError) {
      console.error('[api/gcs] Failed to read plan:', planError.message)
      return internalError()
    }

    const maxGcs: number | null = plan ? plan.max_gcs : effectivePlanCode === 'free' ? 3 : null

    if (maxGcs !== null) {
      const { count: trackedCount, error: countError } = await supabase
        .from(TABLES.gcRelationships)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'archived')
      if (countError) {
        console.error('[api/gcs] Failed to count GC relationships:', countError.message)
        return internalError()
      }
      if ((trackedCount ?? 0) >= maxGcs) {
        return apiError(
          `Your ${plan?.name ?? 'Free'} plan tracks up to ${maxGcs} GC relationships. Archive a GC you no longer work with, or upgrade to Pro for unlimited GCs.`,
          'PLAN_LIMIT_REACHED',
          403
        )
      }
    }

    const { data: createdGc, error: insertError } = await supabase
      .from(TABLES.gcRelationships)
      .insert({
        user_id: user.id,
        product_id: PRODUCT_ID,
        gc_name: parsed.data.gc_name,
        contact_name: parsed.data.contact_name ?? null,
        contact_email: parsed.data.contact_email ?? null,
        contact_phone: parsed.data.contact_phone ?? null,
        status: parsed.data.status ?? 'active',
        notes: parsed.data.notes ?? null,
      })
      .select(GC_COLUMNS)
      .single()
    if (insertError) {
      console.error('[api/gcs] Failed to create GC relationship:', insertError.message)
      return internalError()
    }

    return apiSuccess(createdGc, 201)
  } catch (unexpected) {
    console.error('[api/gcs] POST crashed:', unexpected)
    return internalError()
  }
}
