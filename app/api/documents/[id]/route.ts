// CANONICAL — Single compliance document.
// GET    /api/documents/:id → document with type, GC, and its reminder schedule.
// PATCH  /api/documents/:id → update details. When expiration_date or file_url changes,
//                             status is automatically re-derived and reminders resync
//                             (database triggers). status accepts only two user intents:
//                             'pending_renewal' (asked the broker) or 'valid' (recalculate).
// DELETE /api/documents/:id → remove the document (its reminders cascade).
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  internalError,
  notFoundError,
  parseJsonBody,
  requireAuthenticatedUser,
  validationErrorFromZod,
} from '@/lib/db/api'
import { TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const DOCUMENT_COLUMNS =
  'id, gc_relationship_id, document_type_id, custom_type_label, carrier_name, policy_number, coverage_amount_cents, effective_date, expiration_date, status, file_url, notes, created_at, updated_at'

const DOCUMENT_SELECT = `${DOCUMENT_COLUMNS}, document_type:${TABLES.documentTypes}(id, code, name), gc_relationship:${TABLES.gcRelationships}(id, gc_name)`

const idSchema = z
  .string()
  .uuid("That link looks off — open the document from your dashboard instead.")

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

const updateDocumentSchema = z.object({
  document_type_id: z.string().uuid('Pick a document type from the list.').optional(),
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
  status: z
    .enum(['pending_renewal', 'valid'], {
      errorMap: () => ({
        message:
          "Status is calculated automatically. Set it to pending_renewal after asking your broker, or to valid to recalculate from the dates.",
      }),
    })
    .optional(),
})

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const parsedId = idSchema.safeParse(params.id)
    if (!parsedId.success) {
      return apiError(parsedId.error.issues[0].message, 'INVALID_ID', 400)
    }

    const { data: document, error } = await supabase
      .from(TABLES.documents)
      .select(DOCUMENT_SELECT)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[api/documents/:id] Failed to fetch document:', error.message)
      return internalError()
    }
    if (!document) {
      return notFoundError("We couldn't find that document. It may have been removed.")
    }

    const { data: reminders } = await supabase
      .from(TABLES.reminders)
      .select('id, remind_on, days_before, status, sent_at')
      .eq('document_id', parsedId.data)
      .order('remind_on', { ascending: true })

    return apiSuccess({ ...(document as unknown as Record<string, unknown>), reminders: reminders ?? [] })
  } catch (unexpected) {
    console.error('[api/documents/:id] GET crashed:', unexpected)
    return internalError()
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const parsedId = idSchema.safeParse(params.id)
    if (!parsedId.success) {
      return apiError(parsedId.error.issues[0].message, 'INVALID_ID', 400)
    }

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    const parsed = updateDocumentSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    const { data: existingDocument, error: fetchError } = await supabase
      .from(TABLES.documents)
      .select('id, document_type_id, custom_type_label, effective_date, expiration_date, file_url')
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) {
      console.error('[api/documents/:id] Failed to fetch document:', fetchError.message)
      return internalError()
    }
    if (!existingDocument) {
      return notFoundError("We couldn't find that document. It may have been removed.")
    }

    // Cross-field date check against the merged (existing + incoming) values.
    const nextEffectiveDate =
      parsed.data.effective_date !== undefined
        ? parsed.data.effective_date
        : existingDocument.effective_date
    const nextExpirationDate =
      parsed.data.expiration_date !== undefined
        ? parsed.data.expiration_date
        : existingDocument.expiration_date
    if (nextEffectiveDate && nextExpirationDate && nextEffectiveDate > nextExpirationDate) {
      return apiError(
        'A few fields need attention before we can save this.',
        'VALIDATION_ERROR',
        400,
        { expiration_date: ['The expiration date should come after the effective date.'] }
      )
    }

    // If the type changes to (or stays) 'other', it needs a recognizable label.
    if (parsed.data.document_type_id) {
      const { data: documentType, error: typeError } = await supabase
        .from(TABLES.documentTypes)
        .select('id, code')
        .eq('id', parsed.data.document_type_id)
        .maybeSingle()
      if (typeError) {
        console.error('[api/documents/:id] Failed to verify document type:', typeError.message)
        return internalError()
      }
      if (!documentType) {
        return apiError(
          "That document type doesn't exist. Pick one from the list.",
          'VALIDATION_ERROR',
          400,
          { document_type_id: ['Pick a document type from the list.'] }
        )
      }
      const nextCustomLabel =
        parsed.data.custom_type_label !== undefined
          ? parsed.data.custom_type_label
          : existingDocument.custom_type_label
      if (documentType.code === 'other' && !nextCustomLabel) {
        return apiError(
          'Give this document a short custom label so you can recognize it later.',
          'VALIDATION_ERROR',
          400,
          { custom_type_label: ['Give this document a short custom label so you can recognize it later.'] }
        )
      }
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>
    if (Object.keys(updates).length === 0) {
      return apiError(
        'Nothing to update yet — send at least one field, like expiration_date.',
        'VALIDATION_ERROR',
        400
      )
    }

    // Anticipation: a new expiration date or file usually means the renewal arrived.
    // Nudging status to 'valid' makes the database trigger re-derive the real status
    // (valid / expiring_soon / expired) instead of leaving a stale pending_renewal.
    if (
      (parsed.data.expiration_date !== undefined || parsed.data.file_url !== undefined) &&
      parsed.data.status === undefined
    ) {
      updates.status = 'valid'
    }

    const { data: updatedDocument, error: updateError } = await supabase
      .from(TABLES.documents)
      .update(updates)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select(DOCUMENT_SELECT)
      .maybeSingle()
    if (updateError) {
      console.error('[api/documents/:id] Failed to update document:', updateError.message)
      return internalError()
    }
    if (!updatedDocument) {
      return notFoundError("We couldn't find that document. It may have been removed.")
    }

    // If the expiration moved, the trigger just rescheduled reminders — show them.
    if (parsed.data.expiration_date !== undefined) {
      const { data: scheduledReminders } = await supabase
        .from(TABLES.reminders)
        .select('id, remind_on, days_before, status')
        .eq('document_id', parsedId.data)
        .eq('status', 'scheduled')
        .order('remind_on', { ascending: true })
      return apiSuccess({ ...(updatedDocument as unknown as Record<string, unknown>), scheduled_reminders: scheduledReminders ?? [] })
    }

    return apiSuccess(updatedDocument)
  } catch (unexpected) {
    console.error('[api/documents/:id] PATCH crashed:', unexpected)
    return internalError()
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const parsedId = idSchema.safeParse(params.id)
    if (!parsedId.success) {
      return apiError(parsedId.error.issues[0].message, 'INVALID_ID', 400)
    }

    const { data: deletedDocument, error: deleteError } = await supabase
      .from(TABLES.documents)
      .delete()
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()
    if (deleteError) {
      console.error('[api/documents/:id] Failed to delete document:', deleteError.message)
      return internalError()
    }
    if (!deletedDocument) {
      return notFoundError("We couldn't find that document. It may already be gone.")
    }

    return apiSuccess({ id: deletedDocument.id, deleted: true })
  } catch (unexpected) {
    console.error('[api/documents/:id] DELETE crashed:', unexpected)
    return internalError()
  }
}
