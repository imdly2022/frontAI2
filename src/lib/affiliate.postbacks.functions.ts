// User-facing CRUD for an affiliate's own postback URLs. The signed-in
// New API user must own an affiliate row; postbacks are scoped to that row.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "./session.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EVENTS = ["signup", "sale", "first_topup"] as const;

// Block SSRF: reject URLs targeting private, loopback, link-local, or
// cloud-metadata addresses. Only http(s) over public hostnames are allowed.
function assertSafePostbackUrl(raw: string): void {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Invalid postback URL");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Postback URL must use http or https");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host.endsWith(".local")
  ) {
    throw new Error("Postback URL host is not allowed");
  }
  // Block known cloud-metadata endpoints and IP-literal private ranges.
  const blockedExact = new Set([
    "169.254.169.254", // AWS / GCP / Azure metadata
    "100.100.100.200", // Alibaba metadata
    "metadata.google.internal",
    "metadata",
    "0.0.0.0",
  ]);
  if (blockedExact.has(host)) {
    throw new Error("Postback URL host is not allowed");
  }
  // IPv4 literal? Check private/loopback/link-local ranges.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0 ||
      a >= 224; // multicast / reserved
    if (isPrivate) throw new Error("Postback URL host is not allowed");
  }
  // IPv6 literal? Block loopback and unique-local / link-local.
  if (host.startsWith("[") || host.includes(":")) {
    const h = host.replace(/^\[|\]$/g, "");
    if (h === "::1" || h === "::" || /^fe80:/i.test(h) || /^fc|^fd/i.test(h)) {
      throw new Error("Postback URL host is not allowed");
    }
  }
}

async function getOrCreateAffiliate(userId: number, username: string) {
  const { data: existing } = await supabaseAdmin
    .from("affiliates").select("*").eq("newapi_user_id", userId).maybeSingle();
  if (existing) return existing;
  const slug = (username || `u${userId}`).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32) || `u${userId}`;
  // Read default commission rate from site_settings (referrals.defaultCommissionRate)
  let commissionRate = 0.10;
  const { data: setting } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "referrals").maybeSingle();
  const v = (setting?.value as { defaultCommissionRate?: number } | null)?.defaultCommissionRate;
  if (typeof v === "number" && v >= 0 && v <= 1) commissionRate = v;
  const { data, error } = await supabaseAdmin
    .from("affiliates").insert({
      newapi_user_id: userId,
      slug,
      display_name: username,
      status: "active",
      commission_rate: commissionRate,
    }).select().single();
  if (error) throw new Error(error.message);
  return data;
}


export const listMyPostbacks = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireSession();
  const aff = await getOrCreateAffiliate(s.auth.userId, s.username);
  const [pbRes, signupsRes, salesRes, commRes] = await Promise.all([
    supabaseAdmin.from("affiliate_postbacks").select("*").eq("affiliate_id", aff.id).order("created_at"),
    supabaseAdmin.from("affiliate_conversions").select("id", { count: "exact", head: true }).eq("affiliate_id", aff.id).eq("event", "signup"),
    supabaseAdmin.from("affiliate_conversions").select("id", { count: "exact", head: true }).eq("affiliate_id", aff.id).eq("event", "sale"),
    supabaseAdmin.from("affiliate_conversions").select("commission_usd").eq("affiliate_id", aff.id).eq("status", "approved"),
  ]);
  if (pbRes.error) throw new Error(pbRes.error.message);
  const lifetimeCommission = (commRes.data ?? []).reduce((sum, r) => sum + Number(r.commission_usd ?? 0), 0);
  return {
    affiliate: aff,
    postbacks: pbRes.data ?? [],
    stats: {
      signups: signupsRes.count ?? 0,
      sales: salesRes.count ?? 0,
      lifetime_commission_usd: lifetimeCommission,
    },
  };
});

export const upsertMyPostback = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    id: z.string().uuid().optional(),
    url_template: z.string().trim().min(8).max(2000).url(),
    events: z.array(z.enum(EVENTS)).min(1).max(3),
    is_enabled: z.boolean().default(true),
  }).parse(input))
  .handler(async ({ data }) => {
    assertSafePostbackUrl(data.url_template);
    const s = await requireSession();
    const aff = await getOrCreateAffiliate(s.auth.userId, s.username);
    if (data.id) {
      const { error } = await supabaseAdmin
        .from("affiliate_postbacks")
        .update({ url_template: data.url_template, events: data.events, is_enabled: data.is_enabled, updated_at: new Date().toISOString() })
        .eq("id", data.id).eq("affiliate_id", aff.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("affiliate_postbacks")
        .insert({ affiliate_id: aff.id, url_template: data.url_template, events: data.events, is_enabled: data.is_enabled });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteMyPostback = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const aff = await getOrCreateAffiliate(s.auth.userId, s.username);
    const { error } = await supabaseAdmin
      .from("affiliate_postbacks").delete().eq("id", data.id).eq("affiliate_id", aff.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
