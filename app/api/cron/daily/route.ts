// CANONICAL — Daily maintenance job for SubCompliance.
// Called once per day by the platform scheduler (Netlify scheduled function or
// external cron) with:  Authorization: Bearer <CRON_SECRET>
//
// What it does:
//   1. Re-derives every document status via subcompliance_refresh_document_statuses()
//      — time passes without row updates, so 'valid' documents must roll into
//      'expiring_soon' and then 'expired' on their own.
//   2. Processes due reminders (status=scheduled AND remind_on <= today): dispatches
//      the lapse-reminder email to the account owner via Resend's REST API, then
//      marks them 'sent' with sent_at, which surfaces them in the in-app reminder
//      feed (GET /api/reminders?status=sent). If RESEND_API_KEY is unset, the job
//      logs a warning and reminders still land in the in-app feed.
//
// Environment variables (server only, never NEXT_PUBLIC_): CRON_SECRET,
// SUPABASE_SERVICE_ROLE_KEY (via lib/supabase/server.ts), RESEND_API_KEY,
// REMINDER_FROM_EMAIL (optional From address; defaults to onboarding@resend.dev).
import type { NextRequest } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { apiError, apiSuccess, internalError } from '@/lib/db/api'
import { PRODUCT_ID, TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

async function runDailyMaintenance(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret) {
      // Fail closed: without a secret this endpoint never runs.
      return apiError(
        'This job is not configured yet. Set CRON_SECRET on the server.',
        'CRON_NOT_CONFIGURED',
        401
      )
    }

    const authorizationHeader = request.headers.get('authorization')
    if (authorizationHeader !== `Bearer ${cronSecret}`) {
      return apiError('This endpoint is for the scheduler only.', 'UNAUTHORIZED', 401)
    }

    const serviceRoleClient = createServiceRoleClient()

    // 1. Re-derive document statuses (service-role-only database function).
    const { data: refreshedCount, error: refreshError } = await serviceRoleClient.rpc(
      'subcompliance_refresh_document_statuses'
    )
    if (refreshError) {
      console.error('[api/cron/daily] Status refresh failed:', refreshError.message)
      return internalError()
    }

    // 2. Deliver due reminders: dispatch the lapse-reminder email for each via
    //    Resend, then mark them 'sent' so they surface in the in-app feed.
    const todayIso = new Date().toISOString().slice(0, 10)
    const { data: dueReminders, error: dueError } = await serviceRoleClient
      .from(TABLES.reminders)
      .select('id, user_id, document_id, remind_on, days_before')
      .eq('product_id', PRODUCT_ID)
      .eq('status', 'scheduled')
      .lte('remind_on', todayIso)
    if (dueError) {
      console.error('[api/cron/daily] Reminder lookup failed:', dueError.message)
      return internalError()
    }

    const resendApiKey = process.env.RESEND_API_KEY
    const fromAddress = process.env.REMINDER_FROM_EMAIL || 'SubCompliance <onboarding@resend.dev>'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    if (!resendApiKey && (dueReminders?.length ?? 0) > 0) {
      console.warn(
        '[api/cron/daily] RESEND_API_KEY is not set — due reminders will only appear in the in-app feed.'
      )
    }

    let emailsSent = 0
    for (const reminder of dueReminders ?? []) {
      if (!resendApiKey) break
      try {
        // Recipient = the account that owns the reminder (auth.users email).
        const { data: userResult, error: userError } = await serviceRoleClient.auth.admin.getUserById(
          reminder.user_id
        )
        const recipient = userResult?.user?.email
        if (userError || !recipient) {
          console.error(`[api/cron/daily] No email address for reminder ${reminder.id}; skipping dispatch.`)
          continue
        }

        // remind_on is derived as (expiration date - days_before), so the
        // expiration date can be reconstructed without extra queries.
        const daysBefore = Number(reminder.days_before ?? 0)
        const expiresOn = new Date(`${reminder.remind_on}T00:00:00Z`)
        expiresOn.setUTCDate(expiresOn.getUTCDate() + daysBefore)
        const expiresOnIso = expiresOn.toISOString().slice(0, 10)
        const daysText = daysBefore === 1 ? '1 day' : `${daysBefore} days`

        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipient],
            subject: `SubCompliance: a tracked document expires in ${daysText} (${expiresOnIso})`,
            text: [
              `One of your tracked compliance documents expires on ${expiresOnIso} — ${daysText} from this reminder.`,
              '',
              'A lapsed COI or compliance document can pull you off the job. Review the document, and if it needs',
              'renewing, send your broker the pre-drafted request from your dashboard:',
              '',
              `${appUrl}/dashboard`,
              '',
              '— SubCompliance',
            ].join('\n'),
          }),
        })
        if (response.ok) {
          emailsSent += 1
        } else {
          const failureBody = await response.text().catch(() => '')
          console.error(
            `[api/cron/daily] Resend rejected email for reminder ${reminder.id}: ${response.status} ${failureBody}`
          )
        }
      } catch (dispatchError) {
        console.error(`[api/cron/daily] Email dispatch crashed for reminder ${reminder.id}:`, dispatchError)
      }
    }

    // Mark processed reminders 'sent' so they surface in the in-app feed
    // (GET /api/reminders?status=sent) and are never re-processed.
    const dueReminderIds = (dueReminders ?? []).map((reminder) => reminder.id)
    if (dueReminderIds.length > 0) {
      const { error: reminderError } = await serviceRoleClient
        .from(TABLES.reminders)
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('product_id', PRODUCT_ID)
        .in('id', dueReminderIds)
      if (reminderError) {
        console.error('[api/cron/daily] Reminder processing failed:', reminderError.message)
        return internalError()
      }
    }

    return apiSuccess({
      ran_on: todayIso,
      document_statuses_refreshed: typeof refreshedCount === 'number' ? refreshedCount : 0,
      reminders_delivered: dueReminderIds.length,
      reminder_emails_sent: emailsSent,
    })
  } catch (unexpected) {
    console.error('[api/cron/daily] Job crashed:', unexpected)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  return runDailyMaintenance(request)
}

export async function GET(request: NextRequest) {
  return runDailyMaintenance(request)
}
