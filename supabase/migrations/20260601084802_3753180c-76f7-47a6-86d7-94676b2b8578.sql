
-- Extend users with profile + compliance fields
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS register_ip text,
  ADD COLUMN IF NOT EXISTS register_country text,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz;

-- Password reset tokens (email code based)
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  newapi_user_id bigint,
  code_hash text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_password_reset_email ON public.password_reset_tokens (email, created_at DESC);

-- Only the server (service_role) reads/writes these. No anon/auth access.
GRANT ALL ON public.password_reset_tokens TO service_role;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Notifications (站内通知 — optional; user requested only email, but
-- keep a minimal "site notifications" table so admin can announce too —
-- actually user said 仅邮件, skip.)
