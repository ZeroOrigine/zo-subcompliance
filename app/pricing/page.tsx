// CANONICAL: SubCompliance pricing page: single source of truth for the /pricing route.
// SELF-VALIDATION FIX: metadata and FAQs previously referenced $29/$99 tiers and annual
// billing that don't exist. Now aligned with the real plans: Free and Pro ($9/mo).
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/components/marketing/site-nav'
import PricingSection from '@/components/marketing/pricing-section'
import SiteFooter from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'Pricing | SubCompliance',
  description:
    'Start free with 3 GC relationships, unlimited documents, and full expiration reminders. Upgrade to Pro ($9/mo) for unlimited GCs when your list grows. No credit card required to start.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'SubCompliance Pricing | Free and Pro',
    description:
      'A genuinely useful free plan for subs with up to 3 GCs. Pro at $9/mo for unlimited GC relationships. Cancel anytime.',
    url: '/pricing',
    siteName: 'SubCompliance',
    type: 'website',
  },
}

const BILLING_FAQS = [
  {
    question: 'Is the Free plan a trial?',
    answer:
      'No. It never expires. Free includes 3 GC relationships, unlimited documents and expiration dates, and the full reminder system (30, 14, 7, and 1 day out by default, customizable). We don’t do time-boxed trials: the Free plan is the trial, and it lasts forever. Upgrade only when you need more.',
  },
  {
    question: 'What happens if I outgrow Free?',
    answer:
      'When you add a fourth active GC, we’ll ask you to upgrade to Pro ($9/mo). Nothing is deleted: your documents and reminders for the GCs you already track stay exactly as they are, and archiving a GC you no longer work with frees the slot.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Yes. Manage or cancel your Pro subscription from the billing page whenever you like; you drop back to Free at the end of the period. Your data stays yours either way.',
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'Major credit and debit cards, processed securely by Stripe. We never see or store your card number.',
  },
]

export default function PricingPage() {
  return (
    <div className='bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100'>
      <SiteNav />

      <main>
        <section className='mx-auto max-w-3xl px-4 pb-2 pt-16 text-center sm:px-6 lg:px-8 lg:pt-24'>
          <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>Pricing</p>
          <h1 className='mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl'>Pricing that respects a sub’s margins</h1>
          <p className='mt-4 text-lg text-gray-600 dark:text-gray-300'>
            The Free plan is genuinely useful: 3 GCs, unlimited documents, full reminders, forever. Pro is $9/mo when your GC list outgrows it.
          </p>
        </section>

        <PricingSection hideHeading />

        <section aria-labelledby='billing-faq-heading' className='bg-gray-50 py-20 dark:bg-gray-900/40'>
          <div className='mx-auto max-w-3xl px-4 sm:px-6 lg:px-8'>
            <h2 id='billing-faq-heading' className='text-center text-3xl font-bold tracking-tight'>
              Billing questions, answered straight
            </h2>
            <div className='mt-12 space-y-4'>
              {BILLING_FAQS.map((faq) => (
                <details key={faq.question} className='group rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900'>
                  <summary className='flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-semibold [&::-webkit-details-marker]:hidden'>
                    {faq.question}
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth={2}
                      className='h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180'
                      aria-hidden='true'
                    >
                      <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 8.25l-7.5 7.5-7.5-7.5' />
                    </svg>
                  </summary>
                  <p className='mt-4 text-sm leading-7 text-gray-600 dark:text-gray-400'>{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className='py-20'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-gray-900 px-6 py-14 text-center sm:px-16'>
              <h2 className='text-3xl font-bold tracking-tight text-white'>Start where every sub should: free.</h2>
              <p className='mx-auto mt-3 max-w-xl text-lg text-blue-100'>
                Add your first GC, list what they require, and let SubCompliance do the remembering.
              </p>
              <div className='mt-7'>
                <Link
                  href='/signup'
                  className='inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-800 shadow-sm transition-colors hover:bg-blue-50'
                >
                  Get Started Free
                </Link>
              </div>
              <p className='mt-4 text-sm text-blue-200'>No credit card required.</p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
