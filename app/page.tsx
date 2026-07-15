// CANONICAL: SubCompliance marketing landing page: single source of truth for the home route (/).
// SELF-VALIDATION FIX: JSON-LD offers and FAQ copy previously referenced $29/$99 tiers that don't
// exist; reminder copy now matches the real default schedule (30/14/7/1, customizable).
// Server Component. All marketing sections are inline; only shared nav/pricing/footer are imported.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/components/marketing/site-nav'
import PricingSection from '@/components/marketing/pricing-section'
import SiteFooter from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: 'SubCompliance | Never Get Pulled Off a Job for a Lapsed COI',
  description:
    'SubCompliance tracks the insurance and compliance requirements every general contractor puts on you (COIs, endorsements, licenses), warns you weeks before anything expires, and drafts the broker request that keeps you on the job. Free for your first 3 GCs.',
  keywords: [
    'certificate of insurance tracker',
    'COI tracking for subcontractors',
    'contractor compliance software',
    'COI expiration reminders',
    'subcontractor insurance compliance',
  ],
  alternates: { canonical: '/' },
  openGraph: {
    title: 'SubCompliance | Never get pulled off a job for a lapsed COI',
    description:
      'COI and compliance tracking built for the contractor being tracked, not the GC doing the tracking. Free for your first 3 GCs, no credit card required.',
    url: '/',
    siteName: 'SubCompliance',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'SubCompliance | COI & compliance tracking for trade contractors',
    description:
      'Track every GC’s requirements, get warned before anything lapses, and send the broker request in one click.',
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'SubCompliance',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Certificate-of-insurance and compliance tracking built for solo trade contractors. Tracks every general-contractor relationship’s required documents and expiration dates, warns before anything lapses, and drafts the broker request that keeps contractors on the job.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: '9', priceCurrency: 'USD' },
  ],
}

const TRADES = ['Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Concrete', 'Framing', 'Drywall', 'Painting']

const GC_ROWS = [
  {
    gc: 'Meridian Builders',
    doc: 'General Liability COI',
    due: 'expires in 43 days',
    status: 'On track',
    statusClass: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  },
  {
    gc: 'Northside Construction',
    doc: 'Workers’ Comp certificate',
    due: 'expires in 12 days',
    status: 'Renewal window',
    statusClass: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  },
  {
    gc: 'Harbor Development Co.',
    doc: 'Auto Liability COI',
    due: 'expires in 6 days',
    status: 'Request sent',
    statusClass: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  },
]

