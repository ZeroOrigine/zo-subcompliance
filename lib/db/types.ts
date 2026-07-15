// CANONICAL — SubCompliance database contract: table names, enum values, row types.
// Single source of truth for every supabase.from(...) call in app/api/**.
// Every table below exists in the subcompliance_* migration — never invent tables.

export const PRODUCT_ID = 'subcompliance' as const

export const TABLES = {
  profiles: 'subcompliance_profiles',
  plans: 'subcompliance_plans',
  documentTypes: 'subcompliance_document_types',
  gcRelationships: 'subcompliance_gc_relationships',
  documents: 'subcompliance_documents',
  reminders: 'subcompliance_reminders',
  brokerRequests: 'subcompliance_broker_requests',
  subscriptions: 'subcompliance_subscriptions',
  payments: 'subcompliance_payments',
  stripeEvents: 'subcompliance_stripe_events',
} as const

export const GC_STATUS_VALUES = ['active', 'paused', 'archived'] as const
export type SubcomplianceGcStatus = (typeof GC_STATUS_VALUES)[number]

export const DOCUMENT_STATUS_VALUES = [
  'missing',
  'valid',
  'expiring_soon',
  'expired',
  'pending_renewal',
] as const
export type SubcomplianceDocumentStatus = (typeof DOCUMENT_STATUS_VALUES)[number]

export const REMINDER_STATUS_VALUES = ['scheduled', 'sent', 'dismissed', 'failed'] as const
export type SubcomplianceReminderStatus = (typeof REMINDER_STATUS_VALUES)[number]

export const BROKER_REQUEST_STATUS_VALUES = ['draft', 'sent', 'fulfilled', 'canceled'] as const
export type SubcomplianceBrokerRequestStatus = (typeof BROKER_REQUEST_STATUS_VALUES)[number]

export const SUBSCRIPTION_STATUS_VALUES = [
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'incomplete',
  'incomplete_expired',
  'paused',
] as const
export type SubcomplianceSubscriptionStatus = (typeof SUBSCRIPTION_STATUS_VALUES)[number]

export const PAYMENT_STATUS_VALUES = ['pending', 'succeeded', 'failed', 'refunded'] as const
export type SubcompliancePaymentStatus = (typeof PAYMENT_STATUS_VALUES)[number]

export interface ProfileRow {
  id: string
  product_id: string
  email: string | null
  full_name: string | null
  business_name: string | null
  trade: string | null
  phone: string | null
  broker_name: string | null
  broker_email: string | null
  broker_phone: string | null
  reminder_days: number[]
  role: 'user' | 'admin'
  created_at: string
  updated_at: string
}

export interface PlanRow {
  id: string
  code: string
  name: string
  price_monthly_cents: number
  stripe_price_id: string | null
  max_gcs: number | null
  features: string[]
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DocumentTypeRow {
  id: string
  code: string
  name: string
  description: string | null
  typical_validity_months: number | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface GcRelationshipRow {
  id: string
  user_id: string
  product_id: string
  gc_name: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  status: SubcomplianceGcStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface DocumentRow {
  id: string
  user_id: string
  product_id: string
  gc_relationship_id: string
  document_type_id: string
  custom_type_label: string | null
  carrier_name: string | null
  policy_number: string | null
  coverage_amount_cents: number | null
  effective_date: string | null
  expiration_date: string | null
  status: SubcomplianceDocumentStatus
  file_url: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ReminderRow {
  id: string
  user_id: string
  product_id: string
  document_id: string
  remind_on: string
  days_before: number
  status: SubcomplianceReminderStatus
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface BrokerRequestRow {
  id: string
  user_id: string
  product_id: string
  gc_relationship_id: string
  document_id: string | null
  recipient_name: string | null
  recipient_email: string | null
  subject: string
  body: string
  status: SubcomplianceBrokerRequestStatus
  sent_at: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionRow {
  id: string
  user_id: string
  product_id: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  plan: string
  status: SubcomplianceSubscriptionStatus
  current_period_end: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

export interface PaymentRow {
  id: string
  user_id: string
  product_id: string
  stripe_payment_intent_id: string | null
  stripe_checkout_session_id: string | null
  amount_cents: number
  currency: string
  status: SubcompliancePaymentStatus
  description: string | null
  created_at: string
  updated_at: string
}

export interface StripeEventRow {
  id: string
  event_id: string
  event_type: string | null
  payload: Record<string, unknown> | null
  processed_at: string | null
  created_at: string
  updated_at: string
}
