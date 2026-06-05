// All admin CRUD operations. Every handler calls requireAdmin() first.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin, isCurrentUserAdmin } from "./admin.middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { newapiTestConnection, newapiFetch, newapiAdminGetUser, newapiAdminListUsers, newapiAdminTopUp, quotaToUsd, usdToQuota, type NewApiUser } from "./newapi.server";
import { fulfillPaymentIntent } from "@/lib/payments/fulfill.server";

// ─── Permission probe ────────────────────────────────────────────────────

export const adminCheck = createServerFn({ method: "GET" }).handler(async () => {
  return { isAdmin: await isCurrentUserAdmin() };
});

// ─── Dashboard summary ───────────────────────────────────────────────────

export const adminDashboard = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const [paid, pending, affs, intents] = await Promise.all([
    supabaseAdmin.from("payment_intents").select("amount_usd").eq("status", "paid").gte("paid_at", since),
    supabaseAdmin.from("payment_intents").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("affiliates").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("payment_intents").select("id, amount_usd, status, provider, created_at, newapi_user_id").order("created_at", { ascending: false }).limit(10),
  ]);
  const revenue30d = (paid.data ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  return {
    revenue_30d_usd: revenue30d,
    pending_payments: pending.count ?? 0,
    active_affiliates: affs.count ?? 0,
    recent_intents: intents.data ?? [],
  };
});

// ─── Site settings (key/value JSON) ──────────────────────────────────────

export const adminListSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("site_settings").select("*").order("key");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertSetting = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_.-]+$/i),
    value: z.unknown(),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: data.key, value: data.value as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Pricing plans CRUD ──────────────────────────────────────────────────

const planSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(80),
  description: z.string().max(500).nullish(),
  price_usd: z.number().min(0).max(100000),
  credits: z.number().min(0).max(10_000_000),
  bonus_credits: z.number().min(0).max(10_000_000).default(0),
  is_popular: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
  creem_product_id: z.string().max(120).nullish(),
  whop_plan_id: z.string().max(120).nullish(),
});

export const adminListPlans = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("pricing_plans").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertPlan = createServerFn({ method: "POST" })
  .inputValidator((input) => planSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("pricing_plans").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeletePlan = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("pricing_plans").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Models catalog CRUD ─────────────────────────────────────────────────

const modelSchema = z.object({
  id: z.string().uuid().optional(),
  provider: z.string().min(1).max(60),
  slug: z.string().min(1).max(120),
  display_name: z.string().min(1).max(120),
  description: z.string().max(1000).nullish(),
  category: z.string().max(60).nullish(),
  modality: z.string().min(1).max(40).default("chat"),
  context_length: z.number().int().min(0).max(10_000_000).nullish(),
  input_price_per_1k: z.number().min(0).max(10000).nullish(),
  output_price_per_1k: z.number().min(0).max(10000).nullish(),
  cached_input_price_per_1k: z.number().min(0).max(10000).nullish(),
  vendor_input_price_per_1k: z.number().min(0).max(10000).nullish(),
  vendor_output_price_per_1k: z.number().min(0).max(10000).nullish(),
  vendor_cached_input_price_per_1k: z.number().min(0).max(10000).nullish(),
  badges: z.array(z.string().max(40)).max(10).default([]),
  is_visible: z.boolean().default(true),
  is_featured: z.boolean().default(false),
  sort_order: z.number().int().default(0),
});


export const adminListModels = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("models_catalog").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertModel = createServerFn({ method: "POST" })
  .inputValidator((input) => modelSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("models_catalog").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteModel = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("models_catalog").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminBulkDeleteModels = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("models_catalog").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, deleted: data.ids.length };
  });

export const adminBulkSetModelVisibility = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    ids: z.array(z.string().uuid()).min(1).max(500),
    is_visible: z.boolean(),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("models_catalog")
      .update({ is_visible: data.is_visible, updated_at: new Date().toISOString() })
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, updated: data.ids.length };
  });

// ─── Model categories (groups) management ────────────────────────────────

export const adminListModelCategories = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("models_catalog").select("category");
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    const k = (r.category ?? "").trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
});

