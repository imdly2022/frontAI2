// Unified transactions: combine recharges (payment_intents), commission
// movements (commission_ledger) and withdrawals (withdrawal_requests) into a
// single normalized stream. This is the user-facing source of truth for all
// money movement; NewAPI consumption logs are NOT included here — see
// /app/usage for that.
//
// Reconciliation note: every row carries an internal `order_no` (TP-/CM-/WD-)
// stored both locally and — when applicable — sent as `remark` to NewAPI's
// admin top-up. NewAPI itself doesn't persist remarks, so when reconciling
// match by (user_id, amount, timestamp window) against the order_no/created_at
// on our side.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "./session.server";
import { requireAdmin } from "./admin.middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type TxKind =
  | "topup"           // 用户充值
  | "commission_earn" // 邀请佣金到账
  | "commission_adjust" // 管理员调整(含退款/无效订单)
  | "commission_convert" // 用户把佣金转入 NewAPI 余额
  | "withdraw_request" // 用户发起提现(冻结)
  | "withdraw_refund"  // 提现被拒,金额回退
  | "withdraw_paid";   // 提现已付款

export type UnifiedTx = {
  id: string;
  order_no: string;
  kind: TxKind;
  amount_usd: number;          // signed: + into balance, - out of balance
  status: string;
  note: string;
  ref: string | null;          // external order id / withdrawal contact / etc.
  created_at: string;
  newapi_user_id: number | null;
  affiliate_id: string | null;
  processed_at: string | null;
};

const LEDGER_KIND_MAP: Record<string, TxKind> = {
  earn: "commission_earn",
  adjust: "commission_adjust",
  reject: "commission_adjust",
  convert_to_balance: "commission_convert",
  withdraw_request: "withdraw_request",
  withdraw_paid: "withdraw_paid",
};

type IntentRow = { id: string; order_no: string; provider: string; provider_order_id: string | null; amount_usd: number | string; status: string; created_at: string; paid_at: string | null; newapi_user_id: number; meta: Record<string, unknown> | null; credits: number | string; bonus_credits: number | string };
type LedgerRow = { id: string; order_no: string; type: string; amount_usd: number | string; note: string; created_at: string; affiliate_id: string; conversion_id: string | null; withdrawal_id: string | null; meta: Record<string, unknown> | null };
type WithdrawalRow = { id: string; order_no: string; affiliate_id: string; amount_usd: number | string; status: string; contact_note: string; admin_note: string | null; created_at: string; processed_at: string | null };

function intentToTx(r: IntentRow): UnifiedTx {
  return {
    id: r.id,
    order_no: r.order_no,
    kind: "topup",
    amount_usd: Number(r.amount_usd),
    status: r.status,
    note: `${r.provider} · ${Number(r.credits)} credits${Number(r.bonus_credits) > 0 ? ` +${Number(r.bonus_credits)} bonus` : ""}`,
    ref: r.provider_order_id,
    created_at: r.created_at,
    newapi_user_id: r.newapi_user_id,
    affiliate_id: null,
    processed_at: r.paid_at,
  };
}
function ledgerToTx(r: LedgerRow): UnifiedTx {
  return {
    id: r.id,
    order_no: r.order_no,
    kind: LEDGER_KIND_MAP[r.type] ?? "commission_adjust",
    amount_usd: Number(r.amount_usd),
    status: "posted",
    note: r.note,
    ref: r.conversion_id ?? r.withdrawal_id ?? null,
    created_at: r.created_at,
    newapi_user_id: null,
    affiliate_id: r.affiliate_id,
    processed_at: null,
  };
}
function withdrawalToTx(r: WithdrawalRow): UnifiedTx {
  return {
    id: r.id,
    order_no: r.order_no,
    kind: r.status === "rejected" ? "withdraw_refund" : r.status === "paid" ? "withdraw_paid" : "withdraw_request",
    amount_usd: -Number(r.amount_usd),
    status: r.status,
    note: r.contact_note + (r.admin_note ? ` | admin: ${r.admin_note}` : ""),
    ref: null,
    created_at: r.created_at,
    newapi_user_id: null,
    affiliate_id: r.affiliate_id,
    processed_at: r.processed_at,
  };
}

