CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.gen_order_no(prefix text)
RETURNS text
LANGUAGE plpgsql
SET search_path TO public, extensions
AS $function$
DECLARE
  ts text;
  rnd text;
BEGIN
  ts := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  rnd := upper(substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 6));
  RETURN prefix || '-' || ts || '-' || rnd;
END;
$function$;