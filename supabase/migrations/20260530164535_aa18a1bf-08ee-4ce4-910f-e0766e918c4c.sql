INSERT INTO public.site_settings (key, value)
VALUES ('company', '{"name":"LUSHCART TRADE LTD","address":"SUITE 35329, 61 BRIDGE STREET, KINGTON, UNITED KINGDOM, HR5 3DJ","registrationNo":"","vatNo":""}'::jsonb)
ON CONFLICT (key) DO NOTHING;