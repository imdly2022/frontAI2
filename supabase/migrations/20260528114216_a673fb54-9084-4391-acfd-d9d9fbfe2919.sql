-- Phase 1: mirror of NewAPI users for local lookup + admin listing
CREATE TABLE public.users (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  newapi_user_id bigint NOT NULL UNIQUE,
  username text NOT NULL UNIQUE,
  email text NOT NULL UNIQUE,
  display_name text,
  affiliate_id uuid,
  click_id uuid,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_email_lower ON public.users (lower(email));
CREATE INDEX idx_users_affiliate_id ON public.users (affiliate_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Server functions use supabaseAdmin (service_role) which bypasses RLS.
-- No client-side policies needed; deny by default for anon/authenticated.