export const adminRenameModelCategory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    from: z.string().trim().min(1).max(80),
    to: z.string().trim().min(1).max(80),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.from === data.to) return { ok: true, updated: 0 };
    const { error, count } = await supabaseAdmin
      .from("models_catalog")
      .update({ category: data.to, updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("category", data.from);
    if (error) throw new Error(error.message);
    return { ok: true, updated: count ?? 0 };
  });

export const adminDeleteModelCategory = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    name: z.string().trim().min(1).max(80),
    mode: z.enum(["unset", "delete"]).default("unset"),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (data.mode === "delete") {
      const { error, count } = await supabaseAdmin
        .from("models_catalog")
        .delete({ count: "exact" })
        .eq("category", data.name);
      if (error) throw new Error(error.message);
      return { ok: true, deleted: count ?? 0 };
    }
    const { error, count } = await supabaseAdmin
      .from("models_catalog")
      .update({ category: null, updated_at: new Date().toISOString() }, { count: "exact" })
      .eq("category", data.name);
    if (error) throw new Error(error.message);
    return { ok: true, unset: count ?? 0 };
  });

// ─── Announcements ───────────────────────────────────────────────────────



const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(4000).default(""),
  level: z.enum(["info", "success", "warning", "critical"]).default("info"),
  is_active: z.boolean().default(true),
  starts_at: z.string().datetime().nullish(),
  ends_at: z.string().datetime().nullish(),
  link_url: z.string().url().max(500).nullish().or(z.literal("").transform(() => null)),
  link_label: z.string().max(60).nullish(),
  sort_order: z.number().int().default(0),
});

