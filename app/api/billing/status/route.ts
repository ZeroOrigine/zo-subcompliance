// CANONICAL: GET /api/billing/status — the single source the UI reads for plan,
// subscription state and GC usage. Billing truth lives in THIS product's own tables
// (subcompliance_subscriptions, written by the central payments webhook) — no Stripe
// SDK, no Stripe key, no signature verification in this product.
//
// UI contract (manage-subscription / usage-meter / in-app pricing, owned by core):
//   fetch('/api/billing/status') → 200 {
//     plan:         { code, name, price_monthly_cents, max_gcs, features },
//     plans:        [ ...all active tiers, sorted — Free ($0, 3 GCs) and Pro ($9/mo)... ],
//     subscription: { plan, status, current_period_end, cancel_at_period_end, has_billing },
//     usage:        { gcs_used, gcs_limit, unlimited, remaining, at_limit },
//     can_upgrade:  boolean
//   }
//   The usage meter renders gcs_used / gcs_limit; at_limit=true is the moment to show
//   "Upgrade to Pro — $9/mo" wired to POST /api/checkout.

import { createClient } from '@/lib/supabase/server'
import { apiError, apiSuccess } from '@/lib/db/api'

export const dynamic = 'force-dynamic'

type PlanRow = {
  code: string
  name: string
  price_monthly_cents: number
  max_gcs: number | null
  features: unknown
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return apiError(
      "You'll need to sign in to see your billing details. Log in and pick up right where you left off.",
      'UNAUTHORIZED',
      401
    )
  }

  const [subscriptionResult, plansResult, gcCountResult] = await Promise.all([
    supabase
      .from('subcompliance_subscriptions')
      .select('plan, status, current_period_end, cancel_at_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('subcompliance_plans')
      .select('code, name, price_monthly_cents, max_gcs, features')
      .eq('is_active', true)
      .order('sort_order', { ascending: true }),
    // Archived GC relationships don't count against the plan limit.
    supabase
      .from('subcompliance_gc_relationships')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'archived'),
  ])

  // The signup trigger creates a free subscription row; stay defensive anyway.
  const subscription = subscriptionResult.data ?? {
    plan: 'free',
    status: 'active',
    current_period_end: null,
    cancel_at_period_end: false,
    stripe_customer_id: null,
  }
  const plans = (plansResult.data ?? []) as PlanRow[]
  const gcsUsed = gcCountResult.count ?? 0

  const currentPlan: PlanRow =
    plans.find((p) => p.code === subscription.plan) ??
    plans.find((p) => p.code === 'free') ?? {
      code: 'free',
      name: 'Free',
      price_monthly_cents: 0,
      max_gcs: 3,
      features: [],
    }

  const gcsLimit = currentPlan.max_gcs // null = unlimited (Pro)
  const unlimited = gcsLimit === null || gcsLimit === undefined
  const remaining = unlimited ? null : Math.max((gcsLimit as number) - gcsUsed, 0)
  const atLimit = !unlimited && gcsUsed >= (gcsLimit as number)

  return apiSuccess({
    plan: {
      code: currentPlan.code,
      name: currentPlan.name,
      price_monthly_cents: currentPlan.price_monthly_cents,
      max_gcs: currentPlan.max_gcs ?? null,
      features: currentPlan.features ?? [],
    },
    plans: plans.map((p) => ({
      code: p.code,
      name: p.name,
      price_monthly_cents: p.price_monthly_cents,
      max_gcs: p.max_gcs ?? null,
      features: p.features ?? [],
    })),
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      // Internal ids stay server-side — the UI only needs to know billing exists.
      has_billing: Boolean(subscription.stripe_customer_id),
    },
    usage: {
      gcs_used: gcsUsed,
      gcs_limit: unlimited ? null : gcsLimit,
      unlimited,
      remaining,
      at_limit: atLimit,
    },
    can_upgrade: subscription.plan === 'free',
  })
}
