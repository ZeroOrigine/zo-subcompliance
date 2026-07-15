// CANONICAL — Contractor profile: business identity, broker contact, reminder timing.
// GET   /api/profile → the profile (auto-heals if the signup trigger ever missed it).
// PATCH /api/profile → update identity, broker contact, or reminder_days. Changing
//                      reminder_days immediately resyncs every scheduled reminder for
//                      future-dated documents — no stale schedules, no manual steps.
import type { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  internalError,
  parseJsonBody,
  requireAuthenticatedUser,
  validationErrorFromZod,
} from '@/lib/db/api'
import { PRODUCT_ID, TABLES } from '@/lib/db/types'

// Reminder rows are user-writable only by the database trigger; the API's
// authenticated (user-scoped) client has no INSERT/DELETE grant on the
// reminders table (RLS hardening, QA-003). The resync therefore runs on a
// service-role client scoped explicitly to the acting user's id.
function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) return null
  return createServiceClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export const dynamic = 'force-dynamic'

const PROFILE_COLUMNS =
  'id, email, full_name, business_name, trade, phone, broker_name, broker_email, broker_phone, reminder_days, role, created_at, updated_at'

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const optionalText = (maximumLength: number, tooLongMessage: string) =>
  z.preprocess(
    emptyToNull,
    z.string().trim().max(maximumLength, tooLongMessage).nullable().optional()
  )