export const adminListAnnouncements = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("*")
    .order("sort_order")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => announcementSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin.from("announcements").upsert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteAnnouncement = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("announcements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });


// ─── Docs pages CRUD ─────────────────────────────────────────────────────

const docSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(160),
  description: z.string().max(500).nullish(),
  category: z.string().max(60).nullish(),
  body_md: z.string().max(2_000_000).default(""),
  is_published: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

function friendlyParse<T>(schema: z.ZodType<T>, input: unknown): T {
  const r = schema.safeParse(input);
  if (r.success) return r.data;
  const first = r.error.issues[0];
  const path = first?.path?.join(".") || "input";
  throw new Error(`Invalid ${path}: ${first?.message ?? "validation failed"}`);
}

export const adminListDocs = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("docs_pages").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertDoc = createServerFn({ method: "POST" })
  .inputValidator((input) => friendlyParse(docSchema, input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("docs_pages").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDoc = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("docs_pages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Docs groups CRUD ─────────────────────────────────────────────────
const docGroupSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  sort_order: z.number().int().default(0),
  is_visible: z.boolean().default(true),
});

export const adminListDocGroups = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("docs_groups").select("*").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertDocGroup = createServerFn({ method: "POST" })
  .inputValidator((input) => docGroupSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("docs_groups").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDocGroup = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("docs_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Custom scripts CRUD ─────────────────────────────────────────────────

export const ALLOWED_PLACEMENTS = ["head", "body_start", "body_end"] as const;
export const ALLOWED_SCOPES = [
  "global", "landing", "pricing", "models", "docs",
  "app", "checkout", "register", "login",
] as const;

const scriptSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  code: z.string().min(1).max(50_000),
  placement: z.enum(ALLOWED_PLACEMENTS),
  page_scope: z.enum(ALLOWED_SCOPES),
  is_enabled: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const adminListScripts = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("custom_scripts").select("*").order("page_scope").order("placement").order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertScript = createServerFn({ method: "POST" })
  .inputValidator((input) => scriptSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("custom_scripts").upsert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteScript = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("custom_scripts").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Affiliates ──────────────────────────────────────────────────────────

export const adminListAffiliates = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin.from("affiliates").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpdateAffiliate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    commission_rate: z.number().min(0).max(1).optional(),
    status: z.enum(["active", "paused", "banned"]).optional(),
    payout_method: z.string().max(60).nullish(),
    display_name: z.string().max(120).nullish(),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { id, ...patch } = data;
    const { error } = await supabaseAdmin.from("affiliates").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Affiliate conversions: list + admin adjust ──────────────────────────

export const adminListConversions = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    affiliate_id: z.string().uuid().optional(),
    status: z.string().max(40).optional(),
    event: z.string().max(40).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("affiliate_conversions")
      .select("*, affiliates:affiliate_id(slug, display_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.affiliate_id) q = q.eq("affiliate_id", data.affiliate_id);
    if (data.status) q = q.eq("status", data.status);
    if (data.event) q = q.eq("event", data.event);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });

export const adminAdjustConversion = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    new_commission_usd: z.number().min(0).max(100000).optional(),
    new_status: z.enum(["pending","approved","rejected"]).optional(),
    note: z.string().trim().min(1).max(2000),
  }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireAdmin();
    const { data: conv, error } = await supabaseAdmin
      .from("affiliate_conversions").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!conv) throw new Error("Conversion not found");

    const oldCommission = Number(conv.commission_usd ?? 0);
    const oldStatus = conv.status;
    const newCommission = data.new_commission_usd ?? oldCommission;
    const newStatus = data.new_status ?? oldStatus;

    // Compute the delta we owe the affiliate in available balance.
    // If old was approved (already credited), subtract old. If new is approved, add new.
    const oldCredited = oldStatus === "approved" ? oldCommission : 0;
    const newCredited = newStatus === "approved" ? newCommission : 0;
    const delta = newCredited - oldCredited;

    const { error: updErr } = await supabaseAdmin
      .from("affiliate_conversions").update({
        commission_usd: newCommission,
        status: newStatus,
        note: data.note,
        adjusted_by: ctx.adminId,
        adjusted_at: new Date().toISOString(),
      }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    if (delta !== 0) {
      const ledgerType = newStatus === "rejected" ? "reject" : "adjust";
      const { error: ledErr } = await supabaseAdmin.from("commission_ledger").insert({
        affiliate_id: conv.affiliate_id,
        type: ledgerType,
        amount_usd: delta,
        note: `Admin adjust conversion ${conv.id.slice(0, 8)}: ${data.note}`,
        actor_id: ctx.adminId,
        conversion_id: conv.id,
        meta: { old_commission: oldCommission, new_commission: newCommission, old_status: oldStatus, new_status: newStatus },
      });
      if (ledErr) throw new Error(ledErr.message);
    }
    return { ok: true, delta };
  });

// List users referred by a specific affiliate, with lifetime paid spend.
export const adminListReferredUsers = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    affiliate_id: z.string().uuid(),
    limit: z.number().int().min(1).max(500).default(200),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("users")
      .select("id, newapi_user_id, username, email, created_at, last_login_at")
      .eq("affiliate_id", data.affiliate_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => Number(r.newapi_user_id));
    const spend = new Map<number, number>();
    if (ids.length) {
      const { data: pays } = await supabaseAdmin
        .from("payment_intents")
        .select("newapi_user_id, amount_usd")
        .eq("status", "paid")
        .in("newapi_user_id", ids);
      for (const p of pays ?? []) {
        const k = Number(p.newapi_user_id);
        spend.set(k, (spend.get(k) ?? 0) + Number(p.amount_usd ?? 0));
      }
    }
    return (rows ?? []).map((r) => ({
      ...r,
      lifetime_spend_usd: spend.get(Number(r.newapi_user_id)) ?? 0,
    }));
  });

// ─── Withdrawals ─────────────────────────────────────────────────────────

