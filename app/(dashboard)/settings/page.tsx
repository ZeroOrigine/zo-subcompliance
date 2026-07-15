'use client'

// CANONICAL — Settings: business identity, broker contact (powers pre-addressed
// drafts), and reminder timing (rebuilds the whole schedule on save).
// Profile comes from ProfileProvider (single /api/profile fetch — lint #75) and the
// PATCH result is pushed back into context so other pages update instantly.

import { useEffect, useState } from 'react'
import { ApiError, apiFetch, type FieldErrors, type ProfileItem } from '@/lib/core/api-client'
import { cx } from '@/lib/core/format'
import {
  BTN_PRIMARY,
  ERROR_TEXT,
  FOCUS_RING,
  INPUT,
  LABEL,
  Toast,
  type ToastState,
} from '@/components/dashboard/ui'
import { useProfile } from '@/lib/core/profile-context'

const PRESET_DAYS = [60, 45, 30, 21, 14, 7, 3, 1]

interface SettingsFormState {
  full_name: string
  business_name: string
  trade: string
  phone: string
  broker_name: string
  broker_email: string
  broker_phone: string
  reminder_days: number[]
}

function formFromProfile(profile: ProfileItem): SettingsFormState {
  return {
    full_name: profile.full_name ?? '',
    business_name: profile.business_name ?? '',
    trade: profile.trade ?? '',
    phone: profile.phone ?? '',
    broker_name: profile.broker_name ?? '',
    broker_email: profile.broker_email ?? '',
    broker_phone: profile.broker_phone ?? '',
    reminder_days: [...(profile.reminder_days ?? [30, 14, 7, 1])],
  }
}

function daysKey(days: number[]): string {
  return [...days].sort((first, second) => second - first).join(',')
}

