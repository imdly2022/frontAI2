// Server-to-server conversion uploaders for Facebook CAPI, Google Ads
// (Enhanced Conversions / gclid uploads), and TikTok Events API.
//
// Configuration is stored in public.site_settings under key "tracking":
//   {
//     facebook: { pixel_id, access_token, test_event_code? },
//     google:   { conversion_id, conversion_label, api_secret? },
//     tiktok:   { pixel_code, access_token }
//   }
//
// All calls are fire-and-forget — failures are logged but never throw.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type S2SAttrib = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
};

export type S2SEvent = {
  event: "Lead" | "Purchase";
  /** Stable id so duplicates are deduped server-side. */
  event_id: string;
  email?: string;
  ip?: string;
  user_agent?: string;
  value_usd?: number;
  currency?: string;
  attrib: S2SAttrib;
};

type TrackingConfig = {
  facebook?: { pixel_id?: string; access_token?: string; test_event_code?: string };
  google?: { conversion_id?: string; conversion_label?: string };
  tiktok?: { pixel_code?: string; access_token?: string };
};

async function loadConfig(): Promise<TrackingConfig> {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "tracking").maybeSingle();
  return (data?.value ?? {}) as TrackingConfig;
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s.trim().toLowerCase()));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fireFacebook(cfg: TrackingConfig["facebook"], ev: S2SEvent): Promise<void> {
  if (!cfg?.pixel_id || !cfg?.access_token) return;
  const user_data: Record<string, unknown> = {};
  if (ev.email) user_data.em = [await sha256(ev.email)];
  if (ev.ip) user_data.client_ip_address = ev.ip;
  if (ev.user_agent) user_data.client_user_agent = ev.user_agent;
  if (ev.attrib.fbclid) user_data.fbc = `fb.1.${Date.now()}.${ev.attrib.fbclid}`;
  const body = {
    data: [{
      event_name: ev.event,
      event_time: Math.floor(Date.now() / 1000),
      event_id: ev.event_id,
      action_source: "website",
      user_data,
      custom_data: ev.value_usd != null ? { value: ev.value_usd, currency: ev.currency ?? "USD" } : undefined,
    }],
    ...(cfg.test_event_code ? { test_event_code: cfg.test_event_code } : {}),
  };
  const url = `https://graph.facebook.com/v19.0/${encodeURIComponent(cfg.pixel_id)}/events?access_token=${encodeURIComponent(cfg.access_token)}`;
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

async function fireGoogle(cfg: TrackingConfig["google"], ev: S2SEvent): Promise<void> {
  if (!cfg?.conversion_id || !ev.attrib.gclid) return;
  // Lightweight gclid uploader using the public conversion URL (no API key needed for basic tracking).
  // Production-grade uploads should go through the Google Ads API; this falls back to the public
  // server-side conversion endpoint which logs the conversion for the configured campaign.
  const params = new URLSearchParams({
    cid: cfg.conversion_id,
    label: cfg.conversion_label ?? "",
    gclid: ev.attrib.gclid,
    value: String(ev.value_usd ?? 0),
    currency: ev.currency ?? "USD",
    event: ev.event,
  });
  await fetch(`https://www.googleadservices.com/pagead/conversion/${encodeURIComponent(cfg.conversion_id)}/?${params.toString()}`, { method: "GET" });
}

async function fireTikTok(cfg: TrackingConfig["tiktok"], ev: S2SEvent): Promise<void> {
  if (!cfg?.pixel_code || !cfg?.access_token) return;
  const user: Record<string, unknown> = {};
  if (ev.email) user.email = await sha256(ev.email);
  if (ev.ip) user.ip = ev.ip;
  if (ev.user_agent) user.user_agent = ev.user_agent;
  if (ev.attrib.ttclid) user.ttclid = ev.attrib.ttclid;
  const body = {
    event_source: "web",
    event_source_id: cfg.pixel_code,
    data: [{
      event: ev.event === "Lead" ? "CompleteRegistration" : "CompletePayment",
      event_time: Math.floor(Date.now() / 1000),
      event_id: ev.event_id,
      user,
      properties: ev.value_usd != null ? { value: ev.value_usd, currency: ev.currency ?? "USD" } : {},
    }],
  };
  await fetch("https://business-api.tiktok.com/open_api/v1.3/event/track/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Access-Token": cfg.access_token },
    body: JSON.stringify(body),
  });
}

export async function fireS2S(ev: S2SEvent): Promise<void> {
  let cfg: TrackingConfig;
  try { cfg = await loadConfig(); } catch { return; }
  await Promise.allSettled([
    fireFacebook(cfg.facebook, ev).catch((e) => console.error("FB CAPI failed", e)),
    fireGoogle(cfg.google, ev).catch((e) => console.error("Google ads failed", e)),
    fireTikTok(cfg.tiktok, ev).catch((e) => console.error("TikTok events failed", e)),
  ]);
}

/** Read tt_attrib cookie + request headers into a S2SAttrib + transport. */
export function readAttribFromCookie(raw: string | undefined): S2SAttrib {
  if (!raw) return {};
  try { return JSON.parse(raw) as S2SAttrib; } catch { return {}; }
}
