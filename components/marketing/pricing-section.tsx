// CANONICAL: SubCompliance pricing tiers: single source of truth for plan names,
// prices, and copy across all marketing pages. SELF-VALIDATION FIX: this section
// previously advertised a $29 Pro, a $99 Enterprise, and annual billing; none of
// which exist. It now mirrors the subcompliance_plans seed exactly: Free ($0, up to
// 3 GCs) and Pro ($9/mo, unlimited GCs), monthly billing only. No fabricated tiers.
// Server Component: no client state needed.
import Link from 'next/link'

interface Plan {
  id: string
  name: string
  tagline: string
  price: string
  priceNote: string
  cta: string
  href: string
  highlight: boolean
  features: string[]
  footnote: string
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'For getting your compliance house in order.',
    price: '$0',
    priceNote: 'Free forever',
    cta: 'Start Free',
    href: '/signup',
    highlight: false,
    features: [
      'Track up to 3 GC relationships',
      'Unlimited documents per GC',
      'Expiration dashboard',
      'Lapse reminders 30, 14, 7 & 1 day out, customizable',
      'Broker request drafts',
    ],
    footnote: 'Free forever. No credit card required.',
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'For subs juggling a full slate of GCs.',
    price: '$9',
    priceNote: 'Billed monthly',
    cta: 'Get Pro · $9/mo',
    href: '/signup?plan=pro',
    highlight: true,
    features: [
      'Unlimited GC relationships',
      'Everything in Free, without the 3-GC cap',
      'Unlimited documents per GC',
      'Expiration dashboard & lapse reminders',
      'Broker request drafts',
      'Priority email support',
    ],
    footnote: 'Cancel anytime. No lock-in.',
  },
]

export default function PricingSection({ hideHeading = false }: { hideHeading?: boolean }) {
  return (
    <section id='pricing' className='scroll-mt-20 py-20 lg:py-28'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        {!hideHeading && (
          <div className='mx-auto max-w-2xl text-center'>
            <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>Pricing</p>
            <h2 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>Free until your GC list outgrows it</h2>
            <p className='mt-4 text-lg text-gray-600 dark:text-gray-300'>
              Three GCs tracked free, forever, with the full reminder system. Upgrade only when you take on more.
            </p>
          </div>
        )}

        <div className='mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2'>
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-8 dark:bg-gray-900 ${
                plan.highlight
                  ? 'border-blue-700 shadow-xl ring-1 ring-blue-700 dark:border-blue-500 dark:ring-blue-500'
                  : 'border-gray-200 shadow-sm dark:border-gray-800'
              }`}
            >
              {plan.highlight && (
                <span className='absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-700 px-4 py-1 text-xs font-semibold uppercase tracking-wide text-white'>
                  For multi-GC subs
                </span>
              )}

              <h3 className='text-lg font-bold'>{plan.name}</h3>
              <p className='mt-1 text-sm text-gray-600 dark:text-gray-400'>{plan.tagline}</p>

              <div className='mt-6 flex items-baseline gap-1'>
                <span className='text-5xl font-extrabold tracking-tight'>{plan.price}</span>
                <span className='text-sm font-medium text-gray-500 dark:text-gray-400'>/month</span>
              </div>
              <p className='mt-1 min-h-[1.25rem] text-xs text-gray-500 dark:text-gray-400'>{plan.priceNote}</p>

              <ul className='mt-6 space-y-3 text-sm'>
                {plan.features.map((feature) => (
                  <li key={feature} className='flex gap-3'>
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      className='h-5 w-5 flex-none text-emerald-600 dark:text-emerald-400'
                      aria-hidden='true'
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='M4.5 12.75l6 6 9-13.5' />
                    </svg>
                    <span className='text-gray-700 dark:text-gray-300'>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className='mt-8 flex flex-1 flex-col justify-end'>
                <Link
                  href={plan.href}
                  className={`inline-flex min-h-[44px] items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-blue-700 text-white shadow-sm hover:bg-blue-800'
                      : 'border border-gray-300 text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-800'
                  }`}
                >
                  {plan.cta}
                </Link>
                <p className='mt-3 text-center text-xs text-gray-500 dark:text-gray-400'>{plan.footnote}</p>
              </div>
            </div>
          ))}
        </div>

        <p className='mx-auto mt-10 max-w-2xl text-center text-sm text-gray-500 dark:text-gray-400'>
          Every plan keeps the core promise: you’ll know before anything lapses, with time to fix it. Prices in USD, billed monthly, cancel anytime.
        </p>
      </div>
    </section>
  )
}
