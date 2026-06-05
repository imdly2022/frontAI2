import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyCreemSignature, type CreemConfig } from "@/lib/payments/creem.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";

async function loadConfig(): Promise<CreemConfig | null> {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "payments").maybeSingle();
  const s = (data?.value ?? {}) as { creem?: CreemConfig };
  return s.creem ?? null;
}

export const Route = createFileRoute("/api/public/payments/webhook/creem")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const cfg = await loadConfig();
        if (!cfg?.webhook_secret) return new Response("missing-config", { status: 500 });

        const raw = await request.text();
        const sig = request.headers.get("creem-signature") ?? request.headers.get("x-creem-signature") ?? "";
        if (!verifyCreemSignature(raw, sig, cfg.webhook_secret)) {
          console.error("creem webhook invalid signature", { hasSignature: Boolean(sig), bodyLength: raw.length });
          return new Response("invalid-signature", { status: 401 });
        }

        let event: { eventType?: string; object?: Record<string, unknown> };
        try { event = JSON.parse(raw); }
        catch { return new Response("bad-json", { status: 400 }); }

        const obj = (event.object ?? {}) as {
          request_id?: string;
          id?: string;
          order?: { id?: string };
          metadata?: Record<string, string>;
          status?: string;
        };
        const eventType = event.eventType ?? "";
        // Only fulfill on a successful checkout / payment
        const isSuccess = /checkout\.completed|payment\.succeeded|subscription\.paid/i.test(eventType)
          || obj.status === "paid" || obj.status === "completed";
        if (!isSuccess) return new Response("ignored");

        const intentId = obj.request_id ?? obj.metadata?.intent_id;
        if (!intentId) return new Response("missing-intent", { status: 400 });

        let result: Awaited<ReturnType<typeof fulfillPaymentIntent>>;
        try {
          result = await fulfillPaymentIntent({
            intentId,
            providerOrderId: obj.order?.id ?? obj.id ?? null,
            notifyMeta: event as unknown as Record<string, unknown>,
          });
        } catch (e) {
          console.error("creem webhook fulfillment failed", e);
          return new Response("fulfillment-failed", { status: 500 });
        }
        if (result === "not-found") return new Response("intent-not-found", { status: 404 });
        return new Response("ok");
      },
    },
  },
});
