// CANONICAL — Compliance documents collection.
// GET  /api/documents → paginated list (filter by GC, type, status), most urgent first.
// POST /api/documents → add a required document under a GC. Status is derived by the
//                       database trigger; reminders are auto-scheduled from the
//                       expiration date and returned so the UI can celebrate it.
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  buildPaginationMeta,
  internalError,
  notFoundError,
  parseJsonBody,
  parsePagination,
  requireAuthenticatedUser,
  validationErrorFromZod,
} from '@/lib/db/api'
import { DOCUMENT_STATUS_VALUES, PRODUCT_ID, TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const DOCUMENT_COLUMNS =
  'id, gc_relationship_id, document_type_id, custom_type_label, carrier_name, policy_number, coverage_amount_cents, effective_date, expiration_date, status, file_url, notes, created_at, updated_at'

const DOCUMENT_SELECT = `${DOCUMENT_COLUMNS}, document_type:${TABLES.documentTypes}(id, code, name), gc_relationship:${TABLES.gcRelationships}(id, gc_name)`

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const optionalText = (maximumLength: number, tooLongMessage: string) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(maximumLength, tooLongMessage).nullable().optional()
  )

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD, like 2026-06-30.')
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    "That date doesn't exist on the calendar — double-check it?"
  )

const optionalIsoDate = z.preprocess(emptyToNull, isoDateSchema.nullable().optional())

