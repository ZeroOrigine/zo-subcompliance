// CANONICAL: SubCompliance marketing navigation: the shared sticky header for all marketing pages.
'use client'

import { useState } from 'react'
import Link from 'next/link'

const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '/#faq' },
  { label: 'About', href: '/about' },
]

export default function SiteNav() {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <header className='sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/90'>
      <nav aria-label='Main navigation' className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
        <Link href='/' onClick={close} className='flex items-center gap-2'>
          <span aria-hidden='true' className='flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 text-white'>
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-5 w-5'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M12 3l7 3v5c0 4.6-3 8.6-7 10-4-1.4-7-5.4-7-10V6l7-3z' />
              <path strokeLinecap='round' strokeLinejoin='round' d='M9.25 12.25l2 2 3.5-4' />
            </svg>
          </span>
          <span className='text-lg font-bold tracking-tight text-gray-900 dark:text-white'>
            Sub<span className='text-blue-700 dark:text-blue-400'>Compliance</span>
          </span>
        </Link>

        <div className='hidden items-center gap-8 md:flex'>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className='text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className='hidden items-center gap-3 md:flex'>
          <Link
            href='/login'
            className='inline-flex min-h-[44px] items-center rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 transition-colors hover:text-gray-900 dark:text-gray-300 dark:hover:text-white'
          >
            Log in
          </Link>
          <Link
            href='/signup'
            className='inline-flex min-h-[44px] items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800'
          >
            Get Started Free
          </Link>
        </div>

        <button
          type='button'
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls='mobile-menu'
          aria-label={open ? 'Close menu' : 'Open menu'}
          className='flex h-11 w-11 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 md:hidden'
        >
          {open ? (
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-6 w-6' aria-hidden='true'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M6 18L18 6M6 6l12 12' />
            </svg>
          ) : (
            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth={2} className='h-6 w-6' aria-hidden='true'>
              <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 6.75h16.5m-16.5 5.25h16.5m-16.5 5.25h16.5' />
            </svg>
          )}
        </button>
      </nav>

      {open && (
        <div id='mobile-menu' className='border-t border-gray-200 bg-white px-4 pb-6 pt-2 dark:border-gray-800 dark:bg-gray-950 md:hidden'>
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={close}
              className='block rounded-lg px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-900'
            >
              {link.label}
            </Link>
          ))}
          <div className='mt-4 flex flex-col gap-3'>
            <Link
              href='/login'
              onClick={close}
              className='inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 dark:border-gray-600 dark:text-white dark:hover:bg-gray-900'
            >
              Log in
            </Link>
            <Link
              href='/signup'
              onClick={close}
              className='inline-flex min-h-[44px] items-center justify-center rounded-lg bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-800'
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