const FEATURES = [
  {
    title: 'Every GC, one dashboard',
    description:
      'Each general contractor you work under gets its own card: required documents, coverage limits, endorsements, and current status at a glance.',
    icon: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  },
  {
    title: 'Early-warning reminders',
    description:
      'Alerts at 30, 14, 7, and 1 day before any certificate, endorsement, or license expires, long before the GC’s compliance office notices. Timing is fully customizable.',
    icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0',
  },
  {
    title: 'Broker requests, drafted',
    description:
      'One click turns a looming expiration into a renewal request with the GC’s exact requirements (limits, additional insureds, endorsements), ready to send to your broker.',
    icon: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  },
  {
    title: 'Per-GC requirement checklists',
    description:
      'GL limits, waivers of subrogation, W-9s, licenses: tracked item by item, per relationship, so “compliant” always means what that GC says it means.',
    icon: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    title: 'The next 90 days, mapped',
    description:
      'A renewal timeline shows every deadline coming your way across all your GCs, so nothing ambushes you mid-project.',
    icon: 'M8 3v3m8-3v3M4 8.25h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  },
  {
    title: 'Your documents, on hand',
    description:
      'Keep current copies of every certificate in one place. When a GC asks for proof, it’s one tap away instead of a call to your broker.',
    icon: 'M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z',
  },
]

const STEPS = [
  {
    number: '1',
    title: 'Add your GCs',
    description:
      'List each general contractor you work under and what they require: COI limits, endorsements, W-9s, licenses. About a minute per GC.',
  },
  {
    number: '2',
    title: 'We watch every date',
    description:
      'SubCompliance tracks every expiration across every relationship and warns you 30, 14, 7, and 1 day out, before anyone else notices.',
  },
  {
    number: '3',
    title: 'Renew before it matters',
    description:
      'Send the pre-drafted broker request, upload the fresh certificate, and stay on the schedule. No scramble, no gate turn-away.',
  },
]

const SCENARIOS = [
  {
    label: 'The Friday-deadline email',
    quote: '“Send an updated COI by end of day Friday or you’re off next week’s schedule.”',
    answer:
      'SubCompliance warns you 30, 14, 7, and 1 day before every expiration, so the renewal is handled before the compliance office ever writes that email.',
  },
  {
    label: 'The requirements maze',
    quote: '“Every GC wants different limits, different additional insureds, different endorsements.”',
    answer:
      'Each GC relationship gets its own requirement checklist. You always know exactly what “compliant” means for that GC, on that job.',
  },
  {
    label: 'The broker back-and-forth',
    quote: '“I know my policy renews soon. I just never remember what each GC needs on the cert.”',
    answer:
      'One click drafts the broker request with the exact requirements for that GC: limits, endorsements, certificate holder details. Forward it and get back to work.',
  },
]

const FAQS = [
  {
    question: 'Is the free plan actually useful, or just a demo?',
    answer:
      'It’s the real product. You get 3 GC relationships, unlimited documents and expiration dates, the full reminder system (30, 14, 7, and 1 day out by default, customizable), and broker request drafts. Free forever, no credit card. If you work under three or fewer GCs, you may never need to pay us.',
  },
  {
    question: 'What counts as a “GC relationship”?',
    answer:
      'Any company you have to stay compliant for: a general contractor, construction manager, or property manager. Each relationship gets its own requirement checklist, documents, and expiration dates, because every GC asks for something different.',
  },
  {
    question: 'Does SubCompliance replace my insurance broker?',
    answer:
      'No. It makes working with your broker faster. When a renewal is coming, SubCompliance drafts the request with the exact requirements for that GC (limits, endorsements, certificate holder details) so your broker gets everything right the first time. It works with any broker or carrier.',
  },
  {
    question: 'Is my insurance information secure?',
    answer:
      'Yes. Your documents are stored encrypted and isolated to your account with row-level security. Your files stay yours, and we never share or sell your data.',
  },
  {
    question: 'Can I export my documents and data?',
    answer:
      'Anytime. Your certificates and compliance records are yours: download your files whenever you want. No lock-in, ever.',
  },
  {
    question: 'What if I need help getting set up?',
    answer:
      'Email support is included on every plan, and Pro gets priority responses. Setup is designed to take minutes: add a GC, list what they require, done.',
  },
]

export default function HomePage() {
  return (
    <div className='bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100'>
      <style>{`
        @keyframes sc-fade-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sc-fade-up { animation: sc-fade-up 0.7s ease-out both; }
        .sc-delay-1 { animation-delay: 0.1s; }
        .sc-delay-2 { animation-delay: 0.2s; }
        @supports (animation-timeline: view()) {
          .sc-scroll-fade {
            animation: sc-fade-up linear both;
            animation-timeline: view();
            animation-range: entry 0% entry 35%;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .sc-fade-up, .sc-scroll-fade { animation: none; }
        }
      `}</style>

      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <SiteNav />

      <main>
        {/* ============ HERO ============ */}
        <section className='relative overflow-hidden'>
          <div aria-hidden='true' className='pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl' />
          <div aria-hidden='true' className='pointer-events-none absolute -left-24 top-40 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl' />

          <div className='relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-14 px-4 pb-24 pt-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:pb-32 lg:pt-24'>
            <div className='sc-fade-up'>
              <p className='inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300'>
                <span aria-hidden='true' className='h-1.5 w-1.5 rounded-full bg-amber-500' />
                Built for subs, not for GCs
              </p>

              <h1 className='mt-6 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl'>
                Never get pulled off a job for a{' '}
                <span className='text-blue-700 underline decoration-amber-400 decoration-4 underline-offset-4 dark:text-blue-400'>lapsed COI</span>.
              </h1>

              <p className='mt-6 max-w-xl text-lg text-gray-600 dark:text-gray-300 lg:text-xl'>
                SubCompliance tracks the insurance and compliance requirements every general contractor puts on you, warns you weeks before anything expires, and drafts the broker request that keeps you working.
              </p>

              <div className='mt-8 flex flex-col gap-3 sm:flex-row sm:items-center'>
                <Link
                  href='/signup'
                  className='inline-flex min-h-[48px] items-center justify-center rounded-lg bg-blue-700 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700'
                >
                  Get Started Free
                </Link>
                <Link
                  href='#how-it-works'
                  className='inline-flex min-h-[48px] items-center justify-center rounded-lg border border-gray-300 bg-white px-7 py-3.5 text-base font-semibold text-gray-900 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:bg-transparent dark:text-white dark:hover:bg-gray-900'
                >
                  See how it works
                </Link>
              </div>

              <div className='mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-gray-500 dark:text-gray-400'>
                {['No credit card required', 'Free for your first 3 GCs', 'Cancel anytime'].map((item) => (
                  <span key={item} className='inline-flex items-center gap-1.5'>
                    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-4 w-4 text-emerald-600' aria-hidden='true'>
                      <path strokeLinecap='round' strokeLinejoin='round' d='M4.5 12.75l6 6 9-13.5' />
                    </svg>
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* Hero visual: illustrative dashboard mock (sample data, honestly labeled) */}
            <div className='sc-fade-up sc-delay-2 relative mx-auto w-full max-w-lg'>
              <div aria-hidden='true' className='absolute -inset-6 rounded-3xl bg-gradient-to-tr from-blue-600/20 via-amber-400/20 to-emerald-500/20 blur-2xl' />
              <div className='relative rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900'>
                <div className='flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-800'>
                  <p className='text-sm font-semibold'>Your GC relationships</p>
                  <span className='text-[10px] font-semibold uppercase tracking-widest text-gray-400'>Sample data</span>
                </div>
                <ul className='divide-y divide-gray-100 dark:divide-gray-800'>
                  {GC_ROWS.map((row) => (
                    <li key={row.gc} className='flex items-center justify-between gap-3 px-5 py-4'>
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold'>{row.gc}</p>
                        <p className='truncate text-xs text-gray-500 dark:text-gray-400'>
                          {row.doc} · {row.due}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${row.statusClass}`}>{row.status}</span>
                    </li>
                  ))}
                </ul>
                <div className='flex items-center gap-2 rounded-b-2xl bg-gray-50 px-5 py-3 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-300'>
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-4 w-4 shrink-0 text-amber-500' aria-hidden='true'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' />
                  </svg>
                  <span>
                    Next reminder: <strong className='font-semibold'>14 days</strong> before Northside’s Workers’ Comp expires
                  </span>
                </div>
              </div>
              <div className='absolute -bottom-5 left-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium shadow-lg dark:border-gray-700 dark:bg-gray-900 sm:-left-6'>
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-4 w-4 text-emerald-600' aria-hidden='true'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M4.5 12.75l6 6 9-13.5' />
                </svg>
                Broker request drafted · ready to send
              </div>
              <p className='sr-only'>
                Illustration of the SubCompliance dashboard showing three general contractor relationships with tracked documents, expiration countdowns, and reminder status. Sample data for demonstration.
              </p>
            </div>
          </div>
        </section>

        {/* ============ TRADES BAR (honest social-proof slot) ============ */}
        <section aria-label='Who SubCompliance is built for' className='border-y border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50'>
          <div className='mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8'>
            <p className='text-center text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400'>
              Built for every trade that answers to a general contractor: 3M+ subs in the US
            </p>
            <div className='mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3'>
              {TRADES.map((trade) => (
                <span key={trade} className='text-sm font-bold uppercase tracking-wide text-gray-400 dark:text-gray-600'>
                  {trade}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <section id='features' className='scroll-mt-20 py-20 lg:py-28'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='sc-scroll-fade mx-auto max-w-2xl text-center'>
              <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>Features</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>Everything you need to stay on every job</h2>
              <p className='mt-4 text-lg text-gray-600 dark:text-gray-300'>
                myCOI, TrustLayer, and the rest were built for the GC doing the tracking. SubCompliance is a command center for the contractor being tracked.
              </p>
            </div>

            <div className='mt-16 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3'>
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className='sc-scroll-fade rounded-2xl border border-gray-200 bg-white p-8 transition-shadow hover:shadow-md dark:border-gray-800 dark:bg-gray-900'
                >
                  <span className='flex h-11 w-11 items-center justify-center rounded-lg bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' aria-hidden='true'>
                    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={1.5} className='h-6 w-6'>
                      <path strokeLinecap='round' strokeLinejoin='round' d={feature.icon} />
                    </svg>
                  </span>
                  <h3 className='mt-5 text-lg font-bold'>{feature.title}</h3>
                  <p className='mt-2 text-sm leading-6 text-gray-600 dark:text-gray-400'>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ HOW IT WORKS ============ */}
        <section id='how-it-works' className='scroll-mt-20 bg-gray-50 py-20 dark:bg-gray-900/40 lg:py-28'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='sc-scroll-fade mx-auto max-w-2xl text-center'>
              <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>How it works</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>From spreadsheet dread to lapse-proof in three steps</h2>
              <p className='mt-4 text-lg text-gray-600 dark:text-gray-300'>
                Your first GC is tracked within minutes of signing up. Everything after that is the product doing the remembering.
              </p>
            </div>

            <div className='relative mt-16'>
              <div aria-hidden='true' className='absolute left-[16%] right-[16%] top-7 hidden h-0.5 bg-gradient-to-r from-blue-200 via-blue-500 to-blue-200 dark:from-blue-900 dark:via-blue-500 dark:to-blue-900 md:block' />
              <div className='grid grid-cols-1 gap-12 md:grid-cols-3'>
                {STEPS.map((step) => (
                  <div key={step.number} className='sc-scroll-fade text-center'>
                    <div className='relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-xl font-bold text-white ring-8 ring-gray-50 dark:ring-gray-900'>
                      {step.number}
                    </div>
                    <h3 className='mt-6 text-lg font-bold'>{step.title}</h3>
                    <p className='mx-auto mt-2 max-w-xs text-sm leading-6 text-gray-600 dark:text-gray-400'>{step.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className='mt-14 text-center'>
              <Link
                href='/signup'
                className='inline-flex min-h-[48px] items-center justify-center rounded-lg bg-blue-700 px-7 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-800'
              >
                Track your first GC free
              </Link>
              <p className='mt-3 text-sm text-gray-500 dark:text-gray-400'>No credit card required.</p>
            </div>
          </div>
        </section>

        {/* ============ PRICING ============ */}
        <PricingSection />

        {/* ============ SOUND FAMILIAR? (honest scenarios, no fabricated testimonials) ============ */}
        <section aria-labelledby='why-heading' className='bg-gray-50 py-20 dark:bg-gray-900/40 lg:py-28'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='sc-scroll-fade mx-auto max-w-2xl text-center'>
              <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>Sound familiar?</p>
              <h2 id='why-heading' className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>
                Built around the moments that cost subs real money
              </h2>
              <p className='mt-4 text-lg text-gray-600 dark:text-gray-300'>
                We built SubCompliance around three situations every multi-GC sub knows by heart.
              </p>
            </div>

            <div className='mt-16 grid grid-cols-1 gap-8 md:grid-cols-3'>
              {SCENARIOS.map((scenario) => (
                <div key={scenario.label} className='sc-scroll-fade flex flex-col rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-gray-900'>
                  <p className='text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400'>{scenario.label}</p>
                  <blockquote className='mt-4 border-l-4 border-amber-400 pl-4 text-base font-medium italic leading-7'>
                    {scenario.quote}
                  </blockquote>
                  <p className='mt-5 text-sm leading-6 text-gray-600 dark:text-gray-400'>{scenario.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ============ FAQ ============ */}
        <section id='faq' className='scroll-mt-20 py-20 lg:py-28'>
          <div className='mx-auto max-w-3xl px-4 sm:px-6 lg:px-8'>
            <div className='sc-scroll-fade text-center'>
              <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>FAQ</p>
              <h2 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>Questions subs actually ask</h2>
            </div>

            <div className='mt-12 space-y-4'>
              {FAQS.map((faq) => (
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

        {/* ============ FINAL CTA ============ */}
        <section className='pb-20 lg:pb-28'>
          <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
            <div className='relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-800 to-gray-900 px-6 py-16 text-center sm:px-16 lg:py-20'>
              <div aria-hidden='true' className='pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-blue-500/30 blur-3xl' />
              <h2 className='relative text-3xl font-bold tracking-tight text-white sm:text-4xl'>
                Your next expiration date is already on the calendar.
              </h2>
              <p className='relative mx-auto mt-4 max-w-2xl text-lg text-blue-100'>
                Working under five GCs can mean a dozen renewal deadlines a year, and any one of them can pull you off a job. Get ahead of every deadline in the next few minutes.
              </p>
              <div className='relative mt-8'>
                <Link
                  href='/signup'
                  className='inline-flex min-h-[48px] items-center justify-center rounded-lg bg-white px-8 py-4 text-base font-semibold text-blue-800 shadow-sm transition-colors hover:bg-blue-50'
                >
                  Get Started Free
                </Link>
              </div>
              <p className='relative mt-4 text-sm text-blue-200'>
                No credit card required · Free for your first 3 GCs · Cancel anytime
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  )
}
