// User console server functions. Every handler resolves the New API user
// session (cookie or token) from our encrypted cookie, then proxies the
// matching New API call.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSession } from "./session.server";
import {
  newapiGetSelf,
  newapiListTokens, newapiCreateToken, newapiGetTokenKey, newapiUpdateToken, newapiDeleteToken,
  newapiSelfLogs, newapiSelfStats,
  newapiRedeem, newapiUserModels,
  quotaToUsd, usdToQuota,
  type NewApiToken, type NewApiLog, type NewApiUser,
} from "./newapi.server";

// ─── Dashboard ───────────────────────────────────────────────────────────

export const dashboardSummary = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await requireSession();
  const [selfRes, statsRes, tokensRes] = await Promise.all([
    newapiGetSelf(auth),
    newapiSelfStats(auth, {
      start_timestamp: Math.floor((Date.now() - 30 * 86400_000) / 1000),
      end_timestamp: Math.floor(Date.now() / 1000),
    }).catch(() => ({ data: [] as Array<{ day: string; quota: number; count: number; model_name: string }> })),
    newapiListTokens(auth, 1, 5).catch(() => ({ data: [] as NewApiToken[] | { items?: NewApiToken[] } })),
  ]);
  const u = selfRes.data as NewApiUser | undefined;
  const tokensRaw = tokensRes.data as unknown;
  const recent_tokens: NewApiToken[] = Array.isArray(tokensRaw)
    ? (tokensRaw as NewApiToken[])
    : ((tokensRaw as { items?: NewApiToken[] } | null)?.items ?? []);
  return {
    user: u ?? null,
    balance_usd: quotaToUsd(u?.quota) ?? 0,
    used_usd: quotaToUsd(u?.used_quota) ?? 0,
    request_count: u?.request_count ?? 0,
    aff_code: u?.aff_code ?? null,
    stats: (statsRes.data as Array<{ day: string; quota: number; count: number; model_name: string }>) ?? [],
    recent_tokens,
  };
});

// ─── Tokens (keys) ───────────────────────────────────────────────────────

// New API sometimes returns `data: T[]` and sometimes `data: { items: T[], total }`
// depending on version. Normalize both shapes.
function unwrapList<T>(raw: unknown, topTotal?: number): { items: T[]; total: number } {
  if (Array.isArray(raw)) return { items: raw as T[], total: topTotal ?? raw.length };
  const obj = (raw ?? {}) as { items?: T[]; records?: T[]; total?: number };
  const items = obj.items ?? obj.records ?? [];
  return { items, total: obj.total ?? topTotal ?? items.length };
}

export const listTokens = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ page: z.number().int().min(1).max(1000).default(1) }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const res = await newapiListTokens(auth, data.page, 30);
    return unwrapList<NewApiToken>(res.data, res.total);
  });

export const createKey = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    name: z.string().trim().min(1).max(60),
    quota_usd: z.number().min(0).max(100000).default(0),
    unlimited: z.boolean().default(true),
    expires_days: z.number().int().min(0).max(3650).default(0),
    model_limits: z.array(z.string().max(120)).max(50).default([]),
  }).parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const res = await newapiCreateToken(auth, {
      name: data.name,
      remain_quota: data.unlimited ? 0 : usdToQuota(data.quota_usd),
      expired_time: data.expires_days > 0 ? Math.floor(Date.now() / 1000) + data.expires_days * 86400 : -1,
      unlimited_quota: data.unlimited,
      model_limits_enabled: data.model_limits.length > 0,
      model_limits: data.model_limits.join(","),
    });
    // NewAPI varies: sometimes data is the token, sometimes a string key,
    // sometimes just `{success}`. Always normalize and fall back to fetching by id.
    const created = res.data as Partial<NewApiToken> | string | undefined;
    let key: string | null = null;
    let token: NewApiToken | null = null;
    if (typeof created === "string") {
      key = created;
    } else if (created && typeof created === "object") {
      token = created as NewApiToken;
      const maybe = (created as { key?: unknown }).key;
      if (typeof maybe === "string" && maybe.length > 0 && !/\*/.test(maybe)) key = maybe;
    }
    // If we still don't have a real key, look up the freshly created token id and
    // call NewAPI's dedicated POST /api/token/:id/key endpoint. GET /api/token/:id
    // intentionally returns a masked key, same as the list endpoint.
    if (!key) {
      try {
        const list = await newapiListTokens(auth, 1, 30);
        const arr = Array.isArray(list.data)
          ? (list.data as NewApiToken[])
          : (((list.data as unknown) as { items?: NewApiToken[] } | null)?.items ?? []);
        const match = arr.find((t) => t.name === data.name)
          ?? [...arr].sort((a, b) => (b.created_time ?? 0) - (a.created_time ?? 0))[0];
        if (match) {
          token = match;
          if (match.id) {
            const single = await newapiGetTokenKey(auth, match.id);
            const full = single.data?.key;
            if (typeof full === "string" && full.length > 0 && !/\*/.test(full)) {
              key = full;
            }
          }
        }
      } catch { /* ignore */ }
    }
    // NewAPI list returns keys prefixed with "sk-"; some installs prefix again on raw key.
    if (key && !key.startsWith("sk-")) key = `sk-${key}`;
    return { key, token };
  });

