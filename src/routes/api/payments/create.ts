// Payment broker. Frontend POSTs { plan_id, provider }; we create a
// payment_intent and return a hosted checkout URL. Supports Epay (Alipay
// / WeChat / USDT / card), Creem, and Whop.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppSession } from "@/lib/session.server";
import { getCookie } from "@tanstack/react-start/server";
import { buildEpayCheckoutUrl, mapProviderToType, type EpayConfig } from "@/lib/payments/epay.server";
import { createCreemCheckout, type CreemConfig } from "@/lib/payments/creem.server";
import { createWhopCheckout, type WhopConfig } from "@/lib/payments/whop.server";
import { createStripeCheckout, type StripeConfig } from "@/lib/payments/stripe.server";

const Body = z.object({
  plan_id: z.string().uuid(),
  provider: z.enum(["stripe", "alipay", "wechat", "usdt", "creem", "whop"]),
});

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/payments/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAppSession();
        if (!session.data.userId) return json(401, { error: "Unauthorized" });

        let body: unknown;
        try { body = await request.json(); }
        catch { return json(400, { error: "Invalid JSON" }); }
        const parsed = Body.safeParse(body);
        if (!parsed.success) return json(400, { error: "Invalid payload" });

        const { data: plan } = await supabaseAdmin
          .from("pricing_plans").select("*")
          .eq("id", parsed.data.plan_id).eq("is_active", true).maybeSingle();
        if (!plan) return json(404, { error: "Plan not found" });

        const { data: settingsRow } = await supabaseAdmin
          .from("site_settings").select("value").eq("key", "payments").maybeSingle();
        const settings = (settingsRow?.value ?? {}) as {
          epay?: EpayConfig & { enabled?: boolean };
          creem?: CreemConfig;
          whop?: WhopConfig;
          stripe?: StripeConfig;
        };

        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;
        const cookieClickId = getCookie("aff_click") ?? null;
        const { data: localUser } = await supabaseAdmin
          .from("users")
          .select("affiliate_id, click_id")
          .eq("newapi_user_id", session.data.userId)
          .maybeSingle();
        const clickId = localUser?.affiliate_id && localUser.click_id === cookieClickId ? cookieClickId : null;

        // Insert intent first so we have an id to pass to providers as request_id
        const { data: intent, error } = await supabaseAdmin
          .from("payment_intents").insert({
            newapi_user_id: session.data.userId,
            plan_id: plan.id,
            provider: parsed.data.provider,
            amount_usd: plan.price_usd,
            credits: plan.credits,
            bonus_credits: plan.bonus_credits,
            click_id: clickId,
            status: "pending",
          }).select().single();
        if (error || !intent) return json(500, { error: error?.message ?? "DB error" });

        let payUrl = "";
        let providerOrderId: string | null = null;
        try {
          if (parsed.data.provider === "stripe" && settings.stripe?.enabled) {
            const cfg = settings.stripe;
            const r = await createStripeCheckout({
              cfg,
              intentId: intent.id,
              amountUsd: Number(plan.price_usd),
              productName: plan.name,
              successUrl: `${base}/app/billing?paid=${intent.id}`,
              cancelUrl: `${base}/app/billing`,
              metadata: { plan_id: plan.id, order_no: intent.order_no ?? "" },
            });
            payUrl = r.checkout_url;
            providerOrderId = r.id;
          } else if (parsed.data.provider === "creem") {
            const cfg = settings.creem;
            if (!cfg?.enabled || !cfg.api_key) return json(503, { error: "Creem is not configured." });
            const productId = (plan as { creem_product_id?: string | null }).creem_product_id;
            if (!productId) return json(400, { error: "This plan has no Creem product mapped." });
            const r = await createCreemCheckout({
              cfg, productId, requestId: intent.id,
              successUrl: `${base}/app/billing?paid=${intent.id}`,
              metadata: { intent_id: intent.id, plan_id: plan.id, order_no: intent.order_no ?? "" },
            });
            payUrl = r.checkout_url;
            providerOrderId = r.id || null;
          } else if (parsed.data.provider === "whop") {
            const cfg = settings.whop;
            if (!cfg?.enabled || !cfg.api_key) return json(503, { error: "Whop is not configured." });
            const planId = (plan as { whop_plan_id?: string | null }).whop_plan_id;
            if (!planId) return json(400, { error: "This plan has no Whop plan mapped." });
            const r = await createWhopCheckout({
              cfg, planId,
              redirectUrl: `${base}/app/billing?paid=${intent.id}`,
              metadata: { intent_id: intent.id, plan_id: plan.id, order_no: intent.order_no ?? "" },
            });
            payUrl = r.checkout_url;
            providerOrderId = r.id || null;
          } else {
            const epay = settings.epay;
            if (!epay?.enabled || !epay.api_url || !epay.pid || !epay.key) {
              return json(503, { error: "Epay is not configured." });
            }
            const type = mapProviderToType(parsed.data.provider);
            if (!type) return json(400, { error: `Unsupported provider: ${parsed.data.provider}` });
            payUrl = buildEpayCheckoutUrl({
              cfg: epay,
              outTradeNo: intent.id,
              type,
              name: plan.name,
              amountUsd: Number(plan.price_usd),
              notifyUrl: `${base}/api/public/payments/webhook/epay`,
              returnUrl: `${base}/app/billing?paid=${intent.id}`,
            });
          }
        } catch (e) {
          return json(502, { error: e instanceof Error ? e.message : "Provider error" });
        }

        await supabaseAdmin.from("payment_intents")
          .update({ pay_url: payUrl, provider_order_id: providerOrderId })
          .eq("id", intent.id);

        return json(200, { pay_url: payUrl, intent_id: intent.id });
      },
    },
  },
});