export const adminListWithdrawals = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    status: z.enum(["pending","approved","rejected","paid"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("withdrawal_requests")
      .select("*, affiliates:affiliate_id(slug, display_name, newapi_user_id)")
      .order("created_at", { ascending: false }).limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminProcessWithdrawal = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    id: z.string().uuid(),
    action: z.enum(["approve","reject","paid"]),
    admin_note: z.string().trim().min(1).max(2000),
  }).parse(input))
  .handler(async ({ data }) => {
    const ctx = await requireAdmin();
    const { data: wd, error } = await supabaseAdmin
      .from("withdrawal_requests").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!wd) throw new Error("Withdrawal not found");
    if (wd.status === "paid" || wd.status === "rejected") {
      throw new Error(`Withdrawal already ${wd.status}`);
    }

    const amount = Number(wd.amount_usd);
    let newStatus = wd.status;
    if (data.action === "approve") newStatus = "approved";
    if (data.action === "reject") newStatus = "rejected";
    if (data.action === "paid") newStatus = "paid";

    const { error: updErr } = await supabaseAdmin
      .from("withdrawal_requests").update({
        status: newStatus,
        admin_note: data.admin_note,
        processed_by: ctx.adminId,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);

    if (data.action === "reject") {
      // Return the frozen amount to available balance
      await supabaseAdmin.from("commission_ledger").insert({
        affiliate_id: wd.affiliate_id,
        type: "withdraw_reject",
        amount_usd: amount,
        note: `Withdrawal #${wd.id.slice(0, 8)} rejected: ${data.admin_note}`,
        actor_id: ctx.adminId,
        withdrawal_id: wd.id,
      });
    } else if (data.action === "paid") {
      // Finalize: log the payout (amount already deducted at request time)
      await supabaseAdmin.from("commission_ledger").insert({
        affiliate_id: wd.affiliate_id,
        type: "withdraw_paid",
        amount_usd: 0, // no balance change; just an audit entry
        note: `Withdrawal #${wd.id.slice(0, 8)} paid: ${data.admin_note}`,
        actor_id: ctx.adminId,
        withdrawal_id: wd.id,
        meta: { amount_usd: amount },
      });
      // Bump lifetime total_paid
      const { data: cur } = await supabaseAdmin
        .from("affiliates").select("total_paid").eq("id", wd.affiliate_id).maybeSingle();
      await supabaseAdmin.from("affiliates").update({
        total_paid: Number(cur?.total_paid ?? 0) + amount,
        updated_at: new Date().toISOString(),
      }).eq("id", wd.affiliate_id);
    }
    return { ok: true };
  });

export const adminGetAffiliateLedger = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    affiliate_id: z.string().uuid(),
    limit: z.number().int().min(1).max(500).default(200),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: rows, error } = await supabaseAdmin
      .from("commission_ledger").select("*")
      .eq("affiliate_id", data.affiliate_id)
      .order("created_at", { ascending: false }).limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Payments ────────────────────────────────────────────────────────────

export const adminListPayments = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({
    status: z.enum(["pending", "paid", "failed", "cancelled"]).optional(),
    limit: z.number().int().min(1).max(200).default(50),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin.from("payment_intents").select("*").order("created_at", { ascending: false }).limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminMarkPaymentPaid = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row, error: fetchErr } = await supabaseAdmin
      .from("payment_intents").select("*").eq("id", data.id).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!row) throw new Error("Payment intent not found");
    if (row.status === "paid") return { ok: true, already: true };

    const result = await fulfillPaymentIntent({
      intentId: row.id,
      providerOrderId: row.provider_order_id,
      notifyMeta: { source: "admin-manual" },
    });
    if (result === "not-found") throw new Error("Payment intent not found");
    return { ok: true };
  });

// ─── New API connector status ────────────────────────────────────────────

export const adminTestNewApi = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  try {
    const res = await newapiTestConnection();
    return { ok: true, version: (res as { data?: { version?: string } }).data?.version ?? "unknown" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
});

// ─── Extended dashboard (charts + channels + recent users) ──────────────

