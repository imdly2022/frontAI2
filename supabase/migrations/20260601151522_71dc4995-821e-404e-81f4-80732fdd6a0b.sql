-- Email system: templates, campaigns, send log
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  subject text NOT NULL,
  html text NOT NULL DEFAULT '',
  text text,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_enabled boolean NOT NULL DEFAULT true,
  variables text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_id uuid REFERENCES public.email_templates(id) ON DELETE SET NULL,
  subject_override text,
  recipient_ids bigint[] NOT NULL DEFAULT '{}',
  recipient_count int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_campaigns TO service_role;
ALTER TABLE public.email_campaigns ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  to_name text,
  subject text NOT NULL,
  template_key text,
  campaign_id uuid,
  status text NOT NULL,
  error text,
  provider_message_id text,
  newapi_user_id bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_send_log_created_idx ON public.email_send_log (created_at DESC);
CREATE INDEX email_send_log_campaign_idx ON public.email_send_log (campaign_id);
CREATE INDEX email_send_log_template_idx ON public.email_send_log (template_key);
GRANT ALL ON public.email_send_log TO service_role;
ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Seed system templates
INSERT INTO public.email_templates (key, name, subject, html, text, description, is_system, variables) VALUES
('welcome',
 'Welcome email',
 'Welcome to {{site_name}}, {{first_name}}!',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a"><div style="text-align:center;margin-bottom:32px"><h1 style="font-size:24px;margin:0;font-weight:600">Welcome, {{first_name}}!</h1></div><p style="font-size:15px;line-height:1.6;color:#444">Your {{site_name}} account <strong>{{username}}</strong> is ready. You can sign in any time to start using our API.</p><div style="text-align:center;margin:32px 0"><a href="{{site_url}}/app" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px">Open dashboard</a></div><p style="font-size:13px;color:#888;line-height:1.6;margin-top:32px;padding-top:24px;border-top:1px solid #eee">If you didn''t create this account, please ignore this email or contact support.</p></div>',
 'Welcome {{first_name}}! Your {{site_name}} account {{username}} is ready. Sign in at {{site_url}}/app',
 'Sent after a user completes registration.',
 true,
 ARRAY['first_name','last_name','username','email','site_name','site_url']),

('password_reset',
 'Password reset code',
 'Your {{site_name}} password reset code',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a"><h1 style="font-size:22px;margin:0 0 16px;font-weight:600">Reset your password</h1><p style="font-size:15px;line-height:1.6;color:#444">Hi {{first_name}}, use the code below to reset your password. It expires in 15 minutes.</p><div style="text-align:center;margin:32px 0"><div style="display:inline-block;background:#f4f4f5;padding:18px 32px;border-radius:10px;font-family:''SF Mono'',Menlo,Consolas,monospace;font-size:28px;font-weight:600;letter-spacing:8px;color:#0f172a">{{code}}</div></div><p style="font-size:13px;color:#888;line-height:1.6;margin-top:32px;padding-top:24px;border-top:1px solid #eee">Didn''t request this? You can safely ignore this email — your password won''t change.</p></div>',
 'Hi {{first_name}}, your {{site_name}} password reset code is: {{code}}. Expires in 15 minutes.',
 'Sent when user requests a password reset.',
 true,
 ARRAY['first_name','username','email','code','site_name','site_url']),

('password_changed',
 'Password changed confirmation',
 'Your {{site_name}} password was changed',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a"><h1 style="font-size:22px;margin:0 0 16px;font-weight:600">Password changed</h1><p style="font-size:15px;line-height:1.6;color:#444">Hi {{first_name}}, your {{site_name}} password was just changed. If this was you, no action is needed.</p><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:24px 0"><p style="margin:0;font-size:14px;color:#991b1b;line-height:1.5"><strong>Not you?</strong> Contact support immediately and reset your password again.</p></div></div>',
 'Hi {{first_name}}, your {{site_name}} password was just changed. If this wasn''t you, contact support immediately.',
 'Sent after successful password change.',
 true,
 ARRAY['first_name','username','email','site_name','site_url']),

('low_balance',
 'Low balance alert',
 'Your {{site_name}} balance is running low',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,''Segoe UI'',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;color:#1a1a1a"><h1 style="font-size:22px;margin:0 0 16px;font-weight:600">Low balance reminder</h1><p style="font-size:15px;line-height:1.6;color:#444">Hi {{first_name}}, your {{site_name}} balance is currently <strong>${{balance}}</strong>. Top up to avoid any interruption to your API access.</p><div style="text-align:center;margin:32px 0"><a href="{{site_url}}/pricing" style="display:inline-block;background:#0f172a;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:500;font-size:14px">Top up now</a></div></div>',
 'Hi {{first_name}}, your {{site_name}} balance is ${{balance}}. Top up at {{site_url}}/pricing',
 'Optional reminder for users with low balance.',
 true,
 ARRAY['first_name','username','email','balance','site_name','site_url']);