const createDocumentSchema = z
  .object({
    gc_relationship_id: z
      .string({ required_error: 'Pick which GC this document belongs to.' })
      .uuid('Pick which GC this document belongs to.'),
    document_type_id: z
      .string({
        required_error: 'Pick a document type — General Liability COI is the most common.',
      })
      .uuid('Pick a document type — General Liability COI is the most common.'),
    custom_type_label: optionalText(120, 'Keep the custom label under 120 characters.'),
    carrier_name: optionalText(200, 'Keep the carrier name under 200 characters.'),
    policy_number: optionalText(100, 'Keep the policy number under 100 characters.'),
    coverage_amount_cents: z
      .number({
        invalid_type_error:
          'Coverage amount should be in cents — for example, 100000000 for $1,000,000.',
      })
      .int('Coverage amount should be a whole number of cents.')
      .min(0, "Coverage amount can't be negative.")
      .nullable()
      .optional(),
    effective_date: optionalIsoDate,
    expiration_date: optionalIsoDate,
    file_url: optionalText(1000, 'That file reference is too long.'),
    notes: optionalText(5000, 'Notes are capped at 5,000 characters.'),
  })
  .superRefine((value, context) => {
    if (value.effective_date && value.expiration_date && value.effective_date > value.expiration_date) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiration_date'],
        message: 'The expiration date should come after the effective date.',
      })
    }
  })

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams)

    const statusFilter = searchParams.get('status')
    if (statusFilter && !(DOCUMENT_STATUS_VALUES as readonly string[]).includes(statusFilter)) {
      return apiError(
        'The status filter can be missing, valid, expiring_soon, expired, or pending_renewal.',
        'VALIDATION_ERROR',
        400
      )
    }

    const gcRelationshipId = searchParams.get('gc_relationship_id')
    if (gcRelationshipId && !z.string().uuid().safeParse(gcRelationshipId).success) {
      return apiError("That GC filter doesn't look right. Pick a GC from your list.", 'VALIDATION_ERROR', 400)
    }

    const documentTypeId = searchParams.get('document_type_id')
    if (documentTypeId && !z.string().uuid().safeParse(documentTypeId).success) {
      return apiError("That document type filter doesn't look right.", 'VALIDATION_ERROR', 400)
    }

    let query = supabase
      .from(TABLES.documents)
      .select(DOCUMENT_SELECT, { count: 'exact' })
      .eq('user_id', user.id)
      .order('expiration_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (gcRelationshipId) query = query.eq('gc_relationship_id', gcRelationshipId)
    if (documentTypeId) query = query.eq('document_type_id', documentTypeId)

    const { data, error, count } = await query
    if (error) {
      console.error('[api/documents] Failed to list documents:', error.message)
      return internalError()
    }

    return apiSuccess({
      items: data ?? [],
      pagination: buildPaginationMeta(page, limit, count ?? 0),
    })
  } catch (unexpected) {
    console.error('[api/documents] GET crashed:', unexpected)
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

    const parsed = createDocumentSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    // The RLS insert policy checks ownership of the row, not of the referenced GC —
    // so we verify the GC belongs to this user before writing anything.
    const { data: gcRelationship, error: gcError } = await supabase
      .from(TABLES.gcRelationships)
      .select('id, gc_name')
      .eq('id', parsed.data.gc_relationship_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (gcError) {
      console.error('[api/documents] Failed to verify GC ownership:', gcError.message)
      return internalError()
    }
    if (!gcRelationship) {
      return notFoundError("We couldn't find that GC in your account. Pick one from your list.")
    }

    const { data: documentType, error: typeError } = await supabase
      .from(TABLES.documentTypes)
      .select('id, code, name')
      .eq('id', parsed.data.document_type_id)
      .maybeSingle()
    if (typeError) {
      console.error('[api/documents] Failed to verify document type:', typeError.message)
      return internalError()
    }
    if (!documentType) {
      return apiError(
        "That document type doesn't exist. Pick one from the list — General Liability COI is the most common.",
        'VALIDATION_ERROR',
        400,
        { document_type_id: ['Pick a document type from the list.'] }
      )
    }
    if (documentType.code === 'other' && !parsed.data.custom_type_label) {
      return apiError(
        'Give this document a short custom label so you can recognize it later.',
        'VALIDATION_ERROR',
        400,
        { custom_type_label: ['Give this document a short custom label so you can recognize it later.'] }
      )
    }

    // Status is intentionally NOT accepted here — the database trigger derives it
    // from expiration_date and file_url, and auto-schedules reminders.
    const { data: createdDocument, error: insertError } = await supabase
      .from(TABLES.documents)
      .insert({
        user_id: user.id,
        product_id: PRODUCT_ID,
        gc_relationship_id: parsed.data.gc_relationship_id,
        document_type_id: parsed.data.document_type_id,
        custom_type_label: parsed.data.custom_type_label ?? null,
        carrier_name: parsed.data.carrier_name ?? null,
        policy_number: parsed.data.policy_number ?? null,
        coverage_amount_cents: parsed.data.coverage_amount_cents ?? null,
        effective_date: parsed.data.effective_date ?? null,
        expiration_date: parsed.data.expiration_date ?? null,
        file_url: parsed.data.file_url ?? null,
        notes: parsed.data.notes ?? null,
      })
      .select(DOCUMENT_SELECT)
      .single()
    if (insertError) {
      if (insertError.code === '23503') {
        return apiError(
          'That GC or document type no longer exists. Refresh the page and try again.',
          'REFERENCE_NOT_FOUND',
          400
        )
      }
      console.error('[api/documents] Failed to create document:', insertError.message)
      return internalError()
    }

    // DOCUMENT_SELECT is assembled at runtime, so Supabase's type parser can't infer
    // the row shape (it falls back to GenericStringError). Assert the shape we know
    // the insert returns.
    const createdRow = createdDocument as unknown as { id: string } & Record<string, unknown>

    // The trigger just scheduled lapse reminders — return them so the UI can say
    // "We'll warn you 30, 14, 7 and 1 day before this expires."
    const { data: scheduledReminders } = await supabase
      .from(TABLES.reminders)
      .select('id, remind_on, days_before, status')
      .eq('document_id', createdRow.id)
      .eq('status', 'scheduled')
      .order('remind_on', { ascending: true })

    return apiSuccess({ ...createdRow, scheduled_reminders: scheduledReminders ?? [] }, 201)
  } catch (unexpected) {
    console.error('[api/documents] POST crashed:', unexpected)
    return internalError()
  }
}
