// CANONICAL: SubCompliance marketing footer — the shared footer for all marketing pages.
import Link from 'next/link'

const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/#faq' },
]

const ACCOUNT_LINKS = [
  { label: 'Log in', href: '/login' },
  { label: 'Create free account', href: '/signup' },
]

const COMPANY_LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
]

export default function SiteFooter() {
  return (
    <footer className='border-t border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950'>
      <div className='mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-10 md:grid-cols-4'>
          <div className='md:pr-8'>
            <div className='flex items-center gap-2'>
              <span aria-hidden='true' className='flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 text-white'>
                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-4 w-4'>
                  <path strokeLinecap='round' strokeLinejoin='round' d='M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z' />
                  <path strokeLinecap='round' strokeLinejoin='round' d='M9.25 12.25l2 2 3.5-4' />
                </svg>
              </span>
              <span className='text-lg font-bold tracking-tight text-gray-900 dark:text-white'>
                Sub<span className='text-blue-700 dark:text-blue-400'>Compliance</span>
              </span>
            </div>
            <p className='mt-3 text-sm leading-6 text-gray-600 dark:text-gray-400'>
              Compliance tracking built for the contractor being tracked — not the GC doing the tracking.
            </p>
          </div>

          <nav aria-label='Product'>
            <h3 className='text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white'>Product</h3>
            <ul className='mt-4 space-y-3'>
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className='text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label='Account'>
            <h3 className='text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white'>Account</h3>
            <ul className='mt-4 space-y-3'>
              {ACCOUNT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className='text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label='Company'>
            <h3 className='text-sm font-semibold uppercase tracking-wider text-gray-900 dark:text-white'>Company</h3>
            <ul className='mt-4 space-y-3'>
              {COMPANY_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className='text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href='mailto:support@subcompliance.zeroorigine.com'
                  className='text-sm text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                >
                  Contact support
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className='mt-12 flex flex-col items-center justify-between gap-4 border-t border-gray-200 pt-8 dark:border-gray-800 sm:flex-row'>
          <p className='text-sm text-gray-500 dark:text-gray-400'>© {new Date().getFullYear()} SubCompliance. All rights reserved.</p>
          <p className='text-sm text-gray-500 dark:text-gray-400'>Built with care for the trades.</p>
        </div>
      </div>
    </footer>
  )
}