const updateProfileSchema = z.object({
  full_name: optionalText(200, 'Keep your name under 200 characters.'),
  business_name: optionalText(200, 'Keep the business name under 200 characters.'),
  trade: optionalText(100, 'Keep the trade under 100 characters.'),
  phone: optionalText(40, 'Keep the phone number under 40 characters.'),
  broker_name: optionalText(200, "Keep your broker's name under 200 characters."),
  broker_email: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .email("That broker email doesn't look quite right. Mind checking it?")
      .max(320, 'Email addresses are capped at 320 characters.')
      .nullable()
      .optional()
  ),
  broker_phone: optionalText(40, 'Keep the phone number under 40 characters.'),
  reminder_days: z
    .array(
      z
        .number({ invalid_type_error: 'Reminder days should be numbers, like 30 or 7.' })
        .int('Reminder days should be whole numbers.')
        .min(1, 'The shortest reminder lead time is 1 day.')
        .max(365, 'The longest reminder lead time is 365 days.'),
      { invalid_type_error: 'Send reminder_days as a list of numbers, like [30, 14, 7, 1].' }
    )
    .min(1, 'Keep at least one reminder day so nothing slips.')
    .max(10, 'Ten reminder days is plenty — pick your top ten.')
    .optional(),
})

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`)
  base.setUTCDate(base.getUTCDate() + deltaDays)
  return base.toISOString().slice(0, 10)
}

// Rebuild the scheduled reminders for every future-dated document so a new
// reminder_days preference takes effect immediately (the database trigger only
// resyncs when a document's expiration date changes). Sent reminders stay put.
async function resyncScheduledReminders(
  userId: string,
  reminderDays: number[]
): Promise<boolean> {
  const supabase = createServiceRoleClient()
  if (!supabase) {
    console.error('[api/profile] Reminder resync: service role client unavailable.')
    return false
  }
  const todayIso = new Date().toISOString().slice(0, 10)

  const { data: futureDocuments, error: documentsError } = await supabase
    .from(TABLES.documents)
    .select('id, expiration_date')
    .eq('user_id', userId)
    .gte('expiration_date', todayIso)
  if (documentsError) {
    console.error('[api/profile] Reminder resync: failed to list documents:', documentsError.message)
    return false
  }

  const { error: deleteError } = await supabase
    .from(TABLES.reminders)
    .delete()
    .eq('user_id', userId)
    .eq('status', 'scheduled')
  if (deleteError) {
    console.error('[api/profile] Reminder resync: failed to clear schedule:', deleteError.message)
    return false
  }

  const reminderRows: Array<{
    user_id: string
    product_id: string
    document_id: string
    remind_on: string
    days_before: number
  }> = []

  for (const document of futureDocuments ?? []) {
    if (!document.expiration_date) continue
    for (const daysBefore of reminderDays) {
      const remindOn = shiftIsoDate(document.expiration_date, -daysBefore)
      if (remindOn >= todayIso) {
        reminderRows.push({
          user_id: userId,
          product_id: PRODUCT_ID,
          document_id: document.id,
          remind_on: remindOn,
          days_before: daysBefore,
        })
      }
    }
  }

  if (reminderRows.length === 0) return true

  const { error: insertError } = await supabase
    .from(TABLES.reminders)
    .upsert(reminderRows, {
      onConflict: 'document_id,remind_on,days_before',
      ignoreDuplicates: true,
    })
  if (insertError) {
    console.error('[api/profile] Reminder resync: failed to reschedule:', insertError.message)
    return false
  }
  return true
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const { data: existingProfile, error: fetchError } = await supabase
      .from(TABLES.profiles)
      .select(PROFILE_COLUMNS)
      .eq('id', user.id)
      .maybeSingle()
    if (fetchError) {
      console.error('[api/profile] Failed to fetch profile:', fetchError.message)
      return internalError()
    }
    if (existingProfile) return apiSuccess(existingProfile)

    // Auto-heal: the signup trigger normally creates this row. If it is missing,
    // create it now so the user never sees a broken settings page.
    const { data: createdProfile, error: insertError } = await supabase
      .from(TABLES.profiles)
      .insert({ id: user.id, email: user.email ?? null })
      .select(PROFILE_COLUMNS)
      .single()
    if (insertError) {
      console.error('[api/profile] Failed to auto-create profile:', insertError.message)
      return internalError()
    }

    return apiSuccess(createdProfile)
  } catch (unexpected) {
    console.error('[api/profile] GET crashed:', unexpected)
    return internalError()
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    const parsed = updateProfileSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    const updates = Object.fromEntries(
      Object.entries(parsed.data).filter(([, value]) => value !== undefined)
    ) as Record<string, unknown>
    if (Object.keys(updates).length === 0) {
      return apiError(
        'Nothing to update yet — send at least one field, like broker_email or reminder_days.',
        'VALIDATION_ERROR',
        400
      )
    }

    let normalizedReminderDays: number[] | null = null
    if (parsed.data.reminder_days) {
      normalizedReminderDays = Array.from(new Set(parsed.data.reminder_days)).sort(
        (first, second) => second - first
      )
      updates.reminder_days = normalizedReminderDays
    }

    let { data: updatedProfile, error: updateError } = await supabase
      .from(TABLES.profiles)
      .update(updates)
      .eq('id', user.id)
      .select(PROFILE_COLUMNS)
      .maybeSingle()
    if (updateError) {
      console.error('[api/profile] Failed to update profile:', updateError.message)
      return internalError()
    }

    if (!updatedProfile) {
      // Auto-heal: profile row missing — create it with the requested values.
      const { data: createdProfile, error: insertError } = await supabase
        .from(TABLES.profiles)
        .insert({ id: user.id, email: user.email ?? null, ...updates })
        .select(PROFILE_COLUMNS)
        .single()
      if (insertError) {
        console.error('[api/profile] Failed to auto-create profile:', insertError.message)
        return internalError()
      }
      updatedProfile = createdProfile
    }

    // New reminder timing applies right away — not just to future documents.
    // Report the true outcome so the client never claims success on a no-op.
    if (normalizedReminderDays) {
      const resynced = await resyncScheduledReminders(user.id, normalizedReminderDays)
      return apiSuccess({ ...updatedProfile, reminders_resynced: resynced })
    }

    return apiSuccess(updatedProfile)
  } catch (unexpected) {
    console.error('[api/profile] PATCH crashed:', unexpected)
    return internalError()
  }
}
