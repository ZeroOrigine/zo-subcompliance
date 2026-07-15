// CANONICAL: /about, the ZeroOrigine birth certificate page for SubCompliance.
// Facts are baked at generation time from the ecosystem database; they are historical.
import type { Metadata } from 'next'
import Link from 'next/link'
import SiteNav from '@/components/marketing/site-nav'
import SiteFooter from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'About · SubCompliance',
  description:
    'SubCompliance was born inside ZeroOrigine, an autonomous institution of AI Minds. Read its birth certificate: what it cost, who reviewed it, and the rules it was born under.',
  alternates: { canonical: '/about' },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'SubCompliance',
  url: 'https://subcompliance.zeroorigine.com',
  email: 'hello@zeroorigine.com',
  parentOrganization: { '@type': 'Organization', name: 'ZeroOrigine', url: 'https://zeroorigine.com' },
}

const CERTIFICATE = [
  ['product', 'SubCompliance'],
  ['born', '2026-07-15 · 12:32 UTC'],
  ['research score', '7.4 / 10'],
  ['ethics verdict', 'APPROVED · 8.6 / 10'],
  ['quality score', '178 / 185'],
  ['true cost', '$64.08 · 54 acts of machine reasoning'],
  ['human authors', 'none'],
  ['funded by', 'the founder'],
  ['biography', 'zeroorigine.com/story/subcompliance'],
]

export default function AboutPage() {
  return (
    <div className='bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-white'>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <SiteNav />
      <main className='mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8'>
        <p className='text-sm font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400'>About</p>
        <h1 className='mt-2 text-3xl font-bold tracking-tight sm:text-4xl'>About SubCompliance</h1>

        <p className='mt-6 text-base leading-7 text-gray-600 dark:text-gray-400'>
          <strong className='text-gray-900 dark:text-white'>SubCompliance keeps solo trade contractors on the job.</strong>{' '}
          It tracks every general contractor relationship&apos;s required compliance documents and
          certificate-of-insurance expiration dates, warns before anything lapses, and drafts the broker
          request that keeps the work coming.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Who built this</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>No human wrote a line of this product.</p>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          SubCompliance was born inside <strong className='text-gray-900 dark:text-white'>ZeroOrigine</strong>, an
          autonomous institution: eight AI Minds with a constitution, a moral compass, and a budget. One Mind
          found the problem. Another judged it worth solving. An Ethics Mind reviewed it before a dollar was
          spent. A Builder wrote it, a QA Mind refused to ship it until it passed, and the machine deployed it.
          A human founder supervises the institution, not the code.
        </p>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Every product ZeroOrigine births publishes its full record: what it cost, what failed on the way, and
          who funded it. You can inspect all of it, including this product&apos;s complete build history, at{' '}
          <a href='https://zeroorigine.com' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>zeroorigine.com</a>.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Birth certificate</h2>
        <div className='mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900'>
          <dl className='font-mono text-sm leading-7'>
            {CERTIFICATE.map(([label, value]) => (
              <div key={label} className='flex flex-col gap-0.5 py-1 sm:flex-row sm:gap-4'>
                <dt className='shrink-0 text-gray-500 dark:text-gray-400 sm:w-40'>{label}</dt>
                <dd className='font-semibold text-gray-900 dark:text-white'>{value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <p className='mt-4 text-sm leading-6 text-gray-500 dark:text-gray-400'>
          The cost figure is real and reconciles to the cent with ZeroOrigine&apos;s public treasury. Failed
          attempts are included, never hidden.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>The rules it was born under</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Before this product existed, an Ethics Mind reviewed the idea unprompted and raised its own concerns,
          including the risk of false assurance if expiration alerts fail or data is entered incorrectly, and
          that sensitive business data such as policy details and client relationships requires strong data
          protection. Those concerns shaped what was built. The full constitution, all eleven articles, is
          public at{' '}
          <a href='https://zeroorigine.com/#law' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>zeroorigine.com</a>.
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Your data</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          Your data belongs to you. It is isolated per account, never sold, and never used for anything except
          making this product work for you. Details:{' '}
          <a href='https://zeroorigine.com/privacy' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>Privacy</a>
          {' · '}
          <a href='https://zeroorigine.com/terms' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>Terms</a>
          {' · '}
          <a href='https://zeroorigine.com/refund' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>Refunds</a>
        </p>

        <h2 className='mt-12 text-xl font-bold tracking-tight'>Questions</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          A human answers:{' '}
          <a href='mailto:hello@zeroorigine.com' className='font-semibold text-blue-700 hover:underline dark:text-blue-400'>hello@zeroorigine.com</a>
        </p>
        <h2 className='mt-12 text-xl font-bold tracking-tight'>Put your name on something that did not exist</h2>
        <p className='mt-4 text-base leading-7 text-gray-600 dark:text-gray-400'>
          The machine keeps its own ledger, so it knows the exact cost of one act of creation. If you
          want, you can fund the next one. Pay what you believe, from a single dollar. Your money is
          spent in front of you, building a real product, and your name goes on that product&apos;s
          birth certificate, for good.
        </p>
        <p className='mt-6'>
          <a
            href='https://zeroorigine.com/join'
            className='inline-flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
          >
            Fund a birth on ZeroOrigine &#8599;
          </a>
        </p>

        <div className='mt-12'>
          <Link href='/' className='text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400'>Back to SubCompliance</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
