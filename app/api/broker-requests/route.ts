// CANONICAL — Broker requests collection: the product's magic trick.
// GET  /api/broker-requests → paginated list with GC context.
// POST /api/broker-requests → creates a draft. If subject/body are omitted, the server
//                             WRITES THE EMAIL for the contractor from real data only:
//                             their profile, their broker contact, the GC, and the
//                             document that's lapsing. Nothing is ever fabricated.
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import {
  apiError,
  apiSuccess,
  buildPaginationMeta,
  internalError,
  notFoundError,
  parseJsonBody,
  parsePagination,
  requireAuthenticatedUser,
  validationErrorFromZod,
} from '@/lib/db/api'
import {
  BROKER_REQUEST_STATUS_VALUES,
  PRODUCT_ID,
  TABLES,
  type SubcomplianceDocumentStatus,
} from '@/lib/db/types'

export const dynamic = 'force-dynamic'

const BROKER_REQUEST_COLUMNS =
  'id, gc_relationship_id, document_id, recipient_name, recipient_email, subject, body, status, sent_at, created_at, updated_at'

const BROKER_REQUEST_SELECT = `${BROKER_REQUEST_COLUMNS}, gc_relationship:${TABLES.gcRelationships}(id, gc_name)`

function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

const createBrokerRequestSchema = z.object({
  gc_relationship_id: z
    .string({ required_error: 'Pick which GC this request is for.' })
    .uuid('Pick which GC this request is for.'),
  document_id: z.preprocess(
    emptyToNull,
    z.string().uuid("That document reference doesn't look right.").nullable().optional()
  ),
  recipient_name: z.preprocess(
    emptyToNull,
    z.string().trim().max(200, 'Keep the recipient name under 200 characters.').nullable().optional()
  ),
  recipient_email: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .email("That email doesn't look quite right. Mind double-checking it?")
      .max(320, 'Email addresses are capped at 320 characters.')
      .nullable()
      .optional()
  ),
  subject: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .min(1, "The subject can't be blank — leave it out and we'll write one for you.")
      .max(300, 'Keep the subject under 300 characters.')
      .nullable()
      .optional()
  ),
  body: z.preprocess(
    emptyToNull,
    z
      .string()
      .trim()
      .min(1, "The body can't be blank — leave it out and we'll draft it for you.")
      .max(10000, 'Keep the request under 10,000 characters.')
      .nullable()
      .optional()
  ),
})

interface LinkedDocumentRow {
  id: string
  gc_relationship_id: string
  carrier_name: string | null
  policy_number: string | null
  expiration_date: string | null
  status: SubcomplianceDocumentStatus
  custom_type_label: string | null
  document_type: { name: string } | null
}

interface BrokerDraftInput {
  brokerName: string | null
  contractorFullName: string | null
  businessName: string | null
  trade: string | null
  phone: string | null
  gcName: string
  gcContactName: string | null
  gcContactEmail: string | null
  documentTypeName: string | null
  customTypeLabel: string | null
  carrierName: string | null
  policyNumber: string | null
  expirationDate: string | null
  documentStatus: SubcomplianceDocumentStatus | null
}