export const getKey = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const res = await newapiGetTokenKey(auth, data.id);
    const raw = res.data as { key?: string } | string | null | undefined;
    let key = typeof raw === "string" ? raw : raw?.key ?? null;
    if (key && !key.startsWith("sk-") && !/\*/.test(key)) key = `sk-${key}`;
    return { key };
  });


export const updateKey = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    id: z.number().int().positive(),
    name: z.string().trim().min(1).max(60).optional(),
    status: z.union([z.literal(1), z.literal(2)]).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    await newapiUpdateToken(auth, data);
    return { ok: true };
  });

export const deleteKey = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    await newapiDeleteToken(auth, data.id);
    return { ok: true };
  });

// ─── Logs ────────────────────────────────────────────────────────────────

export const listLogs = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({
    page: z.number().int().min(1).max(1000).default(1),
    type: z.number().int().min(0).max(5).default(0),
    days: z.number().int().min(1).max(365).optional(),
    start_timestamp: z.number().int().min(0).optional(),
    end_timestamp: z.number().int().min(0).optional(),
    token_name: z.string().max(60).optional(),
    model_name: z.string().max(120).optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const end = data.end_timestamp ?? Math.floor(Date.now() / 1000);
    const start = data.start_timestamp ?? end - (data.days ?? 30) * 86400;
    const res = await newapiSelfLogs(auth, {
      page: data.page, size: 30, type: data.type,
      start_timestamp: start, end_timestamp: end,
      token_name: data.token_name, model_name: data.model_name,
    });
    return unwrapList<NewApiLog>(res.data, res.total);
  });

// ─── Usage stats ─────────────────────────────────────────────────────────

export const usageStats = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({
    days: z.number().int().min(1).max(365).optional(),
    start_timestamp: z.number().int().min(0).optional(),
    end_timestamp: z.number().int().min(0).optional(),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const end = data.end_timestamp ?? Math.floor(Date.now() / 1000);
    const start = data.start_timestamp ?? end - (data.days ?? 30) * 86400;
    const res = await newapiSelfStats(auth, { start_timestamp: start, end_timestamp: end });
    const raw = res.data as unknown;
    // NewAPI variants: array | { items } | { stat } | { data } | object keyed by day
    let arr: any[] = [];
    if (Array.isArray(raw)) arr = raw;
    else if (raw && typeof raw === "object") {
      const o = raw as Record<string, unknown>;
      if (Array.isArray(o.items)) arr = o.items as any[];
      else if (Array.isArray(o.stat)) arr = o.stat as any[];
      else if (Array.isArray(o.data)) arr = o.data as any[];
      else if (Array.isArray(o.records)) arr = o.records as any[];
    }
    if (!arr.length && raw) {
      console.warn("[usageStats] unexpected NewAPI shape", { start, end, sample: JSON.stringify(raw).slice(0, 400) });
    }
    // Normalize key casing (some NewAPI forks return Day/Quota/Count/ModelName)
    return arr.map((r: any) => ({
      day: String(r.day ?? r.Day ?? r.date ?? ""),
      quota: Number(r.quota ?? r.Quota ?? r.token_used ?? 0),
      count: Number(r.count ?? r.Count ?? r.request_count ?? 0),
      model_name: String(r.model_name ?? r.ModelName ?? r.model ?? "unknown"),
    }));
  });

// ─── Redeem ──────────────────────────────────────────────────────────────

export const redeemCode = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ key: z.string().trim().min(4).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const res = await newapiRedeem(auth, data.key);
    return { added_usd: quotaToUsd(res.data?.quota ?? 0) };
  });

// ─── User-visible model list ────────────────────────────────────────────

export const userModels = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await requireSession();
  const res = await newapiUserModels(auth);
  return res.data ?? [];
});
