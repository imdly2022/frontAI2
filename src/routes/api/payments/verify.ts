// Verify a payment intent by querying the provider's API directly.
// Used as a fallback when the webhook hasn't arrived yet (e.g. webhook
// not configured in the provider dashboard, or transient network issue).
//
// POST { intent_id } -> { status: "paid" | "pending" | "failed" }
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAppSession } from "@/lib/session.server";
import { getCreemCheckout, type CreemConfig } from "@/lib/payments/creem.server";
import { getWhopCheckoutSession, type WhopConfig } from "@/lib/payments/whop.server";
import { getStripeCheckoutSession, type StripeConfig } from "@/lib/payments/stripe.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";

const Body = z.object({ intent_id: z.string().uuid() });
const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/payments/verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await getAppSession();
        if (!session.data.userId) return json(401, { error: "Unauthorized" });

        let body: unknown;
        try { body = await request.json(); } catch { return json(400, { error: "Invalid JSON" }); }
        const parsed = Body.safeParse(body);
        if (!parsed.success) return json(400, { error: "Invalid payload" });

        const { data: intent } = await supabaseAdmin
          .from("payment_intents").select("*").eq("id", parsed.data.intent_id).maybeSingle();
        if (!intent) return json(404, { error: "Not found" });
        if (Number(intent.newapi_user_id) !== Number(session.data.userId)) {
          return json(403, { error: "Forbidden" });
        }
        if (intent.status === "paid") return json(200, { status: "paid" });

        const { data: settingsRow } = await supabaseAdmin
          .from("site_settings").select("value").eq("key", "payments").maybeSingle();
        const settings = (settingsRow?.value ?? {}) as { creem?: CreemConfig; whop?: WhopConfig; stripe?: StripeConfig };

        try {
          if (intent.provider === "stripe" && intent.provider_order_id && settings.stripe?.enabled) {
            const r = await getStripeCheckoutSession(settings.stripe, intent.provider_order_id);
            if ((r.payment_status ?? "").toLowerCase() === "paid") {
              await fulfillPaymentIntent({
                intentId: intent.id,
                providerOrderId: r.payment_intent ?? r.id ?? intent.provider_order_id,
                notifyMeta: { source: "verify", stripe: r as unknown as Record<string, unknown> },
              });
              return json(200, { status: "paid" });
            }
          } else if (intent.provider === "creem" && intent.provider_order_id && settings.creem?.api_key) {
            const r = await getCreemCheckout(settings.creem, intent.provider_order_id);
            const paid = (r.status ?? "").toLowerCase() === "completed"
              || (r.status ?? "").toLowerCase() === "paid"
              || (r.order?.status ?? "").toLowerCase() === "paid";
            if (paid) {
              await fulfillPaymentIntent({
                intentId: intent.id,
                providerOrderId: r.order?.id ?? r.id ?? intent.provider_order_id,
                notifyMeta: { source: "verify", creem: r as unknown as Record<string, unknown> },
              });
              return json(200, { status: "paid" });
            }
          } else if (intent.provider === "whop" && intent.provider_order_id && settings.whop?.api_key) {
            const r = await getWhopCheckoutSession(settings.whop, intent.provider_order_id);
            const paid = (r.status ?? "").toLowerCase() === "completed"
              || Boolean(r.receipt_id) || Boolean(r.membership_id);
            if (paid) {
              await fulfillPaymentIntent({
                intentId: intent.id,
                providerOrderId: r.receipt_id ?? r.membership_id ?? intent.provider_order_id,
                notifyMeta: { source: "verify", whop: r as unknown as Record<string, unknown> },
              });
              return json(200, { status: "paid" });
            }
          }
        } catch (e) {
          return json(502, { error: e instanceof Error ? e.message : "Verify failed" });
        }

        return json(200, { status: intent.status });
      },
    },
  },
});
