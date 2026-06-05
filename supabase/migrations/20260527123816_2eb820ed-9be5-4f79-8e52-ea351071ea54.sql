
-- ===== Site CMS =====
CREATE TABLE public.site_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.site_settings TO service_role;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_usd NUMERIC(12,2) NOT NULL,
  credits NUMERIC(14,4) NOT NULL,
  bonus_credits NUMERIC(14,4) NOT NULL DEFAULT 0,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.pricing_plans TO service_role;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.models_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  category TEXT,
  description TEXT,
  context_length INT,
  input_price_per_1k NUMERIC(12,6),
  output_price_per_1k NUMERIC(12,6),
  modality TEXT NOT NULL DEFAULT 'chat',
  badges TEXT[] NOT NULL DEFAULT '{}',
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.models_catalog TO service_role;
ALTER TABLE public.models_catalog ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.docs_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  body_md TEXT NOT NULL DEFAULT '',
  category TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.docs_pages TO service_role;
ALTER TABLE public.docs_pages ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.custom_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  placement TEXT NOT NULL CHECK (placement IN ('head','body_end')),
  page_scope TEXT NOT NULL DEFAULT 'global',
  code TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.custom_scripts TO service_role;
ALTER TABLE public.custom_scripts ENABLE ROW LEVEL SECURITY;

-- ===== Affiliates =====
CREATE TABLE public.affiliates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newapi_user_id BIGINT UNIQUE NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  payout_method TEXT,
  payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','suspended')),
  total_earnings NUMERIC(14,4) NOT NULL DEFAULT 0,
  total_paid NUMERIC(14,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliates TO service_role;
ALTER TABLE public.affiliates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.affiliate_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  click_id UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  sub1 TEXT, sub2 TEXT, sub3 TEXT, sub4 TEXT, sub5 TEXT,
  ip TEXT,
  user_agent TEXT,
  referrer TEXT,
  landing_path TEXT,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_clicks_aff_idx ON public.affiliate_clicks(affiliate_id, created_at DESC);
GRANT ALL ON public.affiliate_clicks TO service_role;
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.affiliate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  click_id UUID REFERENCES public.affiliate_clicks(click_id) ON DELETE SET NULL,
  newapi_user_id BIGINT,
  payment_intent_id UUID,
  event TEXT NOT NULL CHECK (event IN ('signup','ftd','sale')),
  amount_usd NUMERIC(14,4) NOT NULL DEFAULT 0,
  commission_usd NUMERIC(14,4) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','rejected')),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX affiliate_conv_aff_idx ON public.affiliate_conversions(affiliate_id, created_at DESC);
GRANT ALL ON public.affiliate_conversions TO service_role;
ALTER TABLE public.affiliate_conversions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.affiliate_postbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id UUID NOT NULL REFERENCES public.affiliates(id) ON DELETE CASCADE,
  url_template TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{sale}',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  fire_count INT NOT NULL DEFAULT 0,
  last_status INT,
  last_fired_at TIMESTAMPTZ,
  last_response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.affiliate_postbacks TO service_role;
ALTER TABLE public.affiliate_postbacks ENABLE ROW LEVEL SECURITY;

-- ===== Payments =====
CREATE TABLE public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newapi_user_id BIGINT NOT NULL,
  plan_id UUID REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
  amount_usd NUMERIC(14,4) NOT NULL,
  credits NUMERIC(14,4) NOT NULL,
  bonus_credits NUMERIC(14,4) NOT NULL DEFAULT 0,
  provider TEXT NOT NULL,
  provider_order_id TEXT,
  pay_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','refunded','expired')),
  click_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_intents_user_idx ON public.payment_intents(newapi_user_id, created_at DESC);
GRANT ALL ON public.payment_intents TO service_role;
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

-- ===== Admin =====
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newapi_user_id BIGINT UNIQUE NOT NULL,
  email TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_users TO service_role;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- ===== Seed minimal CMS defaults =====
INSERT INTO public.site_settings (key, value) VALUES
  ('branding', '{"name":"NovaGate AI","tagline":"One API. Every Model.","logoEmoji":"⚡"}'::jsonb),
  ('hero', '{"headline":"All the world''s AI models, one OpenAI-compatible endpoint.","subheadline":"Stop juggling 12 provider accounts. Get GPT, Claude, Gemini, DeepSeek, Llama and more behind a single billing dashboard — pay only for what you use.","ctaPrimary":"Get your API key","ctaSecondary":"View pricing"}'::jsonb),
  ('contact', '{"email":"support@example.com","docsUrl":"/docs","statusUrl":"/status"}'::jsonb),
  ('newapi', '{"baseUrl":"","configured":false}'::jsonb);

INSERT INTO public.pricing_plans (name, description, price_usd, credits, bonus_credits, is_popular, sort_order) VALUES
  ('Starter', 'Great for tinkering and side projects.', 10, 10, 0, false, 1),
  ('Builder', 'For active developers shipping real apps.', 50, 50, 5, true, 2),
  ('Scale', 'High-volume production workloads.', 200, 200, 30, false, 3),
  ('Enterprise', 'Custom limits, dedicated support.', 1000, 1000, 200, false, 4);

INSERT INTO public.models_catalog (slug, display_name, provider, category, description, context_length, input_price_per_1k, output_price_per_1k, badges, sort_order) VALUES
  ('gpt-5', 'GPT-5', 'OpenAI', 'flagship', 'OpenAI''s most capable model. Strong reasoning, vision, long context.', 200000, 0.005, 0.015, '{"popular"}', 1),
  ('claude-sonnet-4', 'Claude Sonnet 4', 'Anthropic', 'flagship', 'Anthropic''s balanced flagship. Excellent for coding and long documents.', 200000, 0.003, 0.015, '{"popular"}', 2),
  ('gemini-2.5-pro', 'Gemini 2.5 Pro', 'Google', 'flagship', '1M-token context, native multimodal.', 1000000, 0.00125, 0.005, '{}', 3),
  ('deepseek-v3', 'DeepSeek V3', 'DeepSeek', 'cost-effective', 'Open-weight model with strong coding performance at low cost.', 64000, 0.00027, 0.0011, '{"value"}', 4),
  ('llama-3.3-70b', 'Llama 3.3 70B', 'Meta', 'open-source', 'Open-source workhorse.', 128000, 0.00059, 0.00079, '{}', 5),
  ('gpt-image-1', 'GPT-Image 1', 'OpenAI', 'image', 'High-quality image generation.', NULL, NULL, NULL, '{"image"}', 6);

INSERT INTO public.docs_pages (slug, title, description, category, sort_order, body_md) VALUES
  ('quickstart', 'Quickstart', 'Make your first API call in under a minute.', 'getting-started', 1,
$$# Quickstart

Our API is **fully OpenAI-compatible**. If you have code that talks to OpenAI, just swap the base URL and key.

## 1. Get your key

Sign up, then create an API key from your dashboard.

## 2. Make a request

```bash
curl https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-5",
    "messages": [{"role":"user","content":"Hello"}]
  }'
```

That's it.
$$),
  ('models', 'Models', 'Browse every model you can call.', 'getting-started', 2,
'# Models

See the [Models page](/models) for the live, searchable catalog with pricing.'),
  ('billing', 'Billing & Credits', 'How credits and pricing work.', 'account', 3,
'# Billing

You pay per token. Buy credits in bulk — they never expire. See [Pricing](/pricing).');
