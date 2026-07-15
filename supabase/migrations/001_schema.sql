-- =====================================================================
-- SubCompliance — Certificate-of-insurance & compliance tracker
-- built FOR solo trade contractors (not the GC side).
--
-- Product slug : subcompliance  (ALL tables / types / functions prefixed —
--                shared ZeroOrigine Postgres database, Rule 0)
-- Target       : Supabase (PostgreSQL 15+), executable top-to-bottom.
--
-- Kernel       : a contractor's GC relationships → the documents each GC
--                requires → their expiration dates → reminders + broker
--                request drafts that keep the contractor on the job.
--
-- Core tables (4): gc_relationships, documents, reminders, broker_requests
-- Lookup tables  : document_types, plans (seeded)
-- Infra tables   : profiles, subscriptions, payments, stripe_events
-- =====================================================================

-- =====================================================================
-- 1. ENUMS (prefixed — enum type names share a namespace across products)
-- =====================================================================

CREATE TYPE subcompliance_gc_status AS ENUM (
  'active', 'paused', 'archived'
);

CREATE TYPE subcompliance_document_status AS ENUM (
  'missing',          -- GC requires it, nothing on file yet
  'valid',            -- on file and not near expiration
  'expiring_soon',    -- expires within 30 days
  'expired',          -- expiration date has passed
  'pending_renewal'   -- contractor has requested renewal from broker
);

CREATE TYPE subcompliance_reminder_status AS ENUM (
  'scheduled', 'sent', 'dismissed', 'failed'
);

CREATE TYPE subcompliance_broker_request_status AS ENUM (
  'draft', 'sent', 'fulfilled', 'canceled'
);

CREATE TYPE subcompliance_subscription_status AS ENUM (
  'trialing', 'active', 'past_due', 'canceled',
  'unpaid', 'incomplete', 'incomplete_expired', 'paused'
);

CREATE TYPE subcompliance_payment_status AS ENUM (
  'pending', 'succeeded', 'failed', 'refunded'
);

-- =====================================================================
-- 2. TABLES
-- =====================================================================

