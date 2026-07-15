// CANONICAL — Server-side Supabase clients for SubCompliance.
//
// createClient()            → cookie-scoped client for route handlers and server
//                             components. Respects RLS: acts as the signed-in user.
// createServiceRoleClient() → service-role client that BYPASSES RLS. Server-only.
//                             Used by the daily cron job here, and imported by the
//                             Stripe webhook (app/api/webhooks/stripe — owned by the
//                             auth_payments step). The webhook must: verify the
//                             signature with STRIPE_WEBHOOK_SECRET, act only when
//                             metadata.product === 'subcompliance', and insert
//                             event.id into subcompliance_stripe_events first for
//                             idempotency (unique violation 23505 = already handled).
//
// Required environment variables (set on Netlify — never hardcoded):
//   NEXT_PUBLIC_SUPABASE_URL      — project URL (client-safe)
//   NEXT_PUBLIC_SUPABASE_ANON_KEY — anon key (client-safe)
//   SUPABASE_SERVICE_ROLE_KEY     — service role key (SERVER ONLY — no NEXT_PUBLIC_ prefix)
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import {
  createClient as createSupabaseJsClient,
  type SupabaseClient,
} from '@supabase/supabase-js'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  const cookieStore = cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Called from a Server Component, where cookie writes are not allowed.
          // Safe to ignore — lib/supabase/middleware.ts refreshes sessions.
        }
      },
    },
  })
}

// Lazy singleton — never initialized at module load time, so builds never crash
// on missing env vars (BUILDER-DEPLOY-CHECKLIST rule 4.1).
let cachedServiceRoleClient: SupabaseClient | null = null

export function createServiceRoleClient(): SupabaseClient {
  if (cachedServiceRoleClient) return cachedServiceRoleClient

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Service-role Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (server only).'
    )
  }

  cachedServiceRoleClient = createSupabaseJsClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return cachedServiceRoleClient
}
