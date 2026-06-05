
-- Vendor (official) prices for models_catalog: input / output / cached-input
ALTER TABLE public.models_catalog
  ADD COLUMN IF NOT EXISTS vendor_input_price_per_1k numeric,
  ADD COLUMN IF NOT EXISTS vendor_output_price_per_1k numeric,
  ADD COLUMN IF NOT EXISTS vendor_cached_input_price_per_1k numeric,
  ADD COLUMN IF NOT EXISTS cached_input_price_per_1k numeric;

-- UTM + ad-platform click IDs for traffic attribution
ALTER TABLE public.affiliate_clicks
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS utm_content text,
  ADD COLUMN IF NOT EXISTS utm_term text,
  ADD COLUMN IF NOT EXISTS fbclid text,
  ADD COLUMN IF NOT EXISTS gclid text,
  ADD COLUMN IF NOT EXISTS ttclid text;
