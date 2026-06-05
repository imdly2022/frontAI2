import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyWhopSignature, type WhopConfig } from "@/lib/payments/whop.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";

async function loadConfig(): Promise<WhopConfig | null> {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "payments").maybeSingle();
  const s = (data?.value ?? {}) as { whop?: WhopConfig };
  return s.whop ?? null;
}

export const Route = createFileRoute("/api/public/payments/webhook/whop")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = await loadConfig();
        if (!cfg?.webhook_secret) return new Response("missing-config", { status: 500 });

        const raw = await request.text();
        const sig = request.headers.get("whop-signature")
          ?? request.headers.get("x-whop-signature") ?? "";
        if (!verifyWhopSignature(raw, sig, cfg.webhook_secret)) {
          console.error("whop webhook invalid signature", { hasSignature: Boolean(sig), bodyLength: raw.length });
          return new Response("invalid-signature", { status: 401 });
        }

        let event: { action?: string; data?: Record<string, unknown> };
        try { event = JSON.parse(raw); }
        catch { return new Response("bad-json", { status: 400 }); }

        const obj = (event.data ?? {}) as {
          id?: string;
          metadata?: Record<string, string>;
          status?: string;
          final_amount?: number;
        };
        const action = event.action ?? "";
        const isSuccess = /payment\.succeeded|membership\.went_valid/i.test(action)
          || obj.status === "completed" || obj.status === "paid";
        if (!isSuccess) return new Response("ignored");

        const intentId = obj.metadata?.intent_id;
        if (!intentId) return new Response("missing-intent", { status: 400 });

        let result: Awaited<ReturnType<typeof fulfillPaymentIntent>>;
        try {
          result = await fulfillPaymentIntent({
            intentId,
            providerOrderId: obj.id ?? null,
            notifyMeta: event as unknown as Record<string, unknown>,
          });
        } catch (e) {
          console.error("whop webhook fulfillment failed", e);
          return new Response("fulfillment-failed", { status: 500 });
        }
        if (result === "not-found") return new Response("intent-not-found", { status: 404 });
        return new Response("ok");
      },
    },
  },
});
