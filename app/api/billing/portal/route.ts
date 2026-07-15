// CANONICAL: POST /api/billing/portal — asks the CENTRAL payments service for a
// Stripe billing-portal session so Pro users can manage/cancel their subscription.
// SubCompliance holds no Stripe key, so the portal — like checkout — goes through the
// central proxy (same endpoint + bearer token, with action:'portal' and no price_id).
// If the central service doesn't support portal sessions yet, this fails gracefully
// and the UI keeps showing plan state from GET /api/billing/status.
//
// UI contract (manage-subscription UI, owned by core):
//   fetch('/api/billing/portal', { method: 'POST' })
//     → 200 { url }        → window.location.assign(url)
//     → 400 { error }      → user is on Free: point them at the upgrade flow instead
//     → 502/503 { error }  → show the message; plan state is unchanged
//
// Required env (server-only): PAYMENTS_URL, PAYMENTS_PROXY_TOKEN.
// Rate limiting: same edge limit as /api/checkout (e.g. 10/min/user).

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PRODUCT_SLUG = 'subcompliance'

// CSRF guard: cookie-authenticated POST must originate from this site.
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json(
      { error: "That request didn't come from SubCompliance, so we stopped it." },
      { status: 403 }
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to manage your billing.' },
      { status: 401 }
    )
  }

  // Only users the central webhook has attached to a Stripe customer have billing to manage.
  const { data: subscription } = await supabase
    .from('subcompliance_subscriptions')
    .select('stripe_customer_id, plan')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!subscription?.stripe_customer_id) {
    return NextResponse.json(
      { error: "You're on the Free plan — there's no billing to manage yet. Upgrade to Pro and this is where you'll handle it." },
      { status: 400 }
    )
  }

  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    console.error('[billing/portal] PAYMENTS_URL or PAYMENTS_PROXY_TOKEN is not configured')
    return NextResponse.json(
      { error: "Our billing system isn't reachable right now. Your plan is unchanged — try again shortly." },
      { status: 503 }
    )
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(paymentsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${proxyToken}`,
      },
      body: JSON.stringify({
        product_slug: PRODUCT_SLUG,
        user_id: user.id,
        action: 'portal',
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[billing/portal] central payments responded ${response.status}`)
      return NextResponse.json(
        { error: "We couldn't open the billing portal right now. Your plan is unchanged — try again in a minute." },
        { status: 502 }
      )
    }

    const payload = (await response.json().catch(() => null)) as { url?: unknown } | null
    const url = payload && typeof payload.url === 'string' ? payload.url : null
    if (!url || !/^https:\/\//.test(url)) {
      console.error('[billing/portal] central payments returned no usable portal url')
      return NextResponse.json(
        { error: "We couldn't open the billing portal right now. Your plan is unchanged — try again in a minute." },
        { status: 502 }
      )
    }

    return NextResponse.json({ url })
  } catch (err) {
    console.error('[billing/portal] proxy call failed', err)
    return NextResponse.json(
      { error: "We couldn't open the billing portal right now. Your plan is unchanged — try again in a minute." },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
