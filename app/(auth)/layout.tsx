// CANONICAL: Auth layout — centered card chrome for /login, /signup, /forgot-password
// and /reset-password. Nested inside the root layout (owned by the core step), so this
// file renders NO <html>/<body> and imports nothing from other steps.

import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-slate-50">
      {/* Soft brand wash behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-blue-100/70 via-slate-50 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-amber-200/25 blur-3xl"
      />

      <header className="relative z-10 flex justify-center pt-10">
        <Link href="/" aria-label="SubCompliance home" className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" fill="none" className="h-9 w-9" aria-hidden="true">
            <path
              d="M12 2 4 5.2v5.9c0 4.9 3.4 9.3 8 10.9 4.6-1.6 8-6 8-10.9V5.2L12 2Z"
              fill="#1d4ed8"
            />
            <path
              d="m8.4 12.1 2.4 2.4 4.8-4.9"
              stroke="#fbbf24"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Sub<span className="text-blue-700">Compliance</span>
          </span>
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-10 pt-8 sm:items-center sm:pt-6">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="relative z-10 pb-8 text-center text-xs text-slate-500">
        <p>Compliance tracking built for the sub, not the GC.</p>
        <p className="mt-1">© {new Date().getFullYear()} SubCompliance</p>
      </footer>
    </div>
  )
}
