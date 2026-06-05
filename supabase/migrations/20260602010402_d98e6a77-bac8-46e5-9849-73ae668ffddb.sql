UPDATE public.site_settings
SET value = jsonb_set(
  value,
  '{api_key}',
  to_jsonb(regexp_replace(value->>'api_key', '^Zoho-enczapikey\s+', '', 'i'))
)
WHERE key = 'email' AND value->>'api_key' ILIKE 'Zoho-enczapikey %';