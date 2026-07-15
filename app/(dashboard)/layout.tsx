'use client'

// CANONICAL — SubCompliance dashboard shell: sidebar navigation, mobile drawer,
// signed-in identity, sign out, and the ONE /api/profile fetch (ProfileProvider).
// Route protection is enforced server-side by middleware.ts; the client-side
// getUser check here is a friendly backup, not the gate.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { cx } from '@/lib/core/format'
import { FOCUS_RING } from '@/components/dashboard/ui'
import { ProfileProvider } from '@/lib/core/profile-context'

interface NavItem {
  href: string
  label: string
  icon: ReactNode
}

const NAV_ITEMS: NavItem[] = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75" />
      </svg>
    ),
  },
  {
    href: '/gcs',
    label: 'General Contractors',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
  },
  {
    href: '/settings',
    label: 'Settings',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
      </svg>
    ),
  },
  {
    href: '/billing',
    label: 'Billing',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
]

function Brand({ dark }: { dark: boolean }) {
  return (
    <Link href="/dashboard" className={cx('flex items-center gap-2.5 rounded-lg', FOCUS_RING)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400">
        <svg className="h-5 w-5 text-slate-900" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
        </svg>
      </span>
      <span className={cx('font-display text-lg font-bold tracking-tight', dark ? 'text-white' : 'text-slate-900')}>
        SubCompliance
      </span>
    </Link>
  )
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="Main navigation">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cx(
              'flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors',
              FOCUS_RING,
              active ? 'bg-slate-800 text-amber-400' : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [supabase] = useState<SupabaseClient | null>(() => {
    try {
      return createClient()
    } catch {
      return null
    }
  })
  const [email, setEmail] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return
      if (!data.user) {
        router.replace('/login')
        return
      }
      setEmail(data.user.email ?? null)
    })
    return () => {
      active = false
    }
  }, [supabase, router])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  async function handleSignOut() {
    if (!supabase || signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
    } finally {
      window.location.href = '/'
    }
  }

  if (!supabase) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg text-slate-900">SubCompliance isn&apos;t connected yet</h1>
          <p className="mt-2 text-sm text-slate-500">
            The app can&apos;t reach its database right now. If you run this project, set
            NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then reload.
          </p>
        </div>
      </div>
    )
  }

  const signOutIcon = (
    <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-slate-900 lg:flex">
        <div className="p-5">
          <Brand dark />
        </div>
        <NavLinks pathname={pathname} />
        <div className="border-t border-slate-800 p-4">
          {email && (
            <p className="truncate px-1 text-xs text-slate-400" title={email}>
              {email}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className={cx(
              'mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white disabled:opacity-60',
              FOCUS_RING
            )}
          >
            {signOutIcon}
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <Brand dark={false} />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Open navigation menu"
          className={cx('flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100', FOCUS_RING)}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <div className="absolute inset-0 bg-slate-900/60" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="sc-pop absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-slate-900">
            <div className="flex items-center justify-between p-5">
              <Brand dark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close navigation menu"
                className={cx('flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-800 hover:text-white', FOCUS_RING)}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <NavLinks pathname={pathname} />
            <div className="border-t border-slate-800 p-4">
              {email && (
                <p className="truncate px-1 text-xs text-slate-400" title={email}>
                  {email}
                </p>
              )}
              <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={signingOut}
                className={cx(
                  'mt-2 flex min-h-[44px] w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white disabled:opacity-60',
                  FOCUS_RING
                )}
              >
                {signOutIcon}
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <ProfileProvider>{children}</ProfileProvider>
        </main>
      </div>
    </div>
  )
}
