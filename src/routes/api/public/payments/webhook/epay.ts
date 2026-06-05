// Epay notify webhook. Verifies signature, marks the payment intent paid,
// credits the user's New API quota, then fires affiliate postbacks.
//
// Epay sends notify as application/x-www-form-urlencoded GET or POST.
// We respond with the literal "success" on success (epay protocol).

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEpayNotify, type EpayConfig } from "@/lib/payments/epay.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";


async function loadEpayKey(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "payments").maybeSingle();
  const s = (data?.value ?? {}) as { epay?: EpayConfig };
  return s.epay?.key ?? null;
}

async function handle(params: Record<string, string>): Promise<Response> {
  const key = await loadEpayKey();
  if (!key) return new Response("missing-config", { status: 500 });
  if (!verifyEpayNotify(params, key)) return new Response("sign-error", { status: 400 });

  const tradeStatus = params.trade_status;
  const outTradeNo = params.out_trade_no;
  const providerOrderId = params.trade_no ?? null;
  if (!outTradeNo) return new Response("missing-order", { status: 400 });
  if (tradeStatus !== "TRADE_SUCCESS") return new Response("success"); // ignore non-success

  const result = await fulfillPaymentIntent({
    intentId: outTradeNo,
    providerOrderId,
    notifyMeta: params,
  });
  if (result === "not-found") return new Response("intent-not-found", { status: 404 });

  return new Response("success");
}


export const Route = createFileRoute("/api/public/payments/webhook/epay")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const u = new URL(request.url);
        const params: Record<string, string> = {};
        u.searchParams.forEach((v, k) => { params[k] = v; });
        return handle(params);
      },
      POST: async ({ request }) => {
        const text = await request.text();
        const params: Record<string, string> = {};
        new URLSearchParams(text).forEach((v, k) => { params[k] = v; });
        return handle(params);
      },
    },
  },
});
