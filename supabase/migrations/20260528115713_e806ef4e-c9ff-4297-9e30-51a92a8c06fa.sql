
-- Universal order number generator: PREFIX-YYYYMMDD-XXXXXX (base36 random)
CREATE OR REPLACE FUNCTION public.gen_order_no(prefix text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  ts text;
  rnd text;
BEGIN
  ts := to_char(now() AT TIME ZONE 'UTC', 'YYYYMMDD');
  rnd := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6));
  RETURN prefix || '-' || ts || '-' || rnd;
END;
$$;

-- payment_intents: TP-...
ALTER TABLE public.payment_intents ADD COLUMN IF NOT EXISTS order_no text;
UPDATE public.payment_intents SET order_no = public.gen_order_no('TP') WHERE order_no IS NULL;
ALTER TABLE public.payment_intents ALTER COLUMN order_no SET NOT NULL;
ALTER TABLE public.payment_intents ALTER COLUMN order_no SET DEFAULT public.gen_order_no('TP');
CREATE UNIQUE INDEX IF NOT EXISTS payment_intents_order_no_key ON public.payment_intents(order_no);

-- commission_ledger: CM-...
ALTER TABLE public.commission_ledger ADD COLUMN IF NOT EXISTS order_no text;
UPDATE public.commission_ledger SET order_no = public.gen_order_no('CM') WHERE order_no IS NULL;
ALTER TABLE public.commission_ledger ALTER COLUMN order_no SET NOT NULL;
ALTER TABLE public.commission_ledger ALTER COLUMN order_no SET DEFAULT public.gen_order_no('CM');
CREATE UNIQUE INDEX IF NOT EXISTS commission_ledger_order_no_key ON public.commission_ledger(order_no);

-- withdrawal_requests: WD-...
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS order_no text;
UPDATE public.withdrawal_requests SET order_no = public.gen_order_no('WD') WHERE order_no IS NULL;
ALTER TABLE public.withdrawal_requests ALTER COLUMN order_no SET NOT NULL;
ALTER TABLE public.withdrawal_requests ALTER COLUMN order_no SET DEFAULT public.gen_order_no('WD');
CREATE UNIQUE INDEX IF NOT EXISTS withdrawal_requests_order_no_key ON public.withdrawal_requests(order_no);
