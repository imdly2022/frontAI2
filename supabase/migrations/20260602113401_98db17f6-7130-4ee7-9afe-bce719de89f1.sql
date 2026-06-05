CREATE TABLE public.webhook_event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  event_type text,
  event_id text,
  intent_id uuid,
  status_code integer NOT NULL,
  signature_valid boolean NOT NULL DEFAULT false,
  outcome text NOT NULL,
  error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_event_log_created_at ON public.webhook_event_log (created_at DESC);
CREATE INDEX idx_webhook_event_log_provider ON public.webhook_event_log (provider, created_at DESC);
CREATE UNIQUE INDEX uniq_webhook_event_log_provider_event_id
  ON public.webhook_event_log (provider, event_id)
  WHERE event_id IS NOT NULL;

GRANT ALL ON public.webhook_event_log TO service_role;

ALTER TABLE public.webhook_event_log ENABLE ROW LEVEL SECURITY;