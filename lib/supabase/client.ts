// CANONICAL — Browser Supabase client for SubCompliance (client components only).
// Server code uses lib/supabase/server.ts. Middleware uses lib/supabase/middleware.ts.
// Per PIPELINE-DEPLOYMENT-LESSONS 3.1: @supabase/ssr ONLY — never auth-helpers-nextjs.
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
