// User-facing commission management: view balance, ledger, convert to NewAPI
// quota, or request a withdrawal. All writes go through commission_ledger so
// every balance change is auditable.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "./session.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { newapiAdminTopUp, usdToQuota } from "./newapi.server";

async function getMyAffiliate(userId: number) {
  const { data, error } = await supabaseAdmin
    .from("affiliates").select("*").eq("newapi_user_id", userId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No affiliate account found");
  return data;
}

export const myCommissionSummary = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireSession();
  const aff = await getMyAffiliate(s.auth.userId);
  const [ledgerRes, convRes, wdRes] = await Promise.all([
    supabaseAdmin.from("commission_ledger").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("affiliate_conversions").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }).limit(100),
    supabaseAdmin.from("withdrawal_requests").select("*").eq("affiliate_id", aff.id).order("created_at", { ascending: false }).limit(50),
  ]);
  return {
    affiliate: {
      id: aff.id,
      slug: aff.slug,
      commission_rate: Number(aff.commission_rate),
      available_balance_usd: Number(aff.available_balance_usd),
      pending_balance_usd: Number(aff.pending_balance_usd),
      total_earnings_usd: Number(aff.total_earnings),
      total_paid_usd: Number(aff.total_paid),
    },
    ledger: ledgerRes.data ?? [],
    conversions: convRes.data ?? [],
    withdrawals: wdRes.data ?? [],
  };
});

export const convertCommissionToBalance = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    amount_usd: z.number().positive().max(100000),
  }).parse(input))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const aff = await getMyAffiliate(s.auth.userId);
    const available = Number(aff.available_balance_usd);
    if (data.amount_usd > available + 0.0001) {
      throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`);
    }
    // 1. Deduct from ledger (returns order_no for traceability into NewAPI remark)
    const { data: led, error: ledErr } = await supabaseAdmin.from("commission_ledger").insert({
      affiliate_id: aff.id,
      type: "convert_to_balance",
      amount_usd: -data.amount_usd,
      note: `User converted $${data.amount_usd.toFixed(2)} to NewAPI balance`,
    }).select("order_no").single();
    if (ledErr) throw new Error(ledErr.message);
    // 2. Credit NewAPI quota
    try {
      await newapiAdminTopUp({
        user_id: s.auth.userId,
        quota: usdToQuota(data.amount_usd),
        remark: `${led.order_no} commission→balance ($${data.amount_usd.toFixed(2)})`,
      });
    } catch (e) {
      // Roll back ledger entry on top-up failure
      await supabaseAdmin.from("commission_ledger").insert({
        affiliate_id: aff.id,
        type: "adjust",
        amount_usd: data.amount_usd,
        note: `Rollback of ${led.order_no}: NewAPI top-up failed (${e instanceof Error ? e.message : "unknown"})`,
      });
      throw new Error(`Top-up failed: ${e instanceof Error ? e.message : "unknown"}`);
    }
    return { ok: true };
  });

export const requestWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    amount_usd: z.number().positive().max(100000),
    contact_note: z.string().trim().min(1).max(2000),
  }).parse(input))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const aff = await getMyAffiliate(s.auth.userId);
    const available = Number(aff.available_balance_usd);
    if (data.amount_usd > available + 0.0001) {
      throw new Error(`Insufficient balance. Available: $${available.toFixed(2)}`);
    }
    // Create the withdrawal request
    const { data: wd, error: wdErr } = await supabaseAdmin
      .from("withdrawal_requests").insert({
        affiliate_id: aff.id,
        amount_usd: data.amount_usd,
        contact_note: data.contact_note,
        status: "pending",
      }).select().single();
    if (wdErr) throw new Error(wdErr.message);
    // Freeze the amount: deduct from available, will be returned on rejection
    const { error: ledErr } = await supabaseAdmin.from("commission_ledger").insert({
      affiliate_id: aff.id,
      type: "withdraw_request",
      amount_usd: -data.amount_usd,
      note: `Withdrawal request #${wd.id.slice(0, 8)}`,
      withdrawal_id: wd.id,
    });
    if (ledErr) throw new Error(ledErr.message);
    return { ok: true, id: wd.id };
  });
