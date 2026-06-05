// Outbound email via ZeptoMail API.
// All sends route through here so we get unified logging + variable rendering.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Vars = Record<string, string | number | null | undefined>;

type SendArgs = {
  to: string;
  to_name?: string | null;
  // Either pass a template_key (looked up in DB) + vars,
  // or pass subject + html/text directly.
  template_key?: string;
  vars?: Vars;
  subject?: string;
  html?: string;
  text?: string;
  campaign_id?: string | null;
  newapi_user_id?: number | null;
};

type EmailSettings = {
  enabled: boolean;
  from_email: string;
  from_name: string;
  reply_to?: string | null;
  api_url?: string | null;
  api_key?: string | null;
};

const DEFAULT_FROM_EMAIL = "noreply@novarelay.io";
const DEFAULT_FROM_NAME = "NovaRelay";
const DEFAULT_API_URL = "https://api.zeptomail.com/v1.1/email";

async function getEmailSettings(): Promise<EmailSettings> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<EmailSettings>;
  return {
    enabled: v.enabled ?? true,
    from_email: v.from_email || DEFAULT_FROM_EMAIL,
    from_name: v.from_name || DEFAULT_FROM_NAME,
    reply_to: v.reply_to ?? null,
    api_url: v.api_url || null,
    api_key: v.api_key || null,
  };
}

async function getSiteBranding(): Promise<{ site_name: string; site_url: string }> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "branding")
    .maybeSingle();
  const v = (data?.value ?? {}) as { name?: string; url?: string };
  return {
    site_name: v.name || "NovaRelay",
    site_url: v.url || "https://novarelay.io",
  };
}

// Replace {{var}} placeholders. Unknown vars become "".
export function renderTemplate(input: string, vars: Vars): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => {
    const v = vars[k];
    return v === null || v === undefined ? "" : String(v);
  });
}

type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
  template_key: string | null;
};

async function resolveTemplate(args: SendArgs): Promise<RenderedTemplate> {
  const branding = await getSiteBranding();
  const baseVars: Vars = { ...branding, ...args.vars };

  if (args.template_key) {
    const { data: tpl } = await supabaseAdmin
      .from("email_templates")
      .select("key, subject, html, text, is_enabled")
      .eq("key", args.template_key)
      .maybeSingle();
    if (!tpl) throw new Error(`Email template '${args.template_key}' not found`);
    if (!tpl.is_enabled) throw new Error(`Email template '${args.template_key}' is disabled`);
    const subject = renderTemplate(args.subject || tpl.subject, baseVars);
    const html = renderTemplate(args.html || tpl.html, baseVars);
    const text = renderTemplate(args.text || tpl.text || "", baseVars);
    return { subject, html, text, template_key: tpl.key };
  }

  if (!args.subject || (!args.html && !args.text)) {
    throw new Error("sendEmail requires either template_key or subject+html/text");
  }
  return {
    subject: renderTemplate(args.subject, baseVars),
    html: renderTemplate(args.html ?? "", baseVars),
    text: renderTemplate(args.text ?? "", baseVars),
    template_key: null,
  };
}

async function logSend(row: {
  to_email: string;
  to_name?: string | null;
  subject: string;
  template_key: string | null;
  campaign_id?: string | null;
  status: "sent" | "failed";
  error?: string | null;
  provider_message_id?: string | null;
  newapi_user_id?: number | null;
}) {
  try {
    await supabaseAdmin.from("email_send_log").insert(row);
  } catch (e) {
    console.error("[email] log insert failed", e);
  }
}

/**
 * Send a single transactional email. Returns true on success, false on
 * provider failure (no throw — callers usually shouldn't block on email).
 */
export async function sendEmail(args: SendArgs): Promise<boolean> {
  const settings = await getEmailSettings();
  if (!settings.enabled) {
    console.log("[email] disabled by admin, skipping →", args.to);
    return false;
  }

  let rendered: RenderedTemplate;
  try {
    rendered = await resolveTemplate(args);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] render failed", msg);
    await logSend({
      to_email: args.to,
      to_name: args.to_name ?? null,
      subject: args.subject ?? "(unrendered)",
      template_key: args.template_key ?? null,
      campaign_id: args.campaign_id ?? null,
      status: "failed",
      error: msg,
      newapi_user_id: args.newapi_user_id ?? null,
    });
    return false;
  }

  const rawApiKey = settings.api_key || process.env.ZEPTOMAIL_API_KEY;
  // Strip optional "Zoho-enczapikey " prefix if user pasted the full header value
  const apiKey = rawApiKey ? rawApiKey.replace(/^Zoho-enczapikey\s+/i, "").trim() : rawApiKey;
  const apiUrl = settings.api_url || DEFAULT_API_URL;
  if (!apiKey) {
    const err = "ZeptoMail API key not configured (set in Admin → Email Settings or ZEPTOMAIL_API_KEY env)";
    console.error("[email] " + err);
    await logSend({
      to_email: args.to,
      to_name: args.to_name ?? null,
      subject: rendered.subject,
      template_key: rendered.template_key,
      campaign_id: args.campaign_id ?? null,
      status: "failed",
      error: err,
      newapi_user_id: args.newapi_user_id ?? null,
    });
    return false;
  }

  const body: Record<string, unknown> = {
    from: { address: settings.from_email, name: settings.from_name },
    to: [{
      email_address: {
        address: args.to,
        ...(args.to_name ? { name: args.to_name } : {}),
      },
    }],
    subject: rendered.subject,
  };
  if (rendered.html) body.htmlbody = rendered.html;
  if (rendered.text) body.textbody = rendered.text;
  if (settings.reply_to) {
    body.reply_to = [{ address: settings.reply_to }];
  }

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Authorization": `Zoho-enczapikey ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) {
      console.error("[email] zeptomail error", res.status, raw);
      await logSend({
        to_email: args.to,
        to_name: args.to_name ?? null,
        subject: rendered.subject,
        template_key: rendered.template_key,
        campaign_id: args.campaign_id ?? null,
        status: "failed",
        error: `${res.status}: ${raw.slice(0, 500)}`,
        newapi_user_id: args.newapi_user_id ?? null,
      });
      return false;
    }
    let messageId: string | null = null;
    try {
      const parsed = JSON.parse(raw) as { data?: Array<{ message_id?: string }> };
      messageId = parsed.data?.[0]?.message_id ?? null;
    } catch { /* ignore */ }
    await logSend({
      to_email: args.to,
      to_name: args.to_name ?? null,
      subject: rendered.subject,
      template_key: rendered.template_key,
      campaign_id: args.campaign_id ?? null,
      status: "sent",
      provider_message_id: messageId,
      newapi_user_id: args.newapi_user_id ?? null,
    });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[email] network error", msg);
    await logSend({
      to_email: args.to,
      to_name: args.to_name ?? null,
      subject: rendered.subject,
      template_key: rendered.template_key,
      campaign_id: args.campaign_id ?? null,
      status: "failed",
      error: msg,
      newapi_user_id: args.newapi_user_id ?? null,
    });
    return false;
  }
}

/**
 * Legacy adapter: callers in this codebase already use the simple
 * { to, subject, text, html? } shape. Keep it working.
 */
export async function sendPlainEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  return sendEmail({
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });
}
