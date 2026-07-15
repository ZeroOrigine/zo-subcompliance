// CANONICAL — Shared HTTP helpers for every SubCompliance API route.
// One response envelope everywhere (Collison rule — one consistent shape):
//   success → { data: <resource>, error: null }
//   failure → { data: null, error: <human message>, code: <MACHINE_CODE>, details?: { field: [messages] } }
// Error messages are written for humans: what happened + what to do next.
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import type { ZodError } from 'zod'
import { createClient } from '@/lib/supabase/server'

export interface PaginationRange {
  page: number
  limit: number
  from: number
  to: number
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  total_pages: number
}

export function apiSuccess<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ data, error: null }, { status })
}

export function apiError(
  message: string,
  code: string,
  status: number,
  details?: Record<string, string[]>
): NextResponse {
  const body: {
    data: null
    error: string
    code: string
    details?: Record<string, string[]>
  } = { data: null, error: message, code }
  if (details) body.details = details
  return NextResponse.json(body, { status })
}

export function validationErrorFromZod(zodError: ZodError): NextResponse {
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of zodError.issues) {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_request'
    if (!fieldErrors[field]) fieldErrors[field] = []
    fieldErrors[field].push(issue.message)
  }
  return apiError(
    'A few fields need attention before we can save this.',
    'VALIDATION_ERROR',
    400,
    fieldErrors
  )
}

export function notFoundError(message: string): NextResponse {
  return apiError(message, 'NOT_FOUND', 404)
}

// Never leak internals — log server-side, speak human client-side.
export function internalError(): NextResponse {
  return apiError(
    'Something hiccuped on our side. Your data is safe — give it another try in a moment.',
    'INTERNAL_ERROR',
    500
  )
}

export async function parseJsonBody(
  request: NextRequest
): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, value: await request.json() }
  } catch {
    return {
      ok: false,
      response: apiError(
        "We couldn't read that request. Send valid JSON in the body and try again.",
        'INVALID_JSON',
        400
      ),
    }
  }
}

// Every list endpoint paginates: default 20, max 100 (Jensen rule).
export function parsePagination(searchParams: URLSearchParams): PaginationRange {
  const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '20', 10)

  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
  const limit = Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100)
  const from = (page - 1) * limit

  return { page, limit, from, to: from + limit - 1 }
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    total_pages: total === 0 ? 0 : Math.ceil(total / limit),
  }
}

// Escape %, _ and \\ so user searches are treated as literals, not patterns.
export function escapeIlikePattern(rawSearch: string): string {
  return rawSearch.replace(/[\\%_]/g, (character) => `\\${character}`)
}

export type AuthenticatedContext = {
  ok: true
  user: User
  supabase: ReturnType<typeof createClient>
}

export type AuthenticationFailure = { ok: false; response: NextResponse }

// Verified auth check for every protected route. Uses getUser() (validates the
// JWT with the Supabase auth server) — stronger than trusting a local session.
export async function requireAuthenticatedUser(): Promise<
  AuthenticatedContext | AuthenticationFailure
> {
  try {
    const supabase = createClient()
    const { data, error } = await supabase.auth.getUser()

    if (error || !data.user) {
      return {
        ok: false,
        response: apiError(
          "You'll need to sign in for that. Log in and pick up right where you left off.",
          'UNAUTHORIZED',
          401
        ),
      }
    }

    return { ok: true, user: data.user, supabase }
  } catch (unexpected) {
    console.error('[lib/db/api] Auth check crashed:', unexpected)
    return { ok: false, response: internalError() }
  }
}
