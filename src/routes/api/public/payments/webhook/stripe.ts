import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyStripeSignature, type StripeConfig } from "@/lib/payments/stripe.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";

async function loadConfig(): Promise<StripeConfig | null> {
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "payments").maybeSingle();
  const s = (data?.value ?? {}) as { stripe?: StripeConfig };
  return s.stripe ?? null;
}

type LogInput = {
  status_code: number;
  outcome: string;
  signature_valid?: boolean;
  event_type?: string | null;
  event_id?: string | null;
  intent_id?: string | null;
  error?: string | null;
  payload?: unknown;
  headers?: Record<string, string>;
  duration_ms?: number;
};

async function logEvent(input: LogInput) {
  try {
    await supabaseAdmin.from("webhook_event_log").insert({
      provider: "stripe",
      status_code: input.status_code,
      outcome: input.outcome,
      signature_valid: input.signature_valid ?? false,
      event_type: input.event_type ?? null,
      event_id: input.event_id ?? null,
      intent_id: input.intent_id ?? null,
      error: input.error ?? null,
      payload: (input.payload ?? {}) as never,
      headers: (input.headers ?? {}) as never,
      duration_ms: input.duration_ms ?? null,
    });
  } catch (e) {
    // Unique-constraint hit on (provider, event_id) is expected for retries.
    console.warn("stripe webhook log insert failed", e);
  }
}

function safeHeaders(request: Request): Record<string, string> {
  const keep = new Set(["stripe-signature", "user-agent", "content-type", "content-length", "x-forwarded-for"]);
  const out: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    if (keep.has(k.toLowerCase())) out[k] = v;
  });
  return out;
}

export const Route = createFileRoute("/api/public/payments/webhook/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        const headers = safeHeaders(request);
        const raw = await request.text();

        const cfg = await loadConfig();
        const secret = cfg?.webhook_secret || process.env.STRIPE_WEBHOOK_SECRET || "";
        if (!secret) {
          await logEvent({
            status_code: 500, outcome: "missing-config",
            error: "Stripe webhook secret not configured",
            payload: safeParse(raw), headers, duration_ms: Date.now() - started,
          });
          return new Response("missing-config", { status: 500 });
        }

        const sig = request.headers.get("stripe-signature") ?? "";
        const sigValid = verifyStripeSignature(raw, sig, secret);
        if (!sigValid) {
          await logEvent({
            status_code: 401, outcome: "invalid-signature", signature_valid: false,
            error: sig ? "Signature mismatch or outside tolerance window" : "Missing stripe-signature header",
            payload: safeParse(raw), headers, duration_ms: Date.now() - started,
          });
          // 401 => Stripe will retry per its backoff schedule.
          return new Response("invalid-signature", { status: 401 });
        }

        let event: {
          id?: string;
          type?: string;
          data?: { object?: Record<string, unknown> };
        };
        try { event = JSON.parse(raw); }
        catch (e) {
          await logEvent({
            status_code: 400, outcome: "bad-json", signature_valid: true,
            error: e instanceof Error ? e.message : "JSON parse failed",
            payload: { raw_snippet: raw.slice(0, 500) }, headers, duration_ms: Date.now() - started,
          });
          return new Response("bad-json", { status: 400 });
        }

        const eventId = event.id ?? null;
        const type = event.type ?? "";

        // Idempotency: if we already processed this exact event successfully,
        // ack 200 immediately so Stripe stops retrying.
        if (eventId) {
          const { data: prior } = await supabaseAdmin
            .from("webhook_event_log")
            .select("id, outcome, status_code")
            .eq("provider", "stripe")
            .eq("event_id", eventId)
            .in("outcome", ["fulfilled", "already-fulfilled", "ignored", "awaiting-payment"])
            .lt("status_code", 300)
            .limit(1)
            .maybeSingle();
          if (prior) {
            await logEvent({
              status_code: 200, outcome: "duplicate", signature_valid: true,
              event_type: type, event_id: eventId, payload: event, headers,
              duration_ms: Date.now() - started,
            });
            return new Response("duplicate-ok");
          }
        }

        const isSuccess =
          type === "checkout.session.completed" ||
          type === "checkout.session.async_payment_succeeded";
        if (!isSuccess) {
          await logEvent({
            status_code: 200, outcome: "ignored", signature_valid: true,
            event_type: type, event_id: eventId, payload: event, headers,
            duration_ms: Date.now() - started,
          });
          return new Response("ignored");
        }

        const obj = (event.data?.object ?? {}) as {
          id?: string;
          client_reference_id?: string;
          metadata?: Record<string, string>;
          payment_status?: string;
          payment_intent?: string;
        };
        const intentId = obj.client_reference_id ?? obj.metadata?.intent_id ?? null;
        if (!intentId) {
          await logEvent({
            status_code: 400, outcome: "missing-intent", signature_valid: true,
            event_type: type, event_id: eventId,
            error: "No client_reference_id or metadata.intent_id on the session",
            payload: event, headers, duration_ms: Date.now() - started,
          });
          return new Response("missing-intent", { status: 400 });
        }

        if (type === "checkout.session.completed" && obj.payment_status && obj.payment_status !== "paid") {
          await logEvent({
            status_code: 200, outcome: "awaiting-payment", signature_valid: true,
            event_type: type, event_id: eventId, intent_id: intentId,
            payload: event, headers, duration_ms: Date.now() - started,
          });
          return new Response("awaiting-payment");
        }

        try {
          const result = await fulfillPaymentIntent({
            intentId,
            providerOrderId: obj.payment_intent ?? obj.id ?? null,
            notifyMeta: event as unknown as Record<string, unknown>,
          });
          if (result === "not-found") {
            await logEvent({
              status_code: 404, outcome: "intent-not-found", signature_valid: true,
              event_type: type, event_id: eventId, intent_id: intentId,
              error: `payment_intents row ${intentId} does not exist`,
              payload: event, headers, duration_ms: Date.now() - started,
            });
            // 404 -> 4xx means Stripe will stop retrying. This is what we want
            // because the intent will never appear.
            return new Response("intent-not-found", { status: 404 });
          }
          await logEvent({
            status_code: 200,
            outcome: result === "already-paid" ? "already-fulfilled" : "fulfilled",
            signature_valid: true, event_type: type, event_id: eventId,
            intent_id: intentId, payload: event, headers,
            duration_ms: Date.now() - started,
          });
          return new Response("ok");
        } catch (e) {
          const msg = e instanceof Error ? e.message : "fulfillment-failed";
          console.error("stripe webhook fulfillment failed", e);
          await logEvent({
            status_code: 500, outcome: "fulfillment-failed", signature_valid: true,
            event_type: type, event_id: eventId, intent_id: intentId, error: msg,
            payload: event, headers, duration_ms: Date.now() - started,
          });
          // 500 -> Stripe will retry. Transient DB/upstream errors recover.
          return new Response("fulfillment-failed", { status: 500 });
        }
      },
    },
  },
});

function safeParse(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return { raw_snippet: raw.slice(0, 500) }; }
}
