
-- Extend affiliates with running balances
ALTER TABLE public.affiliates
  ADD COLUMN IF NOT EXISTS available_balance_usd NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_balance_usd NUMERIC NOT NULL DEFAULT 0;

-- Extend affiliate_conversions with adjustment metadata
ALTER TABLE public.affiliate_conversions
  ADD COLUMN IF NOT EXISTS note TEXT,
  ADD COLUMN IF NOT EXISTS adjusted_by UUID,
  ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ;

-- commission_ledger: full audit trail of every balance change
CREATE TABLE IF NOT EXISTS public.commission_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn','adjust','convert_to_balance','withdraw_request','withdraw_paid','withdraw_reject','reject')),
  amount_usd NUMERIC NOT NULL,  -- signed: + adds to available, - removes
  note TEXT NOT NULL DEFAULT '',
  actor_id UUID,                 -- admin_users.id when admin acted, NULL when user/system
  conversion_id UUID,            -- ref to affiliate_conversions (optional)
  withdrawal_id UUID,            -- ref to withdrawal_requests (optional)
  balance_after NUMERIC NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_ledger_aff ON public.commission_ledger(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_commission_ledger_type ON public.commission_ledger(type);

GRANT ALL ON public.commission_ledger TO service_role;
ALTER TABLE public.commission_ledger ENABLE ROW LEVEL SECURITY;

-- withdrawal_requests
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  affiliate_id UUID NOT NULL,
  amount_usd NUMERIC NOT NULL CHECK (amount_usd > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','paid')),
  contact_note TEXT NOT NULL DEFAULT '',  -- user-provided payment info / contact
  admin_note TEXT,
  processed_by UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_aff ON public.withdrawal_requests(affiliate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON public.withdrawal_requests(status);

GRANT ALL ON public.withdrawal_requests TO service_role;
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Trigger: maintain affiliates.available_balance_usd from ledger
CREATE OR REPLACE FUNCTION public.apply_commission_ledger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance NUMERIC;
BEGIN
  UPDATE public.affiliates
     SET available_balance_usd = available_balance_usd + NEW.amount_usd,
         updated_at = now()
   WHERE id = NEW.affiliate_id
  RETURNING available_balance_usd INTO new_balance;

  NEW.balance_after := COALESCE(new_balance, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_commission_ledger ON public.commission_ledger;
CREATE TRIGGER trg_apply_commission_ledger
  BEFORE INSERT ON public.commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.apply_commission_ledger();
