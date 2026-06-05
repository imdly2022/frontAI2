// 易支付 (Epay / 彩虹易支付) adapter.
// Single endpoint handles Alipay, WeChat Pay, QQ Pay, USDT, and credit cards
// depending on the `type` field. Signature: MD5 of sorted non-empty params
// (excluding sign/sign_type) + key, lowercase.
//
// Settings live in site_settings.payments.epay:
//   { api_url, pid, key, enabled_types: ["alipay","wxpay","usdt","stripe"] }
//
// The webhook URL configured in the Epay merchant panel must point to
//   <site>/api/public/payments/webhook/epay
// and the return URL to <site>/app/billing?paid=:order_id

import crypto from "node:crypto";

export type EpayConfig = {
  api_url: string;          // e.g. https://pay.example.com
  pid: string;              // merchant id
  key: string;              // merchant key
  enabled_types?: string[]; // optional whitelist
};

// Map our provider id → epay `type`
const TYPE_MAP: Record<string, string> = {
  alipay: "alipay",
  wechat: "wxpay",
  usdt: "usdt",
  stripe: "stripe", // some epay forks support card via "stripe" channel
};

export function mapProviderToType(provider: string): string | null {
  return TYPE_MAP[provider] ?? null;
}

export function epaySign(params: Record<string, string>, key: string): string {
  const filtered = Object.entries(params)
    .filter(([k, v]) => v !== "" && v != null && k !== "sign" && k !== "sign_type")
    .sort(([a], [b]) => (a < b ? -1 : 1));
  const str = filtered.map(([k, v]) => `${k}=${v}`).join("&");
  return crypto.createHash("md5").update(str + key).digest("hex");
}

export function buildEpayCheckoutUrl(input: {
  cfg: EpayConfig;
  outTradeNo: string;
  type: string;
  name: string;
  amountUsd: number;
  notifyUrl: string;
  returnUrl: string;
  // Some Chinese aggregators require CNY. We expose money as-is and let the
  // operator configure plan prices in CNY if needed via plan.description.
  currency?: "USD" | "CNY";
}): string {
  const money = input.amountUsd.toFixed(2);
  const params: Record<string, string> = {
    pid: input.cfg.pid,
    type: input.type,
    out_trade_no: input.outTradeNo,
    notify_url: input.notifyUrl,
    return_url: input.returnUrl,
    name: input.name,
    money,
  };
  params.sign = epaySign(params, input.cfg.key);
  params.sign_type = "MD5";
  const qs = new URLSearchParams(params).toString();
  const base = input.cfg.api_url.replace(/\/$/, "");
  return `${base}/submit.php?${qs}`;
}

export function verifyEpayNotify(
  params: Record<string, string>,
  key: string,
): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const expected = epaySign(params, key);
  return sign.toLowerCase() === expected.toLowerCase();
}
