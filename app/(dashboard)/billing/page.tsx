'use client'

// CANONICAL — Billing: current plan, GC-slot usage, honest upgrade to Pro.
// Reads plan/plans/subscription/usage from the canonical GET /api/billing/status
// endpoint (QA-014: no direct Supabase reads here, so the views can't drift);
// checkout goes to POST /api/checkout, the portal to POST /api/billing/portal.

import { useEffect, useState } from 'react'
import { cx, formatDate } from '@/lib/core/format'
import { BTN_PRIMARY, BTN_SECONDARY, Toast, type ToastState } from '@/components/dashboard/ui'

interface PlanView {
  code: string
  name: string
  price_monthly_cents: number
  max_gcs: number | null
  features: string[]
  sort_order: number
}

interface SubscriptionView {
  plan: string
  status: string
  current_period_end: string | null
  cancel_at_period_end: boolean
}

interface BillingUsageView {
  gc_count?: number
  gcs?: number
  gcs_used?: number
  active_gcs?: number
  used?: number
  count?: number
}

interface BillingStatusPayload {
  plan?: string | { code?: string } | null
  plans?: PlanView[] | null
  subscription?: SubscriptionView | null
  usage?: BillingUsageView | null
}

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(0)}`
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionView | null>(null)
  const [effectivePlan, setEffectivePlan] = useState<string | null>(null)
  const [plans, setPlans] = useState<PlanView[]>([])
  const [gcCount, setGcCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    let active = true
    async function loadBilling() {
      try {
        const response = await fetch('/api/billing/status', { cache: 'no-store' })
        const payload = (await response.json().catch(() => null)) as
          | (BillingStatusPayload & { data?: BillingStatusPayload })
          | null
        const status = payload?.data ?? payload
        if (!active) return
        if (!response.ok || !status) {
          setLoadError("We couldn't load your billing details. Refresh to try again.")
          return
        }
        setSubscription(status.subscription ?? null)
        setPlans(Array.isArray(status.plans) ? status.plans : [])
        setEffectivePlan(typeof status.plan === 'string' ? status.plan : status.plan?.code ?? null)
        const usage = status.usage
        const used =
          usage?.gc_count ?? usage?.gcs ?? usage?.gcs_used ?? usage?.active_gcs ?? usage?.used ?? usage?.count
        setGcCount(typeof used === 'number' ? used : 0)
        setLoadError(null)
      } catch {
        if (active) setLoadError("We couldn't load your billing details. Refresh to try again.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void loadBilling()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  const currentPlanCode =
    effectivePlan ??
    (subscription && ['active', 'trialing'].includes(subscription.status) ? subscription.plan : 'free')
  const currentPlan = plans.find((plan) => plan.code === currentPlanCode) ?? null
  const paymentTrouble = subscription ? ['past_due', 'unpaid'].includes(subscription.status) : false

  async function startCheckout(planCode: string) {
    setCheckoutLoading(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planCode }),
      })
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; data?: { url?: string } }
        | null
      const url = payload?.data?.url ?? payload?.url
      if (!response.ok || !url) throw new Error('checkout unavailable')
      window.location.href = url
    } catch {
      setToast({ tone: 'error', message: "Checkout didn't open. Give it another try in a moment." })
      setCheckoutLoading(false)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; data?: { url?: string }; error?: string }
        | null
      const url = payload?.data?.url ?? payload?.url
      if (!response.ok || !url) {
        setToast({
          tone: 'error',
          message: payload?.error ?? "The billing portal didn't open. Try again in a moment.",
        })
        setPortalLoading(false)
        return
      }
      window.location.href = url
    } catch {
      setToast({ tone: 'error', message: "The billing portal didn't open. Try again in a moment." })
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your billing details">
        <div className="sc-skeleton h-9 w-40" />
        <div className="sc-skeleton h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="sc-skeleton h-80 w-full" />
          <div className="sc-skeleton h-80 w-full" />
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="sc-rise mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h2 className="text-xl text-slate-900">We couldn&apos;t load billing</h2>
        <p className="mt-2 text-sm text-slate-500">{loadError}</p>
      </div>
    )
  }

  const maxGcs = currentPlan?.max_gcs ?? (currentPlanCode === 'free' ? 3 : null)
  const atLimit = maxGcs !== null && gcCount >= maxGcs

  return (
    <div className="space-y-6">
      <header className="sc-rise">
        <h1 className="text-2xl text-slate-900 sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pricing scales with the only thing that matters: how many GCs keep a list on you.
        </p>
      </header>

      {paymentTrouble && (
        <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-semibold text-red-900">
            Your last payment didn&apos;t go through. Update your card in the billing portal to keep Pro running.
          </p>
          <button type="button" onClick={() => void openPortal()} disabled={portalLoading} className={cx(BTN_PRIMARY, 'mt-3')}>
            {portalLoading ? 'Opening…' : 'Open billing portal'}
          </button>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg text-slate-900">GC relationships</h2>
            <p className="mt-1 text-sm text-slate-500">
              {maxGcs !== null
                ? `${gcCount} of ${maxGcs} slots used on the ${currentPlan?.name ?? 'Free'} plan`
                : `${gcCount} tracked — unlimited on ${currentPlan?.name ?? 'Pro'}`}
            </p>
          </div>
          {atLimit && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              At the limit
            </span>
          )}
        </div>
        {maxGcs !== null && (
          <div className="mt-4 flex gap-1.5" aria-hidden="true">
            {Array.from({ length: maxGcs }).map((_, index) => (
              <div
                key={index}
                className={cx(
                  'h-2.5 flex-1 rounded-full',
                  index < gcCount ? (atLimit ? 'bg-amber-500' : 'bg-emerald-500') : 'bg-slate-200'
                )}
              />
            ))}
          </div>
        )}
        {atLimit && (
          <p className="mt-3 text-sm text-slate-500">
            You&apos;re at the Free limit — Pro removes it for {formatPrice(plans.find((p) => p.code === 'pro')?.price_monthly_cents ?? 900)}/mo.
          </p>
        )}
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {plans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode
          const isPro = plan.code === 'pro'
          return (
            <div
              key={plan.code}
              className={cx(
                'flex flex-col rounded-2xl border bg-white p-6 shadow-sm',
                isPro ? 'border-amber-400 ring-1 ring-amber-400' : 'border-slate-200'
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
                {isCurrent && (
                  <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-2">
                <span className="font-display text-3xl font-bold text-slate-900">
                  {formatPrice(plan.price_monthly_cents)}
                </span>
                <span className="text-sm text-slate-500">/month</span>
              </p>
              <ul className="mt-4 flex-1 space-y-2.5">
                {(plan.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {isCurrent ? (
                  <button type="button" disabled className={cx(BTN_SECONDARY, 'w-full')}>
                    Your current plan
                  </button>
                ) : isPro ? (
                  <button
                    type="button"
                    onClick={() => void startCheckout(plan.code)}
                    disabled={checkoutLoading}
                    className={cx(BTN_PRIMARY, 'w-full')}
                  >
                    {checkoutLoading ? 'Opening checkout…' : `Upgrade to Pro — ${formatPrice(plan.price_monthly_cents)}/mo`}
                  </button>
                ) : (
                  <p className="text-center text-sm text-slate-400">
                    Included with every account. Manage downgrades in the billing portal.
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </section>

      {currentPlanCode !== 'free' && subscription && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">Manage your subscription</h2>
          <p className="mt-1 text-sm text-slate-500">
            {subscription.cancel_at_period_end
              ? `Your plan ends ${formatDate(subscription.current_period_end?.slice(0, 10) ?? null)} — you'll drop to Free after that.`
              : subscription.current_period_end
                ? `Renews ${formatDate(subscription.current_period_end.slice(0, 10))}. Cancel anytime — no lock-in.`
                : 'Cancel anytime — no lock-in.'}
          </p>
          <button type="button" onClick={() => void openPortal()} disabled={portalLoading} className={cx(BTN_SECONDARY, 'mt-4')}>
            {portalLoading ? 'Opening…' : 'Open billing portal'}
          </button>
        </section>
      )}

      <p className="text-xs text-slate-400">Payments are handled securely by Stripe.</p>

      {toast && <Toast toast={toast} />}
    </div>
  )
}
