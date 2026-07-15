// CANONICAL — Single GC relationship.
// GET    /api/gcs/:id → GC with every required document (and each document's type).
// PATCH  /api/gcs/:id → update GC details or status.
// DELETE /api/gcs/:id → remove the GC (documents, reminders, requests cascade).
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
import { GC_STATUS_VALUES, TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const GC_COLUMNS =
  'id, gc_name, contact_name, contact_email, contact_phone, status, notes, created_at, updated_at'

const GC_DETAIL_SELECT = `${GC_COLUMNS}, documents:${TABLES.documents}(id, document_type_id, custom_type_label, carrier_name, policy_number, coverage_amount_cents, effective_date, expiration_date, status, file_url, notes, created_at, updated_at, document_type:${TABLES.documentTypes}(id, code, name))`

const idSchema = z
  .string()
  .uuid("That link looks off — head back to your dashboard and open the GC from there.")

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const optionalText = (maximumLength: number, tooLongMessage: string) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(maximumLength, tooLongMessage).nullable().optional()
  )

const updateGcSchema = z.object({
  gc_name: z
    .string()
    .trim()
    .min(1, "The GC name can't be empty — that's how you find them in your list.")
    .max(200, 'Keep the GC name under 200 characters.')
    .optional(),
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

interface EmbeddedDocument {
  id: string
  expiration_date: string | null
  created_at: string
  [key: string]: unknown
}

function sortDocumentsByUrgency(documents: EmbeddedDocument[]): EmbeddedDocument[] {
  return [...documents].sort((first, second) => {
    if (first.expiration_date && second.expiration_date) {
      return first.expiration_date.localeCompare(second.expiration_date)
    }
    if (first.expiration_date) return -1
    if (second.expiration_date) return 1
    return first.created_at.localeCompare(second.created_at)
  })
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const parsedId = idSchema.safeParse(params.id)
    if (!parsedId.success) {
      return apiError(parsedId.error.issues[0].message, 'INVALID_ID', 400)
    }

    const { data, error } = await supabase
      .from(TABLES.gcRelationships)
      .select(GC_DETAIL_SELECT)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[api/gcs/:id] Failed to fetch GC relationship:', error.message)
      return internalError()
    }
    if (!data) {
      return notFoundError("We couldn't find that GC in your account. It may have been removed.")
    }

    const { documents, ...gcFields } = data as unknown as { documents: EmbeddedDocument[] | null } & Record<
      string,
      unknown
    >

    return apiSuccess({ ...gcFields, documents: sortDocumentsByUrgency(documents ?? []) })
  } catch (unexpected) {
    console.error('[api/gcs/:id] GET crashed:', unexpected)
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

    const parsed = updateGcSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    )
    if (Object.keys(updates).length === 0) {
      return apiError(
        'Nothing to update yet — send at least one field, like gc_name or status.',
        'VALIDATION_ERROR',
        400
      )
    }

    const { data: updatedGc, error: updateError } = await supabase
      .from(TABLES.gcRelationships)
      .update(updates)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select(GC_COLUMNS)
      .maybeSingle()
    if (updateError) {
      console.error('[api/gcs/:id] Failed to update GC relationship:', updateError.message)
      return internalError()
    }
    if (!updatedGc) {
      return notFoundError("We couldn't find that GC in your account. It may have been removed.")
    }

    return apiSuccess(updatedGc)
  } catch (unexpected) {
    console.error('[api/gcs/:id] PATCH crashed:', unexpected)
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

    const { data: deletedGc, error: deleteError } = await supabase
      .from(TABLES.gcRelationships)
      .delete()
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select('id')
      .maybeSingle()
    if (deleteError) {
      console.error('[api/gcs/:id] Failed to delete GC relationship:', deleteError.message)
      return internalError()
    }
    if (!deletedGc) {
      return notFoundError("We couldn't find that GC in your account. It may already be gone.")
    }

    // Documents, reminders, and broker requests under this GC cascade away with it.
    return apiSuccess({ id: deletedGc.id, deleted: true })
  } catch (unexpected) {
    console.error('[api/gcs/:id] DELETE crashed:', unexpected)
    return internalError()
  }
}
