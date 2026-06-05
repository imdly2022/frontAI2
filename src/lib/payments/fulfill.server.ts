// Shared post-payment fulfillment for any provider. Idempotent:
// safe to call multiple times for the same payment_intent.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { newapiAdminTopUp, usdToQuota } from "@/lib/newapi.server";
import { firePostbacks } from "@/lib/payments/postback.server";
import { fireS2S } from "@/lib/tracking/s2s.server";

export async function fulfillPaymentIntent(input: {
  intentId: string;
  providerOrderId?: string | null;
  notifyMeta?: Record<string, unknown>;
}): Promise<"ok" | "not-found" | "already-paid"> {
  const { data: intent } = await supabaseAdmin
    .from("payment_intents").select("*").eq("id", input.intentId).maybeSingle();
  if (!intent) return "not-found";
  if (intent.status === "paid") return "already-paid";

  // 1. Top up NewAPI — must succeed before we mark the intent as paid,
  // otherwise users would see status=paid with no balance increase.
  const grantCredits = Number(intent.credits ?? intent.amount_usd) + Number(intent.bonus_credits ?? 0);
  if (!(grantCredits > 0)) throw new Error("Payment has no credits to grant");
  await newapiAdminTopUp({
    user_id: Number(intent.newapi_user_id),
    quota: usdToQuota(grantCredits),
    remark: `${intent.order_no ?? intent.id} via ${intent.provider}`,
  });

  // 2. Mark paid
  const { error: paidError } = await supabaseAdmin.from("payment_intents").update({
    status: "paid",
    paid_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    provider_order_id: input.providerOrderId ?? intent.provider_order_id,
    meta: { ...(intent.meta as object ?? {}), notify: (input.notifyMeta ?? {}) as unknown as Record<string, never> },
  }).eq("id", intent.id);
  if (paidError) throw new Error(paidError.message);

  // 3. Affiliate commission — skip self-referrals (buyer === affiliate owner).
  if (intent.click_id) {
    const { data: click } = await supabaseAdmin
      .from("affiliate_clicks").select("affiliate_id")
      .eq("click_id", intent.click_id).maybeSingle();
    if (click) {
      const [{ data: aff }, { data: buyer }] = await Promise.all([
        supabaseAdmin
          .from("affiliates").select("id, newapi_user_id, commission_rate, total_earnings")
          .eq("id", click.affiliate_id).maybeSingle(),
        supabaseAdmin
          .from("users").select("affiliate_id, click_id")
          .eq("newapi_user_id", intent.newapi_user_id).maybeSingle(),
      ]);
      const buyerAffiliateId = (buyer as { affiliate_id?: string | null } | null)?.affiliate_id ?? null;
      const buyerClickId = (buyer as { click_id?: string | null } | null)?.click_id ?? null;
      const validBuyerAttribution = buyerAffiliateId === click.affiliate_id && buyerClickId === intent.click_id;
      if (aff && validBuyerAttribution && Number(aff.newapi_user_id) !== Number(intent.newapi_user_id)) {
        const commission = Number(intent.amount_usd) * Number(aff.commission_rate ?? 0);
        const { data: conv } = await supabaseAdmin
          .from("affiliate_conversions").insert({
            affiliate_id: aff.id,
            click_id: intent.click_id,
            payment_intent_id: intent.id,
            newapi_user_id: intent.newapi_user_id,
            event: "sale",
            amount_usd: intent.amount_usd,
            commission_usd: commission,
            currency: "USD",
            status: "approved",
          }).select().single();
        if (commission > 0) {
          await supabaseAdmin.from("commission_ledger").insert({
            affiliate_id: aff.id,
            type: "earn",
            amount_usd: commission,
            note: `Sale commission for payment ${intent.order_no ?? intent.id}`,
            conversion_id: conv?.id ?? null,
            meta: { payment_intent_id: intent.id },
          });
          await supabaseAdmin.from("affiliates").update({
            total_earnings: Number(aff.total_earnings ?? 0) + commission,
            updated_at: new Date().toISOString(),
          }).eq("id", aff.id);
        }
        try {
          await firePostbacks({
            affiliate_id: aff.id,
            click_id: intent.click_id,
            event: "sale",
            amount_usd: Number(intent.amount_usd),
            commission_usd: commission,
            currency: "USD",
            transaction_id: conv?.id ?? intent.id,
            newapi_user_id: Number(intent.newapi_user_id),
          });
        } catch (e) { console.error("postback fire failed", e); }
      }
    }
  }

  // 4. S2S tracking
  try {
    let attrib = {};
    if (intent.click_id) {
      const { data: c } = await supabaseAdmin
        .from("affiliate_clicks")
        .select("utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, gclid, ttclid")
        .eq("click_id", intent.click_id).maybeSingle();
      attrib = c ?? {};
    }
    await fireS2S({
      event: "Purchase",
      event_id: `purchase-${intent.id}`,
      value_usd: Number(intent.amount_usd),
      currency: "USD",
      attrib,
    });
  } catch (e) { console.error("S2S purchase failed", e); }

  return "ok";
}