export const adminDashboardExtended = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const now = Date.now();
  const since30 = new Date(now - 30 * 86400_000).toISOString();
  const since1 = new Date(now - 86400_000).toISOString();

  const [paid30, paid1, pending, affs, intents, clicks, conversions] = await Promise.all([
    supabaseAdmin.from("payment_intents").select("amount_usd, paid_at, provider").eq("status", "paid").gte("paid_at", since30),
    supabaseAdmin.from("payment_intents").select("amount_usd").eq("status", "paid").gte("paid_at", since1),
    supabaseAdmin.from("payment_intents").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabaseAdmin.from("affiliates").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabaseAdmin.from("payment_intents").select("id, amount_usd, status, provider, created_at, newapi_user_id").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("affiliate_clicks").select("utm_source, created_at").gte("created_at", since30),
    supabaseAdmin.from("affiliate_conversions").select("id", { count: "exact", head: true }).gte("created_at", since30),
  ]);

  const revenue_30d = (paid30.data ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);
  const revenue_1d = (paid1.data ?? []).reduce((s, r) => s + Number(r.amount_usd ?? 0), 0);

  // Daily revenue series (30 days)
  const dailyMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now - i * 86400_000).toISOString().slice(0, 10);
    dailyMap.set(d, 0);
  }
  for (const p of paid30.data ?? []) {
    if (!p.paid_at) continue;
    const d = p.paid_at.slice(0, 10);
    dailyMap.set(d, (dailyMap.get(d) ?? 0) + Number(p.amount_usd ?? 0));
  }
  const revenue_series = Array.from(dailyMap.entries()).map(([day, usd]) => ({ day, usd: Math.round(usd * 100) / 100 }));

  // Channel breakdown
  const channelMap = new Map<string, number>();
  for (const c of clicks.data ?? []) {
    const k = c.utm_source ?? "direct";
    channelMap.set(k, (channelMap.get(k) ?? 0) + 1);
  }
  const channels = Array.from(channelMap.entries()).map(([source, clicks]) => ({ source, clicks })).sort((a, b) => b.clicks - a.clicks).slice(0, 8);

  return {
    revenue_30d_usd: revenue_30d,
    revenue_1d_usd: revenue_1d,
    pending_payments: pending.count ?? 0,
    active_affiliates: affs.count ?? 0,
    total_clicks_30d: clicks.data?.length ?? 0,
    total_conversions_30d: conversions.count ?? 0,
    revenue_series,
    channels,
    recent_intents: intents.data ?? [],
  };
});

// ─── Sync models from NewAPI ────────────────────────────────────────────

export const adminSyncModelsFromNewApi = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  // NewAPI exposes channel/model info via /api/models (admin). Fallback to OpenAI-compatible /v1/models.
  let names: string[] = [];
  try {
    const res = await newapiFetch<unknown>("/api/models", { asAdmin: true });
    const raw = res.data as unknown;
    if (Array.isArray(raw)) {
      names = (raw as Array<string | { id?: string; model_name?: string; name?: string }>).map((m) =>
        typeof m === "string" ? m : (m.id ?? m.model_name ?? m.name ?? ""),
      ).filter(Boolean);
    } else if (raw && typeof raw === "object") {
      // Some NewAPI versions return a map { provider: [models] }
      const obj = raw as Record<string, unknown>;
      for (const v of Object.values(obj)) {
        if (Array.isArray(v)) names.push(...(v as string[]).filter((x) => typeof x === "string"));
      }
    }
  } catch {
    const res = await newapiFetch<Array<{ id: string }>>("/v1/models", { asAdmin: true });
    names = (res.data ?? []).map((m) => m.id).filter(Boolean);
  }
  names = Array.from(new Set(names)).sort();

  // Map slug → provider heuristically
  function providerOf(slug: string): string {
    const s = slug.toLowerCase();
    if (s.startsWith("gpt") || s.startsWith("o1") || s.startsWith("o3") || s.startsWith("o4") || s.includes("openai")) return "openai";
    if (s.startsWith("claude") || s.includes("anthropic")) return "anthropic";
    if (s.startsWith("gemini") || s.includes("google")) return "google";
    if (s.startsWith("deepseek")) return "deepseek";
    if (s.startsWith("qwen") || s.startsWith("doubao")) return "alibaba";
    if (s.startsWith("llama") || s.includes("meta")) return "meta";
    if (s.startsWith("mistral") || s.startsWith("mixtral")) return "mistral";
    if (s.startsWith("grok")) return "xai";
    return "other";
  }

  const { data: existing } = await supabaseAdmin.from("models_catalog").select("slug, id");
  const existingSet = new Set((existing ?? []).map((m) => m.slug));
  const toInsert = names
    .filter((slug) => !existingSet.has(slug))
    .map((slug, idx) => ({
      slug,
      provider: providerOf(slug),
      display_name: slug,
      modality: "chat",
      badges: [] as string[],
      is_visible: false, // admin reviews + sets prices before showing
      sort_order: 1000 + idx,
    }));

  let inserted = 0;
  if (toInsert.length) {
    const { error } = await supabaseAdmin.from("models_catalog").insert(toInsert);
    if (error) throw new Error(error.message);
    inserted = toInsert.length;
  }
  return { total_remote: names.length, inserted, existing: existingSet.size };
});

