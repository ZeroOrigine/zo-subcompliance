// CANONICAL — Session-refresh helper for Next.js middleware.
// The root middleware.ts (owned by the auth_payments step) imports this instead of
// re-implementing cookie handling — one Supabase client pattern, zero redirect loops:
//
//   import { updateSession } from '@/lib/supabase/middleware'
//
//   export async function middleware(request: NextRequest) {
//     const { response, user } = await updateSession(request)
//     // auth_payments layers its redirect rules on top using `user`,
//     // and MUST return `response` (or copy its cookies) so refreshed
//     // session tokens reach the browser.
//     return response
//   }
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'

export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Without configuration we cannot refresh sessions — pass the request through
    // rather than crashing every route in the app.
    return { response, user: null }
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  // getUser() validates the JWT with the Supabase auth server — required so
  // expired sessions are refreshed and the new cookies land on the response.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return { response, user }
}
