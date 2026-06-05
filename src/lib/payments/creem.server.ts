// Creem.io hosted checkout adapter.
// Docs: https://docs.creem.io
//
// Config in site_settings.payments.creem:
//   { enabled, api_key, webhook_secret, test_mode }
// Each pricing_plan must have creem_product_id set.
import crypto from "node:crypto";

export type CreemConfig = {
  enabled?: boolean;
  api_key: string;
  webhook_secret: string;
  test_mode?: boolean;
};

const isTestKey = (apiKey?: string) => !!apiKey && apiKey.startsWith("creem_test_");

const BASE = (testMode?: boolean, apiKey?: string) =>
  (testMode || isTestKey(apiKey)) ? "https://test-api.creem.io/v1" : "https://api.creem.io/v1";

export async function createCreemCheckout(input: {
  cfg: CreemConfig;
  productId: string;
  requestId: string;       // our payment_intent id (used to reconcile)
  successUrl: string;
  metadata?: Record<string, string>;
}): Promise<{ checkout_url: string; id: string }> {
  const res = await fetch(`${BASE(input.cfg.test_mode, input.cfg.api_key)}/checkouts`, {
    method: "POST",
    headers: {
      "x-api-key": input.cfg.api_key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      product_id: input.productId,
      request_id: input.requestId,
      success_url: input.successUrl,
      metadata: input.metadata ?? {},
    }),
  });
  const json = await res.json() as { checkout_url?: string; id?: string; message?: string };
  if (!res.ok || !json.checkout_url) {
    throw new Error(`Creem checkout failed [${res.status}]: ${json.message ?? JSON.stringify(json)}`);
  }
  return { checkout_url: json.checkout_url, id: json.id ?? "" };
}

export async function getCreemCheckout(cfg: CreemConfig, checkoutId: string): Promise<{
  status?: string; id?: string; order?: { id?: string; status?: string };
}> {
  const res = await fetch(`${BASE(cfg.test_mode, cfg.api_key)}/checkouts?checkout_id=${encodeURIComponent(checkoutId)}`, {
    headers: { "x-api-key": cfg.api_key },
  });
  if (!res.ok) throw new Error(`Creem GET checkout failed [${res.status}]`);
  return await res.json() as { status?: string; id?: string; order?: { id?: string; status?: string } };
}

// Creem signs webhooks with HMAC-SHA256 over the raw request body, hex,
// delivered in the `creem-signature` header.
export function verifyCreemSignature(rawBody: string, signature: string, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