// ─── Doc image upload ────────────────────────────────────────────────────

export const adminUploadDocImage = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      filename: z.string().min(1).max(200),
      contentType: z.string().min(1).max(100),
      // base64 (no data: prefix), capped ~6MB raw
      base64: z.string().min(1).max(8_500_000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!/^image\/(png|jpe?g|gif|webp|svg\+xml)$/.test(data.contentType)) {
      throw new Error("Unsupported image type");
    }
    const ext = data.filename.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "png";
    const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    const { error } = await supabaseAdmin.storage.from("docs-assets").upload(path, bytes, {
      contentType: data.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const { data: pub } = supabaseAdmin.storage.from("docs-assets").getPublicUrl(path);
    return { url: pub.publicUrl, path };
  });

// ─── Users management ────────────────────────────────────────────────────

export const adminListUsers = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      search: z.string().trim().max(255).optional(),
      affiliate_id: z.string().uuid().optional(),
      limit: z.number().int().min(1).max(200).default(50),
      offset: z.number().int().min(0).default(0),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("users")
      .select("id, newapi_user_id, username, email, display_name, first_name, last_name, country, phone, register_country, register_ip, affiliate_id, last_login_at, created_at, affiliates:affiliate_id(slug, display_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.search) {
      q = q.or(`email.ilike.%${data.search}%,username.ilike.%${data.search}%`);
    }
    if (data.affiliate_id) q = q.eq("affiliate_id", data.affiliate_id);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r) => Number(r.newapi_user_id));
    const spendMap = new Map<number, number>();
    if (ids.length) {
      const { data: pays } = await supabaseAdmin
        .from("payment_intents")
        .select("newapi_user_id, amount_usd")
        .eq("status", "paid")
        .in("newapi_user_id", ids);
      for (const p of pays ?? []) {
        const k = Number(p.newapi_user_id);
        spendMap.set(k, (spendMap.get(k) ?? 0) + Number(p.amount_usd ?? 0));
      }
    }

    return {
      rows: (rows ?? []).map((r) => ({
        ...r,
        lifetime_spend_usd: spendMap.get(Number(r.newapi_user_id)) ?? 0,
      })),
      total: count ?? 0,
    };
  });

export const adminGetUserBalances = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ ids: z.array(z.number().int().positive()).min(1).max(50) }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const results: Record<number, { balance_usd: number; used_usd: number } | { error: string }> = {};
    const ids = [...data.ids];
    async function worker() {
      while (ids.length) {
        const id = ids.shift()!;
        try {
          const res = await newapiAdminGetUser(id);
          results[id] = {
            balance_usd: quotaToUsd(res.data?.quota),
            used_usd: quotaToUsd(res.data?.used_quota),
          };
        } catch (e) {
          results[id] = { error: e instanceof Error ? e.message : "fail" };
        }
      }
    }
    await Promise.all([worker(), worker(), worker(), worker(), worker()]);
    return results;
  });

// Pull every user from NewAPI and upsert into the local users mirror.
export const adminBackfillUsers = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  let page = 1;
  const size = 100;
  let total = 0;
  let inserted = 0;
  let updated = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await newapiAdminListUsers({ page, size });
    const list = (res.data ?? []) as NewApiUser[];
    if (!list.length) break;
    total += list.length;
    for (const u of list) {
      const row = {
        newapi_user_id: u.id,
        username: u.username,
        email: u.email ?? `${u.username}@unknown.local`,
        display_name: u.display_name ?? u.username,
      };
      const { data: existing } = await supabaseAdmin
        .from("users").select("id").eq("newapi_user_id", u.id).maybeSingle();
      const { error } = await supabaseAdmin
        .from("users").upsert(row, { onConflict: "newapi_user_id" });
      if (error) continue;
      if (existing) updated += 1; else inserted += 1;
    }
    if (list.length < size) break;
    page += 1;
    if (page > 50) break; // safety
  }
  return { total, inserted, updated };
});

