// Billing-related server functions: balance + payment history.
import { createServerFn } from "@tanstack/react-start";
import { requireSession } from "./session.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { newapiGetSelf, quotaToUsd, type NewApiUser } from "./newapi.server";

export const billingOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await requireSession();
  const [selfRes, intentsRes] = await Promise.all([
    newapiGetSelf(auth).catch(() => ({ data: undefined as NewApiUser | undefined })),
    supabaseAdmin
      .from("payment_intents")
      .select("id, amount_usd, credits, bonus_credits, provider, status, created_at, paid_at, pay_url, provider_order_id")
      .eq("newapi_user_id", auth.userId)
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(50),

  ]);
  const u = selfRes.data;
  return {
    balance_usd: quotaToUsd(u?.quota),
    used_usd: quotaToUsd(u?.used_quota),
    request_count: u?.request_count ?? 0,
    intents: intentsRes.data ?? [],
  };
});
