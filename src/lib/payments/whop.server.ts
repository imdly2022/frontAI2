// Whop hosted checkout adapter.
// Docs: https://dev.whop.com
//
// Config in site_settings.payments.whop:
//   { enabled, api_key, webhook_secret }
// Each pricing_plan must have whop_plan_id (Plan ID, prefix "plan_").
import crypto from "node:crypto";

export type WhopConfig = {
  enabled?: boolean;
  api_key: string;
  webhook_secret: string;
};

const BASE = "https://api.whop.com/api/v5";

export async function createWhopCheckout(input: {
  cfg: WhopConfig;
  planId: string;
  metadata?: Record<string, string>;
  redirectUrl?: string;
}): Promise<{ checkout_url: string; id: string }> {
  const res = await fetch(`${BASE}/checkout_sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.cfg.api_key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      plan_id: input.planId,
      metadata: input.metadata ?? {},
      redirect_url: input.redirectUrl,
    }),
  });
  const json = await res.json() as { purchase_url?: string; id?: string; error?: { message?: string } };
  if (!res.ok || !json.purchase_url) {
    // Fallback: link-based checkout works even without API call
    const fallback = new URL(`https://whop.com/checkout/${input.planId}`);
    for (const [k, v] of Object.entries(input.metadata ?? {})) {
      fallback.searchParams.set(`metadata[${k}]`, v);
    }
    if (input.redirectUrl) fallback.searchParams.set("redirect_url", input.redirectUrl);
    return { checkout_url: fallback.toString(), id: "" };
  }
  return { checkout_url: json.purchase_url, id: json.id ?? "" };
}

export async function getWhopCheckoutSession(cfg: WhopConfig, id: string): Promise<{
  status?: string; receipt_id?: string; membership_id?: string;
}> {
  const res = await fetch(`${BASE}/checkout_sessions/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${cfg.api_key}` },
  });
  if (!res.ok) throw new Error(`Whop GET session failed [${res.status}]`);
  return await res.json() as { status?: string; receipt_id?: string; membership_id?: string };
}

// Whop signs webhooks with HMAC-SHA256 over the raw body in header
// `Whop-Signature` (format: `t=<ts>,v1=<sig>` or plain hex).
export function verifyWhopSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  let sig = signature;
  const parts = signature.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});
  if (parts.v1) sig = parts.v1;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