// Delete the local mirror row only (NewAPI account is preserved).
export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("users").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Manually adjust a user's NewAPI balance. Positive amount = top up, negative
// = deduction. The change is mirrored as a paid payment_intents row so it
// appears in the user's transactions/billing history.
export const adminAdjustUserBalance = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      newapi_user_id: z.number().int().positive(),
      amount_usd: z.number().min(-10000).max(10000).refine((n) => n !== 0, "Amount cannot be zero"),
      note: z.string().trim().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }: { data: { newapi_user_id: number; amount_usd: number; note?: string } }) => {
    await requireAdmin();
    // 1. Adjust NewAPI quota (supports negative for deductions)
    await newapiAdminTopUp({
      user_id: data.newapi_user_id,
      quota: usdToQuota(data.amount_usd),
      remark: data.note ?? "Admin adjustment",
    });
    // 2. Record into payment_intents (status=paid) so it shows in billing
    const now = new Date().toISOString();
    const { data: row, error } = await supabaseAdmin
      .from("payment_intents")
      .insert({
        newapi_user_id: data.newapi_user_id,
        amount_usd: data.amount_usd,
        credits: data.amount_usd,
        bonus_credits: 0,
        provider: "admin_adjustment",
        status: "paid",
        paid_at: now,
        meta: { note: data.note ?? null, source: "admin_adjust" },
      })
      .select("id, order_no, amount_usd, created_at")
      .single();
    if (error) throw new Error(error.message);
    return { ok: true, intent: row };
  });

// ─── Signup bonus config (site_settings.signup_bonus) ────────────────────

type SignupBonusValue = { enabled: boolean; amount_usd: number; note: string };

const DEFAULT_SIGNUP_BONUS: SignupBonusValue = {
  enabled: false,
  amount_usd: 0,
  note: "Welcome bonus",
};

export const adminGetSignupBonus = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "signup_bonus").maybeSingle();
  const v = (data?.value ?? null) as Partial<SignupBonusValue> | null;
  const out: SignupBonusValue = {
    enabled: Boolean(v?.enabled),
    amount_usd: Number(v?.amount_usd ?? 0),
    note: typeof v?.note === "string" ? v.note : DEFAULT_SIGNUP_BONUS.note,
  };
  return out;
});

export const adminSetSignupBonus = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      enabled: z.boolean(),
      amount_usd: z.number().min(0).max(10000),
      note: z.string().trim().max(200).default("Welcome bonus"),
    }).parse(input),
  )
  .handler(async ({ data }: { data: SignupBonusValue }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "signup_bonus", value: data, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });



// ─── Webhook health ──────────────────────────────────────────────────────
// Reports the configured public webhook URL for each provider, whether it's
// enabled in site settings, and the latest payment_intent we processed for
// each provider (so admins can see if callbacks are landing).

type WebhookProviderHealth = {
  provider: "stripe" | "creem" | "whop" | "epay";
  enabled: boolean;
  configured: boolean;
  webhook_path: string;
  latest_intent: null | {
    id: string;
    order_no: string;
    status: string;
    amount_usd: number;
    created_at: string;
    paid_at: string | null;
    provider_order_id: string | null;
  };
  latest_paid_at: string | null;
  paid_count_24h: number;
  pending_count_24h: number;
};


