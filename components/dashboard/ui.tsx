'use client'

// CANONICAL — Shared dashboard UI primitives: focus ring, button/input classes,
// and the ONE Toast. Deterministic lint #75 found Toast defined 4× and the button
// constants copied per-page; this file is now the single definition every
// dashboard page imports. Buttons enforce the 44px touch-target minimum.

import { cx } from '@/lib/core/format'

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2'

export const BTN_PRIMARY = cx(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-900 shadow-sm transition-all hover:bg-amber-300 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING
)

export const BTN_SECONDARY = cx(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING
)

export const BTN_DANGER = cx(
  'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-red-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING
)

export const INPUT =
  'mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200'

export const LABEL = 'block text-sm font-semibold text-slate-700'
export const ERROR_TEXT = 'mt-1.5 text-sm font-medium text-red-600'

export interface ToastState {
  message: string
  tone: 'success' | 'error'
}

export function Toast({ toast }: { toast: ToastState }) {
  return (
    <div
      className="sc-pop fixed bottom-4 left-1/2 z-[60] w-max max-w-[calc(100vw-2rem)] -translate-x-1/2"
      role={toast.tone === 'error' ? 'alert' : 'status'}
      aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
    >
      <div
        className={cx(
          'flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg',
          toast.tone === 'success' ? 'bg-emerald-600' : 'bg-red-600'
        )}
      >
        {toast.message}
      </div>
    </div>
  )
}
