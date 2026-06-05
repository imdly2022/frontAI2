// Affiliate postback dispatcher.
// On every conversion event (sale, signup) we look up postbacks for the
// affiliate, render the URL template, fire it, and log the response.
//
// Template tokens supported: {click_id} {sub1..5} {amount} {commission}
// {currency} {event} {transaction_id} {newapi_user_id}

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PostbackContext = {
  affiliate_id: string;
  click_id?: string | null;
  event: "sale" | "signup" | "first_topup";
  amount_usd: number;
  commission_usd: number;
  currency: string;
  transaction_id: string;
  newapi_user_id?: number | null;
};

function renderTemplate(tmpl: string, ctx: PostbackContext, click: Record<string, unknown> | null): string {
  const map: Record<string, string> = {
    click_id: ctx.click_id ?? "",
    sub1: String(click?.sub1 ?? ""),
    sub2: String(click?.sub2 ?? ""),
    sub3: String(click?.sub3 ?? ""),
    sub4: String(click?.sub4 ?? ""),
    sub5: String(click?.sub5 ?? ""),
    amount: ctx.amount_usd.toFixed(4),
    commission: ctx.commission_usd.toFixed(4),
    currency: ctx.currency,
    event: ctx.event,
    transaction_id: ctx.transaction_id,
    newapi_user_id: String(ctx.newapi_user_id ?? ""),
  };
  return tmpl.replace(/\{(\w+)\}/g, (_, k) => encodeURIComponent(map[k] ?? ""));
}

export async function firePostbacks(ctx: PostbackContext): Promise<void> {
  const { data: postbacks } = await supabaseAdmin
    .from("affiliate_postbacks")
    .select("*")
    .eq("affiliate_id", ctx.affiliate_id)
    .eq("is_enabled", true);

  if (!postbacks?.length) return;

  let click: Record<string, unknown> | null = null;
  if (ctx.click_id) {
    const { data } = await supabaseAdmin
      .from("affiliate_clicks")
      .select("sub1, sub2, sub3, sub4, sub5")
      .eq("click_id", ctx.click_id)
      .maybeSingle();
    click = data;
  }

  await Promise.all(
    postbacks
      .filter((p) => (p.events as string[]).includes(ctx.event))
      .map(async (p) => {
        const url = renderTemplate(p.url_template, ctx, click);
        let status = 0;
        let body = "";
        try {
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 5000);
          const res = await fetch(url, {
            method: "GET",
            redirect: "manual",
            signal: ctrl.signal,
          });
          clearTimeout(t);
          status = res.status;
          body = (await res.text()).slice(0, 500);
        } catch (e) {
          status = 0;
          body = (e as Error).message.slice(0, 500);
        }
        await supabaseAdmin
          .from("affiliate_postbacks")
          .update({
            last_status: status,
            last_response: body,
            last_fired_at: new Date().toISOString(),
            fire_count: (p.fire_count ?? 0) + 1,
          })
          .eq("id", p.id);
      }),
  );
}