export const adminWebhookHealth = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data: row } = await supabaseAdmin
    .from("site_settings").select("value").eq("key", "payments").maybeSingle();
  const cfg = (row?.value ?? {}) as {
    stripe?: { enabled?: boolean; secret_key?: string; webhook_secret?: string };
    creem?: { enabled?: boolean; api_key?: string; webhook_secret?: string };
    whop?: { enabled?: boolean; api_key?: string; webhook_secret?: string };
    epay?: { enabled?: boolean; merchant_id?: string; key?: string; api_url?: string };
  };

  const since24h = new Date(Date.now() - 86400_000).toISOString();
  const providers: Array<WebhookProviderHealth["provider"]> = ["stripe", "creem", "whop", "epay"];

  const out: WebhookProviderHealth[] = [];
  for (const provider of providers) {
    const p = cfg[provider] ?? {};
    const enabled = Boolean(p.enabled);
    const configured =
      provider === "stripe" ? Boolean((p as { secret_key?: string; webhook_secret?: string }).secret_key && (p as { webhook_secret?: string }).webhook_secret)
      : provider === "creem" ? Boolean((p as { api_key?: string; webhook_secret?: string }).api_key && (p as { webhook_secret?: string }).webhook_secret)
      : provider === "whop" ? Boolean((p as { api_key?: string; webhook_secret?: string }).api_key && (p as { webhook_secret?: string }).webhook_secret)
      : Boolean((p as { merchant_id?: string; key?: string }).merchant_id && (p as { key?: string }).key);


    const { data: latest } = await supabaseAdmin
      .from("payment_intents")
      .select("id, order_no, status, amount_usd, created_at, paid_at, provider_order_id")
      .eq("provider", provider)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: latestPaid } = await supabaseAdmin
      .from("payment_intents")
      .select("paid_at")
      .eq("provider", provider)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: paidCount } = await supabaseAdmin
      .from("payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("provider", provider)
      .eq("status", "paid")
      .gte("paid_at", since24h);

    const { count: pendingCount } = await supabaseAdmin
      .from("payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("provider", provider)
      .eq("status", "pending")
      .gte("created_at", since24h);

    out.push({
      provider,
      enabled,
      configured,
      webhook_path: `/api/public/payments/webhook/${provider}`,
      latest_intent: latest ? {
        id: latest.id,
        order_no: latest.order_no,
        status: latest.status,
        amount_usd: Number(latest.amount_usd),
        created_at: latest.created_at,
        paid_at: latest.paid_at,
        provider_order_id: latest.provider_order_id,
      } : null,
      latest_paid_at: latestPaid?.paid_at ?? null,
      paid_count_24h: paidCount ?? 0,
      pending_count_24h: pendingCount ?? 0,
    });
  }
  return { providers: out };
});

// ─── Webhook event log ───────────────────────────────────────────────────

export const adminListWebhookEvents = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    provider: z.string().trim().min(1).max(20).optional(),
    outcome: z.string().trim().min(1).max(40).optional(),
    only_failures: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).default(100),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("webhook_event_log")
      .select("id, provider, event_type, event_id, intent_id, status_code, signature_valid, outcome, error, duration_ms, payload, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.provider) q = q.eq("provider", data.provider);
    if (data.outcome) q = q.eq("outcome", data.outcome);
    if (data.only_failures) q = q.gte("status_code", 400);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const adminRetryWebhookEvent = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row, error } = await supabaseAdmin
      .from("webhook_event_log")
      .select("id, provider, event_id, event_type, intent_id, payload")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Event not found");

    // We can only safely replay payment-completion events that carry an intent.
    const intentId = row.intent_id;
    if (!intentId) throw new Error("This event has no payment intent attached and cannot be retried automatically");

    const payload = (row.payload ?? {}) as { data?: { object?: { id?: string; payment_intent?: string } } };
    const obj = payload.data?.object ?? {};
    const providerOrderId = obj.payment_intent ?? obj.id ?? null;

    const result = await fulfillPaymentIntent({
      intentId,
      providerOrderId,
      notifyMeta: { source: "admin-retry", original_event_id: row.event_id, payload },
    });

    await supabaseAdmin.from("webhook_event_log").insert({
      provider: row.provider,
      event_type: row.event_type,
      event_id: null, // not the original delivery
      intent_id: intentId,
      status_code: result === "not-found" ? 404 : 200,
      signature_valid: true,
      outcome: result === "not-found" ? "intent-not-found" : result === "already-paid" ? "already-fulfilled" : "fulfilled",
      error: null,
      payload: { admin_retry_of: row.id } as never,
      headers: {} as never,
    });

    return { ok: true, result };
  });

