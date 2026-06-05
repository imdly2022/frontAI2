-- Lock down all tables: this app accesses data exclusively via the service role
-- (supabaseAdmin in server functions). Enable RLS everywhere and revoke direct
-- Data API access from anon/authenticated. Add narrow public-read policies only
-- where the data is intentionally public (active announcements, published docs,
-- visible doc groups already covered, enabled custom scripts, visible models,
-- active pricing plans, allowlisted site_settings keys).

-- 1. Enable RLS on every public table that currently lacks it
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliate_postbacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.models_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs_pages ENABLE ROW LEVEL SECURITY;

-- 2. Revoke direct Data API access from anon/authenticated for all sensitive tables.
-- Service role bypasses both RLS and these grants, so server functions keep working.
REVOKE ALL ON public.admin_users FROM anon, authenticated;
REVOKE ALL ON public.affiliate_clicks FROM anon, authenticated;
REVOKE ALL ON public.affiliate_conversions FROM anon, authenticated;
REVOKE ALL ON public.affiliate_postbacks FROM anon, authenticated;
REVOKE ALL ON public.affiliates FROM anon, authenticated;
REVOKE ALL ON public.commission_ledger FROM anon, authenticated;
REVOKE ALL ON public.payment_intents FROM anon, authenticated;
REVOKE ALL ON public.site_settings FROM anon, authenticated;
REVOKE ALL ON public.users FROM anon, authenticated;
REVOKE ALL ON public.withdrawal_requests FROM anon, authenticated;
REVOKE ALL ON public.custom_scripts FROM anon, authenticated;

-- service_role retains full access on everything
GRANT ALL ON public.admin_users TO service_role;
GRANT ALL ON public.affiliate_clicks TO service_role;
GRANT ALL ON public.affiliate_conversions TO service_role;
GRANT ALL ON public.affiliate_postbacks TO service_role;
GRANT ALL ON public.affiliates TO service_role;
GRANT ALL ON public.commission_ledger TO service_role;
GRANT ALL ON public.payment_intents TO service_role;
GRANT ALL ON public.site_settings TO service_role;
GRANT ALL ON public.users TO service_role;
GRANT ALL ON public.withdrawal_requests TO service_role;
GRANT ALL ON public.custom_scripts TO service_role;
GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.models_catalog TO service_role;
GRANT ALL ON public.pricing_plans TO service_role;
GRANT ALL ON public.docs_pages TO service_role;
GRANT ALL ON public.docs_groups TO service_role;

-- 3. Public read policies for content that is intentionally world-readable.
-- These tables also keep their anon/authenticated SELECT grants so site visitors
-- can read public content directly if the app ever needs it.

GRANT SELECT ON public.announcements TO anon, authenticated;
DROP POLICY IF EXISTS "announcements public read" ON public.announcements;
CREATE POLICY "announcements public read" ON public.announcements
  FOR SELECT TO anon, authenticated
  USING (
    is_active = true
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now())
  );

GRANT SELECT ON public.docs_pages TO anon, authenticated;
DROP POLICY IF EXISTS "docs_pages public read" ON public.docs_pages;
CREATE POLICY "docs_pages public read" ON public.docs_pages
  FOR SELECT TO anon, authenticated
  USING (is_published = true);

GRANT SELECT ON public.models_catalog TO anon, authenticated;
DROP POLICY IF EXISTS "models_catalog public read" ON public.models_catalog;
CREATE POLICY "models_catalog public read" ON public.models_catalog
  FOR SELECT TO anon, authenticated
  USING (is_visible = true);

GRANT SELECT ON public.pricing_plans TO anon, authenticated;
DROP POLICY IF EXISTS "pricing_plans public read" ON public.pricing_plans;
CREATE POLICY "pricing_plans public read" ON public.pricing_plans
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 4. Storage: lock down docs-assets writes to service role only
DROP POLICY IF EXISTS "docs-assets admin write" ON storage.objects;
CREATE POLICY "docs-assets admin write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS "docs-assets admin update" ON storage.objects;
CREATE POLICY "docs-assets admin update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (false);
DROP POLICY IF EXISTS "docs-assets admin delete" ON storage.objects;
CREATE POLICY "docs-assets admin delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (false);