export default function SettingsPage() {
  const { profile, profileError, refreshProfile, setProfile } = useProfile()
  const [form, setForm] = useState<SettingsFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [toast, setToast] = useState<ToastState | null>(null)

  useEffect(() => {
    if (profile && !form) setForm(formFromProfile(profile))
  }, [profile, form])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  function setField(field: keyof Omit<SettingsFormState, 'reminder_days'>, value: string) {
    setForm((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  function toggleDay(day: number) {
    setForm((prev) => {
      if (!prev) return prev
      const has = prev.reminder_days.includes(day)
      return {
        ...prev,
        reminder_days: has ? prev.reminder_days.filter((d) => d !== day) : [...prev.reminder_days, day],
      }
    })
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    if (form.reminder_days.length === 0) {
      setFieldErrors({ reminder_days: ['Keep at least one reminder day so nothing slips.'] })
      return
    }
    setSaving(true)
    setFieldErrors({})
    try {
      const updated = await apiFetch<ProfileItem>('/api/profile', {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      const daysChanged = profile ? daysKey(form.reminder_days) !== daysKey(profile.reminder_days ?? []) : false
      setProfile(updated)
      setForm(formFromProfile(updated))
      setToast({
        tone: 'success',
        message: daysChanged ? 'Saved — every scheduled reminder now matches your new timing.' : 'Saved.',
      })
    } catch (error) {
      if (error instanceof ApiError && error.details) setFieldErrors(error.details)
      else
        setToast({
          tone: 'error',
          message: error instanceof ApiError ? error.message : "That didn't save. Try again in a moment.",
        })
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    if (profileError) {
      return (
        <div className="sc-rise mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h2 className="text-xl text-slate-900">We couldn&apos;t load your settings</h2>
          <p className="mt-2 text-sm text-slate-500">{profileError}</p>
          <button type="button" onClick={() => void refreshProfile()} className={cx(BTN_PRIMARY, 'mt-6')}>
            Try again
          </button>
        </div>
      )
    }
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading your settings">
        <div className="sc-skeleton h-9 w-48" />
        <div className="sc-skeleton h-56 w-full" />
        <div className="sc-skeleton h-56 w-full" />
        <div className="sc-skeleton h-40 w-full" />
      </div>
    )
  }

  const dayOptions = Array.from(new Set([...PRESET_DAYS, ...form.reminder_days])).sort(
    (first, second) => second - first
  )

  return (
    <div className="space-y-6">
      <header className="sc-rise">
        <h1 className="text-2xl text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          The details here power your broker drafts and reminder timing.
        </p>
      </header>

      <form onSubmit={(event) => void handleSave(event)} className="space-y-6" noValidate>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">Your business</h2>
          <p className="mt-1 text-sm text-slate-500">Used to sign every broker request we write for you.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className={LABEL}>
                Your name
              </label>
              <input id="full_name" value={form.full_name} onChange={(e) => setField('full_name', e.target.value)} className={INPUT} placeholder="Sam Alvarez" />
              {fieldErrors.full_name && <p className={ERROR_TEXT}>{fieldErrors.full_name[0]}</p>}
            </div>
            <div>
              <label htmlFor="business_name" className={LABEL}>
                Business name
              </label>
              <input id="business_name" value={form.business_name} onChange={(e) => setField('business_name', e.target.value)} className={INPUT} placeholder="Alvarez Electric LLC" />
              {fieldErrors.business_name && <p className={ERROR_TEXT}>{fieldErrors.business_name[0]}</p>}
            </div>
            <div>
              <label htmlFor="trade" className={LABEL}>
                Trade
              </label>
              <input id="trade" value={form.trade} onChange={(e) => setField('trade', e.target.value)} className={INPUT} placeholder="Electrical" />
              {fieldErrors.trade && <p className={ERROR_TEXT}>{fieldErrors.trade[0]}</p>}
            </div>
            <div>
              <label htmlFor="phone" className={LABEL}>
                Phone
              </label>
              <input id="phone" value={form.phone} onChange={(e) => setField('phone', e.target.value)} className={INPUT} placeholder="(555) 210-4478" />
              {fieldErrors.phone && <p className={ERROR_TEXT}>{fieldErrors.phone[0]}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">Your insurance broker</h2>
          <p className="mt-1 text-sm text-slate-500">
            Save them once and every renewal request arrives pre-addressed — one less thing to look up.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="broker_name" className={LABEL}>
                Broker name
              </label>
              <input id="broker_name" value={form.broker_name} onChange={(e) => setField('broker_name', e.target.value)} className={INPUT} placeholder="Pat Reilly" />
              {fieldErrors.broker_name && <p className={ERROR_TEXT}>{fieldErrors.broker_name[0]}</p>}
            </div>
            <div>
              <label htmlFor="broker_email" className={LABEL}>
                Broker email
              </label>
              <input id="broker_email" type="email" value={form.broker_email} onChange={(e) => setField('broker_email', e.target.value)} className={INPUT} placeholder="pat@reillyinsurance.com" />
              {fieldErrors.broker_email && <p className={ERROR_TEXT}>{fieldErrors.broker_email[0]}</p>}
            </div>
            <div>
              <label htmlFor="broker_phone" className={LABEL}>
                Broker phone
              </label>
              <input id="broker_phone" value={form.broker_phone} onChange={(e) => setField('broker_phone', e.target.value)} className={INPUT} placeholder="(555) 887-2210" />
              {fieldErrors.broker_phone && <p className={ERROR_TEXT}>{fieldErrors.broker_phone[0]}</p>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">Reminder timing</h2>
          <p className="mt-1 text-sm text-slate-500">
            How far ahead we warn you before a document lapses. Changing this rebuilds your whole schedule
            instantly.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {dayOptions.map((day) => {
              const selected = form.reminder_days.includes(day)
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  aria-pressed={selected}
                  className={cx(
                    'min-h-[44px] rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
                    FOCUS_RING,
                    selected
                      ? 'border-amber-400 bg-amber-400 text-slate-900'
                      : 'border-slate-300 bg-white text-slate-600 hover:border-amber-300'
                  )}
                >
                  {day} {day === 1 ? 'day' : 'days'}
                </button>
              )
            })}
          </div>
          {fieldErrors.reminder_days && <p className={ERROR_TEXT}>{fieldErrors.reminder_days[0]}</p>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg text-slate-900">Account</h2>
          <p className="mt-1 text-sm text-slate-500">
            Signed in as <span className="font-semibold text-slate-700">{profile?.email ?? 'your account'}</span>.
          </p>
        </section>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className={BTN_PRIMARY}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>

      {toast && <Toast toast={toast} />}
    </div>
  )
}
