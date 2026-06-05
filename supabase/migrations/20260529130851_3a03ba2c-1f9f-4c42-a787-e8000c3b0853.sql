-- Add missing foreign keys so PostgREST can resolve embedded relations
ALTER TABLE public.users
  ADD CONSTRAINT users_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE SET NULL;

ALTER TABLE public.users
  ADD CONSTRAINT users_click_id_fkey
  FOREIGN KEY (click_id) REFERENCES public.affiliate_clicks(click_id) ON DELETE SET NULL;

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;

ALTER TABLE public.commission_ledger
  ADD CONSTRAINT commission_ledger_affiliate_id_fkey
  FOREIGN KEY (affiliate_id) REFERENCES public.affiliates(id) ON DELETE CASCADE;

ALTER TABLE public.commission_ledger
  ADD CONSTRAINT commission_ledger_conversion_id_fkey
  FOREIGN KEY (conversion_id) REFERENCES public.affiliate_conversions(id) ON DELETE SET NULL;

ALTER TABLE public.commission_ledger
  ADD CONSTRAINT commission_ledger_withdrawal_id_fkey
  FOREIGN KEY (withdrawal_id) REFERENCES public.withdrawal_requests(id) ON DELETE SET NULL;

ALTER TABLE public.affiliate_conversions
  ADD CONSTRAINT affiliate_conversions_payment_intent_id_fkey
  FOREIGN KEY (payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';