-- ---------------------------------------------------------------------
-- 2.1 Profiles — extends auth.users. Holds the contractor's business
--     identity plus their insurance broker contact (used to pre-fill
--     broker request drafts) and reminder preferences.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_profiles (
  id             uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id     text NOT NULL DEFAULT 'subcompliance',
  email          text,
  full_name      text,
  business_name  text,
  trade          text,                                   -- e.g. 'Electrical', 'Plumbing', 'HVAC'
  phone          text,
  broker_name    text,                                   -- insurance broker/agent contact
  broker_email   text,
  broker_phone   text,
  reminder_days  integer[] NOT NULL DEFAULT ARRAY[30, 14, 7, 1],  -- days before expiration to remind
  role           text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_profiles IS
  'Contractor profile: business identity, broker contact for request drafts, reminder preferences.';

-- ---------------------------------------------------------------------
-- 2.2 Plans — lookup table for billing tiers. The value metric is the
--     number of GC relationships tracked (the pain scales with GC count).
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_plans (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                 text NOT NULL UNIQUE,
  name                 text NOT NULL,
  price_monthly_cents  integer NOT NULL DEFAULT 0 CHECK (price_monthly_cents >= 0),
  stripe_price_id      text,                             -- set by Deploy Mind after Stripe product creation
  max_gcs              integer,                          -- NULL = unlimited
  features             jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active            boolean NOT NULL DEFAULT true,
  sort_order           integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_plans IS
  'Billing tiers. Free = up to 3 GC relationships; Pro = unlimited. App reads max_gcs to enforce limits server-side.';

-- ---------------------------------------------------------------------
-- 2.3 Document types — lookup of the compliance documents GCs demand.
--     typical_validity_months NULL = non-expiring (e.g. W-9).
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_document_types (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE,
  name                     text NOT NULL,
  description              text,
  typical_validity_months  integer,                      -- NULL = does not expire
  sort_order               integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_document_types IS
  'Reference list of compliance document types (COIs, endorsements, W-9, licenses, bonds).';

-- ---------------------------------------------------------------------
-- 2.4 GC relationships — CORE. One row per general contractor the
--     solo contractor works under.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_gc_relationships (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id     text NOT NULL DEFAULT 'subcompliance',
  gc_name        text NOT NULL,                          -- general contractor company name
  contact_name   text,                                   -- compliance/office contact at the GC
  contact_email  text,
  contact_phone  text,
  status         subcompliance_gc_status NOT NULL DEFAULT 'active',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_gc_relationships IS
  'CORE: each general contractor the user works under. Documents hang off this.';

-- ---------------------------------------------------------------------
-- 2.5 Documents — CORE. One row per required document per GC.
--     A row with no expiration/file is a "missing" requirement.
--     Status is DERIVED (trigger + daily refresh), except the
--     user-set flag pending_renewal.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_documents (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id            text NOT NULL DEFAULT 'subcompliance',
  gc_relationship_id    uuid NOT NULL REFERENCES subcompliance_gc_relationships(id) ON DELETE CASCADE,
  document_type_id      uuid NOT NULL REFERENCES subcompliance_document_types(id) ON DELETE RESTRICT,
  custom_type_label     text,                            -- used when document_type is 'other'
  carrier_name          text,                            -- insurance carrier (for COIs)
  policy_number         text,
  coverage_amount_cents bigint CHECK (coverage_amount_cents IS NULL OR coverage_amount_cents >= 0),
  effective_date        date,
  expiration_date       date,                            -- NULL = non-expiring doc (e.g. W-9)
  status                subcompliance_document_status NOT NULL DEFAULT 'missing',
  file_url              text,                            -- Supabase Storage object path
  notes                 text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_documents IS
  'CORE: one row per required compliance document per GC relationship. Status is derived from expiration_date/file_url.';

-- ---------------------------------------------------------------------
-- 2.6 Reminders — CORE. Auto-generated from expiration dates and the
--     profile''s reminder_days. The daily job scans status=scheduled
--     AND remind_on <= today, sends, and marks sent.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_reminders (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id   text NOT NULL DEFAULT 'subcompliance',
  document_id  uuid NOT NULL REFERENCES subcompliance_documents(id) ON DELETE CASCADE,
  remind_on    date NOT NULL,                            -- date the reminder should fire
  days_before  integer NOT NULL,                         -- 30 / 14 / 7 / 1 ...
  status       subcompliance_reminder_status NOT NULL DEFAULT 'scheduled',
  sent_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, remind_on, days_before)           -- dedupe: one reminder per doc per date per offset
);

COMMENT ON TABLE subcompliance_reminders IS
  'CORE: scheduled/sent lapse warnings, auto-synced from document expiration dates.';

-- ---------------------------------------------------------------------
-- 2.7 Broker requests — CORE. Generated email drafts the contractor
--     sends to their broker to get a renewed/updated certificate.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_broker_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          text NOT NULL DEFAULT 'subcompliance',
  gc_relationship_id  uuid NOT NULL REFERENCES subcompliance_gc_relationships(id) ON DELETE CASCADE,
  document_id         uuid REFERENCES subcompliance_documents(id) ON DELETE SET NULL,
  recipient_name      text,                              -- snapshot of broker name at draft time
  recipient_email     text,
  subject             text NOT NULL,
  body                text NOT NULL,                     -- the generated request draft
  status              subcompliance_broker_request_status NOT NULL DEFAULT 'draft',
  sent_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_broker_requests IS
  'CORE: generated broker-request drafts (COI renewals, endorsements) per GC relationship.';

-- ---------------------------------------------------------------------
-- 2.8 Subscriptions — Stripe billing state. One row per user.
--     Writes happen via the Stripe webhook using the service role.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_subscriptions (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id              text NOT NULL DEFAULT 'subcompliance',
  stripe_customer_id      text,
  stripe_subscription_id  text UNIQUE,
  plan                    text NOT NULL DEFAULT 'free',  -- code from subcompliance_plans
  status                  subcompliance_subscription_status NOT NULL DEFAULT 'active',
  current_period_end      timestamptz,
  cancel_at_period_end    boolean NOT NULL DEFAULT false,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_subscriptions IS
  'Stripe billing state, one row per user (free row auto-created at signup). Webhook (service role) is the source of truth.';

-- ---------------------------------------------------------------------
-- 2.9 Payments — one-time charges (if any), recorded by the webhook.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_payments (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id                  text NOT NULL DEFAULT 'subcompliance',
  stripe_payment_intent_id    text UNIQUE,
  stripe_checkout_session_id  text,
  amount_cents                integer NOT NULL CHECK (amount_cents >= 0),
  currency                    text NOT NULL DEFAULT 'usd',
  status                      subcompliance_payment_status NOT NULL DEFAULT 'pending',
  description                 text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_payments IS
  'One-time Stripe charges. Written by the webhook via service role.';

-- ---------------------------------------------------------------------
-- 2.10 Stripe events — webhook idempotency ledger (infra, not core).
--      RLS enabled with NO policies: service-role-only by design.
-- ---------------------------------------------------------------------
CREATE TABLE subcompliance_stripe_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text NOT NULL UNIQUE,                    -- Stripe event id — dedupes webhook retries
  event_type    text,
  payload       jsonb,
  processed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE subcompliance_stripe_events IS
  'Webhook idempotency: INSERT event_id first; unique violation = retry, skip processing. Service role only.';

-- =====================================================================
-- 3. INDEXES (all FKs + hot WHERE columns; partial where useful)
-- =====================================================================

CREATE INDEX idx_subcompliance_profiles_email
  ON subcompliance_profiles (email);

CREATE INDEX idx_subcompliance_gc_relationships_user_id
  ON subcompliance_gc_relationships (user_id);
CREATE INDEX idx_subcompliance_gc_relationships_user_active
  ON subcompliance_gc_relationships (user_id) WHERE status = 'active';

CREATE INDEX idx_subcompliance_documents_user_id
  ON subcompliance_documents (user_id);
CREATE INDEX idx_subcompliance_documents_gc_relationship_id
  ON subcompliance_documents (gc_relationship_id);
CREATE INDEX idx_subcompliance_documents_document_type_id
  ON subcompliance_documents (document_type_id);
CREATE INDEX idx_subcompliance_documents_user_status
  ON subcompliance_documents (user_id, status);
CREATE INDEX idx_subcompliance_documents_user_expiration
  ON subcompliance_documents (user_id, expiration_date);
CREATE INDEX idx_subcompliance_documents_expiring                 -- daily status-refresh scan
  ON subcompliance_documents (expiration_date) WHERE expiration_date IS NOT NULL;

CREATE INDEX idx_subcompliance_reminders_user_id
  ON subcompliance_reminders (user_id);
CREATE INDEX idx_subcompliance_reminders_document_id
  ON subcompliance_reminders (document_id);
CREATE INDEX idx_subcompliance_reminders_due                      -- daily send job scan
  ON subcompliance_reminders (remind_on) WHERE status = 'scheduled';

CREATE INDEX idx_subcompliance_broker_requests_user_id
  ON subcompliance_broker_requests (user_id);
CREATE INDEX idx_subcompliance_broker_requests_gc_relationship_id
  ON subcompliance_broker_requests (gc_relationship_id);
CREATE INDEX idx_subcompliance_broker_requests_document_id
  ON subcompliance_broker_requests (document_id);
CREATE INDEX idx_subcompliance_broker_requests_user_status
  ON subcompliance_broker_requests (user_id, status);

CREATE INDEX idx_subcompliance_subscriptions_stripe_customer_id
  ON subcompliance_subscriptions (stripe_customer_id);
CREATE INDEX idx_subcompliance_subscriptions_active
  ON subcompliance_subscriptions (user_id) WHERE status IN ('active', 'trialing');

CREATE INDEX idx_subcompliance_payments_user_id
  ON subcompliance_payments (user_id);
CREATE INDEX idx_subcompliance_payments_status
  ON subcompliance_payments (status);

CREATE INDEX idx_subcompliance_stripe_events_event_type
  ON subcompliance_stripe_events (event_type);

-- =====================================================================
-- 4. FUNCTIONS & TRIGGERS (all prefixed — function names are global)
-- =====================================================================

-- 4.1 updated_at maintenance ------------------------------------------
CREATE OR REPLACE FUNCTION subcompliance_update_updated_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subcompliance_profiles_updated_at
  BEFORE UPDATE ON subcompliance_profiles
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_plans_updated_at
  BEFORE UPDATE ON subcompliance_plans
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_document_types_updated_at
  BEFORE UPDATE ON subcompliance_document_types
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_gc_relationships_updated_at
  BEFORE UPDATE ON subcompliance_gc_relationships
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_documents_updated_at
  BEFORE UPDATE ON subcompliance_documents
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_reminders_updated_at
  BEFORE UPDATE ON subcompliance_reminders
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_broker_requests_updated_at
  BEFORE UPDATE ON subcompliance_broker_requests
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_subscriptions_updated_at
  BEFORE UPDATE ON subcompliance_subscriptions
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_payments_updated_at
  BEFORE UPDATE ON subcompliance_payments
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();
CREATE TRIGGER trg_subcompliance_stripe_events_updated_at
  BEFORE UPDATE ON subcompliance_stripe_events
  FOR EACH ROW EXECUTE FUNCTION subcompliance_update_updated_at();

-- 4.2 Admin check (SECURITY DEFINER avoids RLS recursion on profiles) --
CREATE OR REPLACE FUNCTION subcompliance_is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subcompliance_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 4.3 Derived document status ------------------------------------------
--     missing        : no expiration date AND no file on record
--     valid          : on file; non-expiring, or > 30 days out
--     expiring_soon  : expires within 30 days
--     expired        : expiration date has passed
CREATE OR REPLACE FUNCTION subcompliance_compute_document_status(
  p_expiration_date date,
  p_file_url text
)
RETURNS subcompliance_document_status
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN p_expiration_date IS NULL AND p_file_url IS NULL THEN 'missing'::subcompliance_document_status
    WHEN p_expiration_date IS NULL THEN 'valid'::subcompliance_document_status
    WHEN p_expiration_date < CURRENT_DATE THEN 'expired'::subcompliance_document_status
    WHEN p_expiration_date <= CURRENT_DATE + 30 THEN 'expiring_soon'::subcompliance_document_status
    ELSE 'valid'::subcompliance_document_status
  END;
$$;

-- Keep status consistent on every write. 'pending_renewal' is the one
-- user-set flag we respect — unless the document has already expired.
CREATE OR REPLACE FUNCTION subcompliance_set_document_status()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status <> 'pending_renewal' THEN
    NEW.status := subcompliance_compute_document_status(NEW.expiration_date, NEW.file_url);
  ELSIF NEW.expiration_date IS NOT NULL AND NEW.expiration_date < CURRENT_DATE THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subcompliance_documents_set_status
  BEFORE INSERT OR UPDATE ON subcompliance_documents
  FOR EACH ROW EXECUTE FUNCTION subcompliance_set_document_status();

-- 4.4 Auto-sync reminders when an expiration date is set or changes ----
--     Drops un-sent reminders and reschedules per the user's
--     reminder_days preference. Already-sent reminders are preserved.
CREATE OR REPLACE FUNCTION subcompliance_sync_document_reminders()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days      integer[];
  v_day       integer;
  v_remind_on date;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.expiration_date IS NOT DISTINCT FROM OLD.expiration_date THEN
    RETURN NEW;  -- expiration unchanged: nothing to reschedule
  END IF;

  DELETE FROM public.subcompliance_reminders
  WHERE document_id = NEW.id AND status = 'scheduled';

  IF NEW.expiration_date IS NULL THEN
    RETURN NEW;  -- non-expiring document: no reminders needed
  END IF;

  SELECT COALESCE(reminder_days, ARRAY[30, 14, 7, 1]) INTO v_days
  FROM public.subcompliance_profiles
  WHERE id = NEW.user_id;

  IF v_days IS NULL THEN
    v_days := ARRAY[30, 14, 7, 1];
  END IF;

  FOREACH v_day IN ARRAY v_days LOOP
    v_remind_on := NEW.expiration_date - v_day;
    IF v_remind_on >= CURRENT_DATE THEN
      INSERT INTO public.subcompliance_reminders
        (user_id, product_id, document_id, remind_on, days_before)
      VALUES
        (NEW.user_id, 'subcompliance', NEW.id, v_remind_on, v_day)
      ON CONFLICT (document_id, remind_on, days_before) DO NOTHING;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_subcompliance_documents_sync_reminders
  AFTER INSERT OR UPDATE ON subcompliance_documents
  FOR EACH ROW EXECUTE FUNCTION subcompliance_sync_document_reminders();

-- 4.5 Daily status refresh (called by scheduled job via service role) --
--     Time passes without row updates; this re-derives every status.
CREATE OR REPLACE FUNCTION subcompliance_refresh_document_statuses()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_updated integer;
BEGIN
  UPDATE public.subcompliance_documents d
  SET status = subcompliance_compute_document_status(d.expiration_date, d.file_url)
  WHERE (
          d.status <> 'pending_renewal'
          OR (d.expiration_date IS NOT NULL AND d.expiration_date < CURRENT_DATE)
        )
    AND d.status IS DISTINCT FROM subcompliance_compute_document_status(d.expiration_date, d.file_url);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- Maintenance function is service-role only (not callable via anon RPC)
REVOKE EXECUTE ON FUNCTION subcompliance_refresh_document_statuses() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION subcompliance_refresh_document_statuses() TO service_role;

-- 4.6 Auto-provision profile + free subscription on signup -------------
CREATE OR REPLACE FUNCTION subcompliance_handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subcompliance_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.subcompliance_subscriptions (user_id, plan, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_subcompliance
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION subcompliance_handle_new_user();

-- =====================================================================
-- 5. ROW-LEVEL SECURITY — canonical patterns only
--    (service role bypasses RLS; no policy needed for it)
-- =====================================================================

ALTER TABLE subcompliance_profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_plans            ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_document_types   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_gc_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_documents        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_reminders        ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_broker_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_subscriptions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_payments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcompliance_stripe_events    ENABLE ROW LEVEL SECURITY;

-- 5.1 Profiles: keyed by id = auth.uid() -------------------------------
CREATE POLICY "subcompliance_profiles_owner" ON subcompliance_profiles
  FOR ALL TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "subcompliance_profiles_admin_read" ON subcompliance_profiles
  FOR SELECT TO authenticated
  USING (subcompliance_is_admin());

-- 5.2 User-owned tables: canonical tenant-isolation policy -------------
CREATE POLICY "subcompliance_gc_relationships_owner" ON subcompliance_gc_relationships
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

CREATE POLICY "subcompliance_documents_owner" ON subcompliance_documents
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

CREATE POLICY "subcompliance_reminders_owner" ON subcompliance_reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

CREATE POLICY "subcompliance_broker_requests_owner" ON subcompliance_broker_requests
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

CREATE POLICY "subcompliance_subscriptions_owner" ON subcompliance_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

CREATE POLICY "subcompliance_payments_owner" ON subcompliance_payments
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance')
  WITH CHECK (user_id = auth.uid() AND product_id = 'subcompliance');

-- 5.3 Admin read for support/billing debugging --------------------------
CREATE POLICY "subcompliance_subscriptions_admin_read" ON subcompliance_subscriptions
  FOR SELECT TO authenticated
  USING (subcompliance_is_admin());

CREATE POLICY "subcompliance_payments_admin_read" ON subcompliance_payments
  FOR SELECT TO authenticated
  USING (subcompliance_is_admin());

-- 5.4 Lookup tables: readable by signed-in users only (never anon) ------
CREATE POLICY "subcompliance_plans_read" ON subcompliance_plans
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "subcompliance_document_types_read" ON subcompliance_document_types
  FOR SELECT TO authenticated
  USING (true);

-- 5.5 subcompliance_stripe_events: NO policies on purpose.
--     RLS is enabled with zero policies → only the service role
--     (webhook handler) can read or write. Do not add policies.

-- =====================================================================
-- 6. SEED DATA
-- =====================================================================

INSERT INTO subcompliance_document_types
  (code, name, description, typical_validity_months, sort_order)
VALUES
  ('coi_general_liability', 'General Liability COI',
   'Certificate of insurance for commercial general liability — the document GCs request most often.', 12, 1),
  ('coi_workers_comp', 'Workers'' Compensation COI',
   'Certificate showing active workers'' compensation coverage, or a valid state exemption.', 12, 2),
  ('coi_commercial_auto', 'Commercial Auto COI',
   'Certificate for commercial auto liability covering work vehicles.', 12, 3),
  ('coi_umbrella', 'Umbrella / Excess Liability COI',
   'Certificate for umbrella or excess liability limits stacked above primary policies.', 12, 4),
  ('additional_insured_endorsement', 'Additional Insured Endorsement',
   'Endorsement naming the GC as additional insured — commonly required alongside the GL certificate.', 12, 5),
  ('waiver_of_subrogation', 'Waiver of Subrogation',
   'Endorsement waiving subrogation rights in favor of the GC.', 12, 6),
  ('w9', 'W-9 Tax Form',
   'Taxpayer identification form. Does not expire; many GCs re-request it annually.', NULL, 7),
  ('contractor_license', 'Contractor License',
   'State or local trade license required to work under the GC.', 24, 8),
  ('surety_bond', 'Surety Bond',
   'License or performance bond where the GC or jurisdiction requires one.', 12, 9),
  ('safety_certification', 'Safety Certification',
   'OSHA 10/30 card or site-specific safety credential.', 60, 10),
  ('subcontract_agreement', 'Signed Subcontract Agreement',
   'Executed master subcontract or work agreement on file with the GC. Does not expire.', NULL, 11),
  ('other', 'Other Document',
   'Any other compliance document a GC requires — label it with a custom name.', NULL, 99);

INSERT INTO subcompliance_plans
  (code, name, price_monthly_cents, max_gcs, features, sort_order)
VALUES
  ('free', 'Free', 0, 3,
   '["Track up to 3 GC relationships", "Unlimited documents per GC", "Expiration dashboard", "Email lapse reminders", "Broker request drafts"]'::jsonb, 1),
  ('pro', 'Pro', 900, NULL,
   '["Unlimited GC relationships", "Unlimited documents per GC", "Expiration dashboard", "Email lapse reminders", "Broker request drafts", "Priority support"]'::jsonb, 2);

-- =====================================================================
-- END — executable top-to-bottom on a fresh Supabase project.
-- Later steps MUST reference these exact table names via
-- supabase.from('subcompliance_...').
-- =====================================================================

-- Self-validation patches
-- =====================================================================
-- SELF-VALIDATION PATCH — SubCompliance
-- Tighten billing tables: end users must be able to READ their own
-- subscription/payment rows, never WRITE them. Writes come only from:
--   • subcompliance_handle_new_user() (SECURITY DEFINER, bypasses RLS)
--   • the central payments webhook (service role, bypasses RLS)
-- The previous FOR ALL policies let a signed-in user UPDATE their own
-- subscription to plan='pro' via PostgREST — a free self-upgrade that
-- also defeated the max_gcs plan limit. Closed here.
-- =====================================================================

DROP POLICY IF EXISTS "subcompliance_subscriptions_owner" ON subcompliance_subscriptions;
CREATE POLICY "subcompliance_subscriptions_owner_read" ON subcompliance_subscriptions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance');

DROP POLICY IF EXISTS "subcompliance_payments_owner" ON subcompliance_payments;
CREATE POLICY "subcompliance_payments_owner_read" ON subcompliance_payments
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND product_id = 'subcompliance');

-- Admin SELECT policies (subcompliance_subscriptions_admin_read,
-- subcompliance_payments_admin_read) already exist and remain unchanged.
-- No user-facing code writes these tables: /api/checkout and /api/billing/*
-- only read; the billing dashboard only reads. Verified before tightening.


-- fix QA-003
-- =====================================================================
-- QA-003 FIX (security/high): lock down subcompliance_reminders RLS.
--
-- The original 'subcompliance_reminders_owner' FOR ALL policy let a
-- signed-in contractor INSERT/UPDATE/DELETE reminder rows directly via
-- PostgREST (e.g. rewrite remind_on/days_before or fabricate 'sent'
-- reminders), bypassing the API's dismiss-only contract.
--
-- Replacement:
--   * SELECT policy  — owners can read their own reminders.
--   * UPDATE policy  — owners may only transition their own reminders
--                      to status = 'dismissed' (enforced by WITH CHECK).
--   * NO INSERT/DELETE policies — reminder creation stays with the
--     SECURITY DEFINER scheduling trigger, and 'sent'/'failed'
--     transitions plus cleanup run via the service-role daily cron,
--     which bypasses RLS and is unaffected.
-- =====================================================================

DROP POLICY IF EXISTS subcompliance_reminders_owner ON subcompliance_reminders;

-- Owners can read their own reminders.
CREATE POLICY subcompliance_reminders_select_own
  ON subcompliance_reminders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Owners can only dismiss: any client-issued UPDATE must leave the row
-- owned by them AND with status = 'dismissed'. Rewriting schedules into
-- a live state or fabricating 'sent'/'scheduled' rows is rejected by
-- the WITH CHECK clause.
CREATE POLICY subcompliance_reminders_dismiss_own
  ON subcompliance_reminders
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'dismissed'::subcompliance_reminder_status
  );

-- Defense in depth: client roles never insert or delete reminder rows
-- directly. Creation happens inside the SECURITY DEFINER trigger (runs
-- with the definer's privileges) and lifecycle updates happen via the
-- service role, so neither is affected by this revoke. FK cascade
-- deletes from parent documents are referential actions and also remain
-- unaffected.
REVOKE INSERT, DELETE ON subcompliance_reminders FROM anon, authenticated;


-- fix QA-015
-- ============================================================
-- QA-015: Storage bucket + RLS for document uploads
-- The app uploads to / signs URLs from the 'documents' bucket
-- (DOCUMENTS_BUCKET in app/(dashboard)/gcs/[id]/page.tsx).
-- Object paths are namespaced as <auth.uid()>/<gc_id>/<uuid>.<ext>,
-- so policies scope access to the owner via the first path segment.
-- ============================================================

-- Private bucket (createSignedUrl issues short-lived access URLs).
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Each authenticated user can only touch objects whose first folder
-- segment equals their user id.
drop policy if exists "documents insert own folder" on storage.objects;
create policy "documents insert own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents select own folder" on storage.objects;
create policy "documents select own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "documents delete own folder" on storage.objects;
create policy "documents delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );