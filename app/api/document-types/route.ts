// CANONICAL — Document types lookup (COIs, endorsements, W-9, licenses, bonds).
// GET /api/document-types → the seeded reference list, in display order.
// Small fixed list (12 rows) — intentionally unpaginated.
import {
  apiSuccess,
  internalError,
  requireAuthenticatedUser,
} from '@/lib/db/api'
import { TABLES } from '@/lib/db/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { supabase } = auth

    const { data, error } = await supabase
      .from(TABLES.documentTypes)
      .select('id, code, name, description, typical_validity_months, sort_order')
      .order('sort_order', { ascending: true })
    if (error) {
      console.error('[api/document-types] Failed to list document types:', error.message)
      return internalError()
    }

    return apiSuccess({ items: data ?? [] })
  } catch (unexpected) {
    console.error('[api/document-types] GET crashed:', unexpected)
    return internalError()
  }
}