function buildBrokerRequestDraft(input: BrokerDraftInput): { subject: string; body: string } {
  const documentLabel =
    input.customTypeLabel?.trim() || input.documentTypeName || 'certificate of insurance'

  const subject = input.expirationDate
    ? `Renewal request: ${documentLabel} for ${input.gcName} (expires ${input.expirationDate})`
    : `Certificate request: ${documentLabel} for ${input.gcName}`

  const lines: string[] = []
  lines.push(`Hi ${input.brokerName?.trim() || 'there'},`)
  lines.push('')
  lines.push(
    `I need an updated ${documentLabel} for ${input.gcName} so I can stay on their approved subcontractor list.`
  )
  if (input.documentStatus === 'expired') {
    lines.push(
      'The certificate they have on file has already expired, so this one is urgent — I can be pulled off the job until it is replaced.'
    )
  } else if (input.expirationDate) {
    lines.push(`The certificate they have on file expires on ${input.expirationDate}.`)
  }
  lines.push('')
  lines.push('Certificate details:')
  lines.push(`- Certificate holder: ${input.gcName}`)
  if (input.gcContactName || input.gcContactEmail) {
    const contactParts = [input.gcContactName, input.gcContactEmail]
      .filter((part): part is string => Boolean(part))
      .join(', ')
    lines.push(`- GC compliance contact: ${contactParts}`)
  }
  if (input.carrierName) lines.push(`- Carrier: ${input.carrierName}`)
  if (input.policyNumber) lines.push(`- Policy number: ${input.policyNumber}`)
  lines.push('')
  lines.push(
    `Could you email me the updated certificate as a PDF? If anything about the policy needs my attention first, ${
      input.phone ? `call me at ${input.phone}` : 'reply here'
    } and I will sort it out.`
  )
  lines.push('')
  lines.push('Thanks,')

  const signatureParts = Array.from(
    new Set(
      [input.contractorFullName, input.businessName, input.trade, input.phone]
        .map((part) => part?.trim())
        .filter((part): part is string => Boolean(part))
    )
  )
  for (const part of signatureParts) lines.push(part)

  return { subject, body: lines.join('\n') }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const searchParams = request.nextUrl.searchParams
    const { page, limit, from, to } = parsePagination(searchParams)

    const statusFilter = searchParams.get('status')
    if (
      statusFilter &&
      !(BROKER_REQUEST_STATUS_VALUES as readonly string[]).includes(statusFilter)
    ) {
      return apiError(
        'The status filter can be draft, sent, fulfilled, or canceled.',
        'VALIDATION_ERROR',
        400
      )
    }

    const gcRelationshipId = searchParams.get('gc_relationship_id')
    if (gcRelationshipId && !z.string().uuid().safeParse(gcRelationshipId).success) {
      return apiError("That GC filter doesn't look right. Pick a GC from your list.", 'VALIDATION_ERROR', 400)
    }

    let query = supabase
      .from(TABLES.brokerRequests)
      .select(BROKER_REQUEST_SELECT, { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (statusFilter) query = query.eq('status', statusFilter)
    if (gcRelationshipId) query = query.eq('gc_relationship_id', gcRelationshipId)

    const { data, error, count } = await query
    if (error) {
      console.error('[api/broker-requests] Failed to list broker requests:', error.message)
      return internalError()
    }

    return apiSuccess({
      items: data ?? [],
      pagination: buildPaginationMeta(page, limit, count ?? 0),
    })
  } catch (unexpected) {
    console.error('[api/broker-requests] GET crashed:', unexpected)
    return internalError()
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser()
    if (!auth.ok) return auth.response
    const { user, supabase } = auth

    const body = await parseJsonBody(request)
    if (!body.ok) return body.response

    const parsed = createBrokerRequestSchema.safeParse(body.value)
    if (!parsed.success) return validationErrorFromZod(parsed.error)

    const { data: gcRelationship, error: gcError } = await supabase
      .from(TABLES.gcRelationships)
      .select('id, gc_name, contact_name, contact_email')
      .eq('id', parsed.data.gc_relationship_id)
      .eq('user_id', user.id)
      .maybeSingle()
    if (gcError) {
      console.error('[api/broker-requests] Failed to verify GC ownership:', gcError.message)
      return internalError()
    }
    if (!gcRelationship) {
      return notFoundError("We couldn't find that GC in your account. Pick one from your list.")
    }

    let linkedDocument: LinkedDocumentRow | null = null

    if (parsed.data.document_id) {
      const { data: documentRow, error: documentError } = await supabase
        .from(TABLES.documents)
        .select(
          `id, gc_relationship_id, carrier_name, policy_number, expiration_date, status, custom_type_label, document_type:${TABLES.documentTypes}(name)`
        )
        .eq('id', parsed.data.document_id)
        .eq('user_id', user.id)
        .maybeSingle()
      if (documentError) {
        console.error('[api/broker-requests] Failed to verify document:', documentError.message)
        return internalError()
      }
      if (!documentRow) {
        return notFoundError("We couldn't find that document. It may have been removed.")
      }
      linkedDocument = documentRow as unknown as LinkedDocumentRow
      if (linkedDocument && linkedDocument.gc_relationship_id !== gcRelationship.id) {
        return apiError(
          `That document belongs to a different GC. Pick one filed under ${gcRelationship.gc_name}.`,
          'DOCUMENT_GC_MISMATCH',
          400
        )
      }
    }

    const { data: profile, error: profileError } = await supabase
      .from(TABLES.profiles)
      .select('full_name, business_name, trade, phone, broker_name, broker_email')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      console.error('[api/broker-requests] Failed to read profile:', profileError.message)
      return internalError()
    }

    const generatedDraft = buildBrokerRequestDraft({
      brokerName: parsed.data.recipient_name ?? profile?.broker_name ?? null,
      contractorFullName: profile?.full_name ?? null,
      businessName: profile?.business_name ?? null,
      trade: profile?.trade ?? null,
      phone: profile?.phone ?? null,
      gcName: gcRelationship.gc_name,
      gcContactName: gcRelationship.contact_name,
      gcContactEmail: gcRelationship.contact_email,
      documentTypeName: linkedDocument?.document_type?.name ?? null,
      customTypeLabel: linkedDocument?.custom_type_label ?? null,
      carrierName: linkedDocument?.carrier_name ?? null,
      policyNumber: linkedDocument?.policy_number ?? null,
      expirationDate: linkedDocument?.expiration_date ?? null,
      documentStatus: linkedDocument?.status ?? null,
    })

    const { data: createdRequest, error: insertError } = await supabase
      .from(TABLES.brokerRequests)
      .insert({
        user_id: user.id,
        product_id: PRODUCT_ID,
        gc_relationship_id: gcRelationship.id,
        document_id: linkedDocument?.id ?? null,
        recipient_name: parsed.data.recipient_name ?? profile?.broker_name ?? null,
        recipient_email: parsed.data.recipient_email ?? profile?.broker_email ?? null,
        subject: parsed.data.subject ?? generatedDraft.subject,
        body: parsed.data.body ?? generatedDraft.body,
        status: 'draft',
      })
      .select(BROKER_REQUEST_SELECT)
      .single()
    if (insertError) {
      console.error('[api/broker-requests] Failed to create broker request:', insertError.message)
      return internalError()
    }

    return apiSuccess(createdRequest, 201)
  } catch (unexpected) {
    console.error('[api/broker-requests] POST crashed:', unexpected)
    return internalError()
  }
}
