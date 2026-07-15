// CANONICAL — Lapse reminders feed (read-only collection).
// Reminders are created automatically by database triggers from each document's
// expiration date and the user's reminder_days preference — there is no POST here.
// GET /api/reminders → paginated feed with full context (which document, which GC).
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  buildPaginationMeta,
  internalError,
  parsePagination,
  requireAuthenticatedUser,
} from '@/lib/db/api'
import { REMINDER_STATUS_VALUES, TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const REMINDER_SELECT = `id, document_id, remind_on, days_before, status, sent_at, created_at, updated_at, document:${TABLES.documents}(id, expiration_date, status, custom_type_label, document_type:${TABLES.documentTypes}(id, code, name), gc_relationship:${TABLES.gcRelationships}(id, gc_name))`

const isoDateQuerySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD, like 2026-06-30.')

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams)

    const statusFilter = searchParams.get('status')
    if (statusFilter && !(REMINDER_STATUS_VALUES as readonly string[]).includes(statusFilter)) {
      return apiError(
        'The status filter can be scheduled, sent, dismissed, or failed.',
        'VALIDATION_ERROR',
        400
      )
    }

    const documentId = searchParams.get('document_id')
    if (documentId && !z.string().uuid().safeParse(documentId).success) {
      return apiError("That document filter doesn't look right.", 'VALIDATION_ERROR', 400)
    }

    const fromDate = searchParams.get('from')
    if (fromDate && !isoDateQuerySchema.safeParse(fromDate).success) {
      return apiError('Use the date format YYYY-MM-DD for the from filter.', 'VALIDATION_ERROR', 400)
    }
    const toDate = searchParams.get('to')
    if (toDate && !isoDateQuerySchema.safeParse(toDate).success) {
      return apiError('Use the date format YYYY-MM-DD for the to filter.', 'VALIDATION_ERROR', 400)
    }

    let query = supabase
      .from(TABLES.reminders)
      .select(REMINDER_SELECT, { count: 'exact' })
      .eq('user_id', user.id)
      .order('remind_on', { ascending: true })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (documentId) query = query.eq('document_id', documentId)
    if (fromDate) query = query.gte('remind_on', fromDate)
    if (toDate) query = query.lte('remind_on', toDate)

    const { data, error, count } = await query
    if (error) {
      console.error('[api/reminders] Failed to list reminders:', error.message)
      return internalError()
    }

    return apiSuccess({
      items: data ?? [],
      pagination: buildPaginationMeta(page, limit, count ?? 0),
    })
  } catch (unexpected) {
    console.error('[api/reminders] GET crashed:', unexpected)
    return internalError()
  }
}
