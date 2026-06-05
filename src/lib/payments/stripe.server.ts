// Native Stripe Checkout adapter (REST + fetch, Worker-safe).
// Docs: https://docs.stripe.com/api/checkout/sessions
//
// Settings in site_settings.payments.stripe:
//   { enabled, secret_key, publishable_key, webhook_secret, test_mode }
// Falls back to env: STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET.
import crypto from "node:crypto";

export type StripeConfig = {
  enabled?: boolean;
  secret_key?: string;
  publishable_key?: string;
  webhook_secret?: string;
  test_mode?: boolean;
};

const API = "https://api.stripe.com/v1";

function resolveSecret(cfg?: StripeConfig): string {
  const k = (cfg?.secret_key || process.env.STRIPE_SECRET_KEY || "").trim();
  if (!k) throw new Error("Stripe secret key is not configured");
  return k;
}

function form(params: Record<string, string | number>): string {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) u.append(k, String(v));
  return u.toString();
}

export async function createStripeCheckout(input: {
  cfg: StripeConfig;
  intentId: string;
  amountUsd: number;
  productName: string;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  metadata?: Record<string, string>;
}): Promise<{ checkout_url: string; id: string }> {
  const secret = resolveSecret(input.cfg);
  const cents = Math.round(Number(input.amountUsd) * 100);
  if (!(cents > 0)) throw new Error("Invalid amount");

  const params: Record<string, string | number> = {
    mode: "payment",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.intentId,
    "line_items[0][quantity]": 1,
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": cents,
    "line_items[0][price_data][product_data][name]": input.productName,
    "metadata[intent_id]": input.intentId,
  };
  if (input.customerEmail) params.customer_email = input.customerEmail;
  for (const [k, v] of Object.entries(input.metadata ?? {})) {
    params[`metadata[${k}]`] = v;
  }

  const res = await fetch(`${API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });
  const json = (await res.json()) as { url?: string; id?: string; error?: { message?: string } };
  if (!res.ok || !json.url || !json.id) {
    throw new Error(`Stripe checkout failed [${res.status}]: ${json.error?.message ?? JSON.stringify(json)}`);
  }
  return { checkout_url: json.url, id: json.id };
}

export async function getStripeCheckoutSession(
  cfg: StripeConfig,
  sessionId: string,
): Promise<{ id?: string; payment_status?: string; status?: string; payment_intent?: string }> {
  const secret = resolveSecret(cfg);
  const res = await fetch(`${API}/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) throw new Error(`Stripe GET session failed [${res.status}]`);
  return (await res.json()) as { id?: string; payment_status?: string; status?: string; payment_intent?: string };
}

// Verify Stripe-Signature header: "t=<unix>,v1=<hex>[,v1=<hex>...]"
export function verifyStripeSignature(rawBody: string, header: string, secret: string, toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = header.split(",").map((p) => p.trim());
  let t = "";
  const sigs: string[] = [];
  for (const p of parts) {
    const [k, v] = p.split("=");
    if (k === "t") t = v;
    else if (k === "v1" && v) sigs.push(v);
  }
  if (!t || sigs.length === 0) return false;

  const ts = Number(t);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected);
  for (const sig of sigs) {
    const sigBuf = Buffer.from(sig);
    if (sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf)) return true;
  }
  return false;
}
