// CANONICAL — Single broker request.
// GET    /api/broker-requests/:id → the request with GC context.
// PATCH  /api/broker-requests/:id → edit the draft or move it through its lifecycle
//                                   (draft → sent → fulfilled, or → canceled). Marking
//                                   it sent stamps sent_at and flags the linked
//                                   document pending_renewal so the dashboard shows
//                                   the renewal is in motion.
// DELETE /api/broker-requests/:id → drafts only; sent history stays for your records.
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
import {
  BROKER_REQUEST_STATUS_VALUES,
  TABLES,
  type SubcomplianceBrokerRequestStatus,
} from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const BROKER_REQUEST_COLUMNS =
  'id, gc_relationship_id, document_id, recipient_name, recipient_email, subject, body, status, sent_at, created_at, updated_at'

const BROKER_REQUEST_SELECT = `${BROKER_REQUEST_COLUMNS}, gc_relationship:${TABLES.gcRelationships}(id, gc_name)`

const idSchema = z
  .string()
  .uuid("That link looks off — open the request from your dashboard instead.")

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const updateBrokerRequestSchema = z.object({
  recipient_name: z.preprocess(
    emptyToNull,
    z.string().trim().max(200, 'Keep the recipient name under 200 characters.').nullable().optional()
  ),
  recipient_email: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .email("That email doesn't look quite right. Mind double-checking it?")
      .max(320, 'Email addresses are capped at 320 characters.')
      .nullable()
      .optional()
  ),
  subject: z
    .string()
    .trim()
    .min(1, "The subject can't be blank.")
    .max(300, 'Keep the subject under 300 characters.')
    .optional(),
  body: z
    .string()
    .trim()
    .min(1, "The body can't be blank.")
    .max(10000, 'Keep the request under 10,000 characters.')
    .optional(),
  status: z
    .enum(BROKER_REQUEST_STATUS_VALUES, {
      errorMap: () => ({ message: 'Status can be draft, sent, fulfilled, or canceled.' }),
    })
    .optional(),
})

const ALLOWED_STATUS_TRANSITIONS: Record<
  SubcomplianceBrokerRequestStatus,
  SubcomplianceBrokerRequestStatus[]
> = {
  draft: ['sent', 'canceled'],
  sent: ['fulfilled', 'canceled'],
  fulfilled: [],
  canceled: [],
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

    const { data: brokerRequest, error } = await supabase
      .from(TABLES.brokerRequests)
      .select(BROKER_REQUEST_SELECT)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[api/broker-requests/:id] Failed to fetch broker request:', error.message)
      return internalError()
    }
    if (!brokerRequest) {
      return notFoundError("We couldn't find that request. It may have been removed.")
    }

    return apiSuccess(brokerRequest)
  } catch (unexpected) {
    console.error('[api/broker-requests/:id] GET crashed:', unexpected)
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

    const parsed = updateBrokerRequestSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    const { data: existingRequest, error: fetchError } = await supabase
      .from(TABLES.brokerRequests)
      .select('id, status, document_id')
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) {
      console.error('[api/broker-requests/:id] Failed to fetch broker request:', fetchError.message)
      return internalError()
    }
    if (!existingRequest) {
      return notFoundError("We couldn't find that request. It may have been removed.")
    }

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>
    if (Object.keys(updates).length === 0) {
      return apiError(
        'Nothing to update yet — send at least one field, like subject or status.',
        'VALIDATION_ERROR',
        400
      )
    }

    const currentStatus = existingRequest.status as SubcomplianceBrokerRequestStatus
    const nextStatus = parsed.data.status

    if (nextStatus && nextStatus !== currentStatus) {
      if (!ALLOWED_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
        return apiError(
          `This request is already ${currentStatus}, so it can't move to ${nextStatus}. Create a fresh draft if you need to ask again.`,
          'INVALID_STATUS_CHANGE',
          400
        )
      }
      if (nextStatus === 'sent') {
        updates.sent_at = new Date().toISOString()
      }
    }

    const { data: updatedRequest, error: updateError } = await supabase
      .from(TABLES.brokerRequests)
      .update(updates)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select(BROKER_REQUEST_SELECT)
      .maybeSingle()
    if (updateError) {
      console.error('[api/broker-requests/:id] Failed to update broker request:', updateError.message)
      return internalError()
    }
    if (!updatedRequest) {
      return notFoundError("We couldn't find that request. It may have been removed.")
    }

    // Anticipation: once the renewal ask is out the door, the linked document is
    // 'pending_renewal' — the dashboard shows it's handled instead of still nagging.
    // (The database trigger keeps 'expired' winning if the date has already passed.)
    if (nextStatus === 'sent' && currentStatus !== 'sent' && existingRequest.document_id) {
      const { error: documentUpdateError } = await supabase
        .from(TABLES.documents)
        .update({ status: 'pending_renewal' })
        .eq('id', existingRequest.document_id)
        .eq('user_id', user.id)
      if (documentUpdateError) {
        console.error(
          '[api/broker-requests/:id] Marked sent but could not flag document pending_renewal:',
          documentUpdateError.message
        )
      }
    }

    return apiSuccess(updatedRequest)
  } catch (unexpected) {
    console.error('[api/broker-requests/:id] PATCH crashed:', unexpected)
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

    const { data: existingRequest, error: fetchError } = await supabase
      .from(TABLES.brokerRequests)
      .select('id, status')
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (fetchError) {
      console.error('[api/broker-requests/:id] Failed to fetch broker request:', fetchError.message)
      return internalError()
    }
    if (!existingRequest) {
      return notFoundError("We couldn't find that request. It may already be gone.")
    }
    if (existingRequest.status !== 'draft') {
      return apiError(
        `Only drafts can be deleted. This one is ${existingRequest.status} — cancel it instead to keep your records straight.`,
        'ONLY_DRAFTS_DELETABLE',
        400
      )
    }

    const { error: deleteError } = await supabase
      .from(TABLES.brokerRequests)
      .delete()
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
    if (deleteError) {
      console.error('[api/broker-requests/:id] Failed to delete broker request:', deleteError.message)
      return internalError()
    }

    return apiSuccess({ id: existingRequest.id, deleted: true })
  } catch (unexpected) {
    console.error('[api/broker-requests/:id] DELETE crashed:', unexpected)
    return internalError()
  }
}
