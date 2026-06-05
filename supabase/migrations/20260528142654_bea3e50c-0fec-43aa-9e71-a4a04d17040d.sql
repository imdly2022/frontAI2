ALTER TABLE public.pricing_plans
  ADD COLUMN IF NOT EXISTS creem_product_id text,
  ADD COLUMN IF NOT EXISTS whop_plan_id text;

-- Seed legal pages defaults if missing
INSERT INTO public.site_settings (key, value) VALUES
  ('legal_terms', jsonb_build_object(
     'title', 'Terms of Service',
     'updated', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
     'body_md', E'# Terms of Service\n\nReplace this content in Admin → Site & SEO.'
  )),
  ('legal_privacy', jsonb_build_object(
     'title', 'Privacy Policy',
     'updated', to_char(now() at time zone 'utc', 'YYYY-MM-DD'),
     'body_md', E'# Privacy Policy\n\nReplace this content in Admin → Site & SEO.'
  ))
ON CONFLICT (key) DO NOTHING;