// CANONICAL — SubCompliance display helpers: dates, money, status metadata, voice.
import type { SubcomplianceDocumentStatus, SubcomplianceGcStatus } from '@/lib/db/types'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—'
  const parsed = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function todayIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

export function addMonthsIso(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const shifted = new Date(year, month - 1 + months, day)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}-${String(
    shifted.getDate()
  ).padStart(2, '0')}`
}

export function daysUntil(isoDate: string): number {
  const target = new Date(`${isoDate.slice(0, 10)}T00:00:00`)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - todayStart.getTime()) / 86_400_000)
}

export function expirationPhrase(
  status: SubcomplianceDocumentStatus,
  expirationDate: string | null
): string {
  if (status === 'missing') return 'Not on file yet'
  if (!expirationDate) return 'Never expires'
  const days = daysUntil(expirationDate)
  if (days < 0) return days === -1 ? 'Expired yesterday' : `Expired ${Math.abs(days)} days ago`
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  if (status === 'pending_renewal') return `Renewal asked — expires in ${days} days`
  return `Expires in ${days} days`
}

export interface StatusMeta {
  label: string
  badge: string
  dot: string
}

export const DOCUMENT_STATUS_META: Record<SubcomplianceDocumentStatus, StatusMeta> = {
  valid: { label: 'Current', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  expiring_soon: { label: 'Expiring soon', badge: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  expired: { label: 'Expired', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  missing: { label: 'Missing', badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  pending_renewal: { label: 'Renewal in motion', badge: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
}

export const GC_STATUS_META: Record<SubcomplianceGcStatus, StatusMeta> = {
  active: { label: 'Active', badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  paused: { label: 'Paused', badge: 'bg-slate-200 text-slate-700', dot: 'bg-slate-400' },
  archived: { label: 'Archived', badge: 'bg-slate-100 text-slate-500', dot: 'bg-slate-300' },
}

export function formatCoverage(cents: number | null | undefined): string | null {
  if (cents == null) return null
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

export function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export function firstNameOf(
  fullName: string | null | undefined,
  email: string | null | undefined
): string {
  const name = fullName?.trim()
  if (name) return name.split(/\s+/)[0]
  const handle = email?.split('@')[0]
  return handle && handle.length > 0 ? handle : 'there'
}

export function joinDays(days: number[]): string {
  const sorted = Array.from(new Set(days)).sort((first, second) => second - first)
  if (sorted.length === 0) return ''
  if (sorted.length === 1) return String(sorted[0])
  return `${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]}`
}