// ─── User: my own transactions ────────────────────────────────────────────
export const myTransactions = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    kinds: z.array(z.string()).optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const s = await requireSession();
    const limit = data.limit ?? 200;
    const { data: aff } = await supabaseAdmin
      .from("affiliates").select("id").eq("newapi_user_id", s.auth.userId).maybeSingle();

    const [intentsRes, ledgerRes, withdrawalRes] = await Promise.all([
      supabaseAdmin.from("payment_intents")
        .select("id, order_no, provider, provider_order_id, amount_usd, status, created_at, paid_at, newapi_user_id, meta, credits, bonus_credits")
        .eq("newapi_user_id", s.auth.userId)
        .order("created_at", { ascending: false })
        .limit(limit),
      aff ? supabaseAdmin.from("commission_ledger")
        .select("id, order_no, type, amount_usd, note, created_at, affiliate_id, conversion_id, withdrawal_id, meta")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false })
        .limit(limit) : Promise.resolve({ data: [] as LedgerRow[], error: null }),
      aff ? supabaseAdmin.from("withdrawal_requests")
        .select("id, order_no, affiliate_id, amount_usd, status, contact_note, admin_note, created_at, processed_at")
        .eq("affiliate_id", aff.id)
        .order("created_at", { ascending: false })
        .limit(limit) : Promise.resolve({ data: [] as WithdrawalRow[], error: null }),
    ]);

    const rows: UnifiedTx[] = [
      ...((intentsRes.data ?? []) as IntentRow[])
        .filter((r) => r.status !== "pending")
        .map(intentToTx),
      ...((ledgerRes.data ?? []) as LedgerRow[]).map(ledgerToTx),
      ...((withdrawalRes.data ?? []) as WithdrawalRow[]).map(withdrawalToTx),
    ];

    const kinds = new Set(data.kinds ?? []);
    const filtered = kinds.size ? rows.filter((r) => kinds.has(r.kind)) : rows;
    filtered.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return filtered.slice(0, limit);
  });

// ─── Admin: search all transactions across the platform ─────────────────
export const adminListTransactions = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    kinds: z.array(z.string()).optional(),
    q: z.string().trim().max(200).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    limit: z.number().int().min(1).max(1000).optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    const limit = data.limit ?? 300;
    const q = data.q?.toLowerCase();

    let intentsQ = supabaseAdmin.from("payment_intents")
      .select("id, order_no, provider, provider_order_id, amount_usd, status, created_at, paid_at, newapi_user_id, meta, credits, bonus_credits")
      .order("created_at", { ascending: false }).limit(limit);
    let ledgerQ = supabaseAdmin.from("commission_ledger")
      .select("id, order_no, type, amount_usd, note, created_at, affiliate_id, conversion_id, withdrawal_id, meta")
      .order("created_at", { ascending: false }).limit(limit);
    let withdrawalQ = supabaseAdmin.from("withdrawal_requests")
      .select("id, order_no, affiliate_id, amount_usd, status, contact_note, admin_note, created_at, processed_at")
      .order("created_at", { ascending: false }).limit(limit);

    if (data.from) {
      intentsQ = intentsQ.gte("created_at", data.from);
      ledgerQ = ledgerQ.gte("created_at", data.from);
      withdrawalQ = withdrawalQ.gte("created_at", data.from);
    }
    if (data.to) {
      intentsQ = intentsQ.lte("created_at", data.to);
      ledgerQ = ledgerQ.lte("created_at", data.to);
      withdrawalQ = withdrawalQ.lte("created_at", data.to);
    }

    const [intentsRes, ledgerRes, withdrawalRes] = await Promise.all([intentsQ, ledgerQ, withdrawalQ]);
    let rows: UnifiedTx[] = [
      ...((intentsRes.data ?? []) as IntentRow[]).map(intentToTx),
      ...((ledgerRes.data ?? []) as LedgerRow[]).map(ledgerToTx),
      ...((withdrawalRes.data ?? []) as WithdrawalRow[]).map(withdrawalToTx),
    ];

    const kinds = new Set(data.kinds ?? []);
    if (kinds.size) rows = rows.filter((r) => kinds.has(r.kind));
    if (q) {
      rows = rows.filter((r) =>
        r.order_no.toLowerCase().includes(q) ||
        r.note.toLowerCase().includes(q) ||
        (r.ref ?? "").toLowerCase().includes(q) ||
        String(r.newapi_user_id ?? "").includes(q)
      );
    }

    // Hydrate affiliate -> newapi_user_id so admin can search by NewAPI user
    const affIds = Array.from(new Set(rows.map((r) => r.affiliate_id).filter(Boolean) as string[]));
    if (affIds.length) {
      const { data: affs } = await supabaseAdmin.from("affiliates").select("id, newapi_user_id").in("id", affIds);
      const map = new Map((affs ?? []).map((a) => [a.id, a.newapi_user_id]));
      rows = rows.map((r) => r.newapi_user_id == null && r.affiliate_id
        ? { ...r, newapi_user_id: map.get(r.affiliate_id) ?? null }
        : r);
    }

    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return rows.slice(0, limit);
  });
