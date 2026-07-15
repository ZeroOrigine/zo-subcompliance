// CANONICAL — Single reminder.
// GET   /api/reminders/:id → reminder with its document and GC context.
// PATCH /api/reminders/:id → the only user action is dismissing it. Scheduling and
//                            sending are handled by the daily job — never by hand.
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

const REMINDER_SELECT = `id, document_id, remind_on, days_before, status, sent_at, created_at, updated_at, document:${TABLES.documents}(id, expiration_date, status, custom_type_label, document_type:${TABLES.documentTypes}(id, code, name), gc_relationship:${TABLES.gcRelationships}(id, gc_name))`

const idSchema = z
  .string()
  .uuid("That link looks off — open the reminder from your dashboard instead.")

const updateReminderSchema = z.object({
  status: z.literal('dismissed', {
    errorMap: () => ({
      message: 'You can only dismiss a reminder — scheduling and sending happen automatically.',
    }),
  }),
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

    const { data: reminder, error } = await supabase
      .from(TABLES.reminders)
      .select(REMINDER_SELECT)
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .maybeSingle()
    if (error) {
      console.error('[api/reminders/:id] Failed to fetch reminder:', error.message)
      return internalError()
    }
    if (!reminder) {
      return notFoundError("We couldn't find that reminder. It may have been cleared already.")
    }

    return apiSuccess(reminder)
  } catch (unexpected) {
    console.error('[api/reminders/:id] GET crashed:', unexpected)
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

    const parsed = updateReminderSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    // Idempotent: dismissing an already-dismissed reminder simply returns it.
    const { data: updatedReminder, error: updateError } = await supabase
      .from(TABLES.reminders)
      .update({ status: 'dismissed' })
      .eq('id', parsedId.data)
      .eq('user_id', user.id)
      .select('id, document_id, remind_on, days_before, status, sent_at, created_at, updated_at')
      .maybeSingle()
    if (updateError) {
      console.error('[api/reminders/:id] Failed to dismiss reminder:', updateError.message)
      return internalError()
    }
    if (!updatedReminder) {
      return notFoundError("We couldn't find that reminder. It may have been cleared already.")
    }

    return apiSuccess(updatedReminder)
  } catch (unexpected) {
    console.error('[api/reminders/:id] PATCH crashed:', unexpected)
    return internalError()
  }
}
