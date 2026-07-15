// CANONICAL: POST /api/checkout — SubCompliance upgrade checkout via the CENTRAL
// payments service. This product holds NO Stripe key and ships NO Stripe SDK: one
// central service owns the single Stripe account and its single webhook, then writes
// billing state back into subcompliance_subscriptions / subcompliance_payments.
// Webhook signature verification, event idempotency, and the product-metadata tag
// all live in that central service — never here.
//
// UI contract (pricing page / dashboard billing UIs owned by other steps):
//   const res = await fetch('/api/checkout', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ plan: 'pro' }),
//   })
//   → 200 { url }        → window.location.assign(url)
//   → 401                → visitor isn't signed in: send them to /signup
//   → 4xx/5xx { error }  → show the message as-is (it's already human)
//
// Plans mirror the subcompliance_plans seed exactly: free ($0, up to 3 GCs) and
// pro ($9/mo, unlimited GCs). Button copy rule: Pro checkout charges immediately —
// label buttons "Upgrade to Pro — $9/mo", never "Start trial" (no trial exists).
//
// Price IDs are NEVER hardcoded. Resolution order:
//   1. env STRIPE_PRICE_ID_PRO (server-only, optional override)
//   2. subcompliance_plans.stripe_price_id (set by the Deploy Mind)
//
// Required env (server-only, set on Netlify — NEVER NEXT_PUBLIC_, never in git):
//   PAYMENTS_URL          central payments proxy endpoint
//   PAYMENTS_PROXY_TOKEN  bearer token for the proxy
//   STRIPE_PRICE_ID_PRO   optional price-id override for the Pro monthly plan
//
// Rate limiting: apply a per-user limit (e.g. 10/min) on this route at the edge.

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

  // 1. Authenticate — middleware already gates /api/*, but never trust a single layer.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in first, then we can set up your upgrade.' },
      { status: 401 }
    )
  }

  // 2. Validate the requested plan (server-side — never trust the client).
  let plan = 'pro'
  try {
    const body = await request.json()
    if (body && typeof body.plan === 'string') plan = body.plan.toLowerCase().trim()
  } catch {
    // Empty/absent body is fine — default to the pro plan.
  }

  if (plan === 'free') {
    return NextResponse.json(
      { error: "Free doesn't need a checkout — just start adding GCs." },
      { status: 400 }
    )
  }
  if (plan !== 'pro') {
    return NextResponse.json(
      { error: "We don't recognize that plan. Pro is the one you want." },
      { status: 400 }
    )
  }

  // 3. Don't double-charge someone who's already on Pro.
  const { data: subscription } = await supabase
    .from('subcompliance_subscriptions')
    .select('plan, status')
    .eq('user_id', user.id)
    .maybeSingle()
  if (subscription?.plan === 'pro' && ['active', 'trialing'].includes(subscription.status)) {
    return NextResponse.json(
      { error: "You're already on Pro — unlimited GCs are live on your account." },
      { status: 409 }
    )
  }

  // 4. Resolve the price id: env override → plans table (RLS: readable when signed in).
  let priceId = process.env.STRIPE_PRICE_ID_PRO ?? null
  if (!priceId) {
    const { data: planRow } = await supabase
      .from('subcompliance_plans')
      .select('stripe_price_id')
      .eq('code', plan)
      .eq('is_active', true)
      .maybeSingle()
    priceId = planRow?.stripe_price_id ?? null
  }
  if (!priceId) {
    return NextResponse.json(
      { error: "Upgrades aren't switched on yet. Nothing was charged — check back soon." },
      { status: 503 }
    )
  }

  // 5. Ask the central payments service for a checkout session. Env is read lazily
  //    inside the handler (no module-level throws — build safety).
  const paymentsUrl = process.env.PAYMENTS_URL
  const proxyToken = process.env.PAYMENTS_PROXY_TOKEN
  if (!paymentsUrl || !proxyToken) {
    console.error('[checkout] PAYMENTS_URL or PAYMENTS_PROXY_TOKEN is not configured')
    return NextResponse.json(
      { error: "Our payment system isn't reachable right now. Nothing was charged — try again shortly." },
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
        price_id: priceId,
        user_id: user.id,
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) {
      console.error(`[checkout] central payments responded ${response.status}`)
      return NextResponse.json(
        { error: 'Our payment system is taking a moment. Nothing was charged — try again shortly.' },
        { status: 502 }
      )
    }

    const payload = (await response.json().catch(() => null)) as { url?: unknown } | null
    const url = payload && typeof payload.url === 'string' ? payload.url : null
    if (!url || !/^https:\/\//.test(url)) {
      console.error('[checkout] central payments returned no usable checkout url')
      return NextResponse.json(
        { error: 'Our payment system is taking a moment. Nothing was charged — try again shortly.' },
        { status: 502 }
      )
    }

    // The client redirects the user to this Stripe-hosted checkout URL.
    // Card details never touch SubCompliance — Stripe handles PCI compliance.
    return NextResponse.json({ url })
  } catch (err) {
    console.error('[checkout] proxy call failed', err)
    return NextResponse.json(
      { error: 'Our payment system is taking a moment. Nothing was charged — try again shortly.' },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeout)
  }
}
