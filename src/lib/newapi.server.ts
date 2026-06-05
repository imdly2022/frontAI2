// Server-only wrapper around the New API HTTP interface.
// New API (https://github.com/Calcium-Ion/new-api) is an OpenAI-compatible
// LLM gateway. Its frontend logs in with username+password and then
// authenticates subsequent calls with a **session cookie** + the
// `New-Api-User` header carrying the numeric user id. The long-lived
// "access_token" is optional and only created when the user generates one
// from the profile page.
//
// We therefore support BOTH auth modes:
//   - cookie  (default — captured from /api/user/login Set-Cookie)
//   - token   (fallback — Bearer access_token if the user has one)
//
// Base URL is stored in public.site_settings.newapi.baseUrl so it can be
// edited from our admin panel without redeploying. The admin token lives
// in the NEWAPI_ADMIN_TOKEN secret (server-only env).

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type NewApiResponse<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  total?: number;
};

/** Credentials for a logged-in New API end user. */
export type UserAuth = {
  userId: number;
  /** Session cookie string captured from /api/user/login Set-Cookie. */
  cookie?: string;
  /** Optional long-lived access token (Bearer). */
  token?: string;
};

let cachedBaseUrl: { url: string; at: number } | null = null;

async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl && Date.now() - cachedBaseUrl.at < 60_000) return cachedBaseUrl.url;
  const envUrl = process.env.NEWAPI_BASE_URL?.trim();
  if (envUrl) {
    const u = envUrl.replace(/\/+$/, "");
    cachedBaseUrl = { url: u, at: Date.now() };
    return u;
  }
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "newapi")
    .maybeSingle();
  const url = (data?.value as { baseUrl?: string } | null)?.baseUrl?.trim();
  if (!url) {
    throw new Error(
      "New API is not connected yet. An administrator must set the base URL in Admin → New API.",
    );
  }
  const u = url.replace(/\/+$/, "");
  cachedBaseUrl = { url: u, at: Date.now() };
  return u;
}

function adminToken(): string {
  const t = process.env.NEWAPI_ADMIN_TOKEN;
  if (!t) throw new Error("NEWAPI_ADMIN_TOKEN is not configured");
  return t;
}

type FetchOpts = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** End-user auth (cookie or bearer token). Mutually exclusive with asAdmin. */
  auth?: UserAuth;
  asAdmin?: boolean;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Return raw Response (used by login to read Set-Cookie). */
  raw?: boolean;
};

function buildHeaders(opts: FetchOpts): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.asAdmin) {
    headers["Authorization"] = `Bearer ${adminToken()}`;
    headers["New-Api-User"] = "1"; // root user
    return headers;
  }
  if (opts.auth) {
    headers["New-Api-User"] = String(opts.auth.userId);
    if (opts.auth.token) {
      headers["Authorization"] = `Bearer ${opts.auth.token}`;
    }
    if (opts.auth.cookie) {
      headers["Cookie"] = opts.auth.cookie;
    }
  }
  return headers;
}

async function doFetch(path: string, opts: FetchOpts) {
  const base = await getBaseUrl();
  const url = new URL(base + (path.startsWith("/") ? path : `/${path}`));
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return fetch(url, {
    method: opts.method ?? "GET",
    headers: buildHeaders(opts),
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    redirect: "manual",
  });
}

export async function newapiFetch<T = unknown>(
  path: string,
  opts: FetchOpts = {},
): Promise<NewApiResponse<T>> {
  const res = await doFetch(path, opts);
  let json: NewApiResponse<T>;
  try {
    json = (await res.json()) as NewApiResponse<T>;
  } catch {
    throw new Error(`New API returned non-JSON response (HTTP ${res.status})`);
  }
  if (!res.ok || json.success === false) {
    throw new Error(json.message || `New API call failed (HTTP ${res.status})`);
  }
  return json;
}

/**
 * Extract the cookie string we should resend on subsequent calls.
 * Browsers send `name=value; name2=value2` — we strip per-cookie attributes
 * (Path, Expires, HttpOnly, …) and keep only the name=value pairs.
 */
function pickSessionCookie(setCookieHeader: string | null): string | undefined {
  if (!setCookieHeader) return undefined;
  // The Fetch API joins multiple Set-Cookie headers with ", " on some runtimes.
  // We split conservatively on ", " that precedes a `name=` token.
  const parts = setCookieHeader.split(/,(?=\s*[A-Za-z0-9_\-]+=)/);
  const pairs: string[] = [];
  for (const part of parts) {
    const first = part.split(";")[0]?.trim();
    if (first && first.includes("=")) pairs.push(first);
  }
  return pairs.length ? pairs.join("; ") : undefined;
}

// ─── Auth ────────────────────────────────────────────────────────────────

export type NewApiUser = {
  id: number;
  username: string;
  display_name?: string;
  email?: string;
  quota?: number;
  used_quota?: number;
  request_count?: number;
  role?: number;
  access_token?: string;
  aff_code?: string;
  aff_count?: number;
  aff_history_quota?: number;
  aff_quota?: number;
};

export type LoginResult = {
  user: NewApiUser;
  cookie?: string;
};

export async function newapiLogin(username: string, password: string): Promise<LoginResult> {
  const res = await doFetch("/api/user/login", {
    method: "POST",
    body: { username, password },
  });
  let json: NewApiResponse<NewApiUser>;
  try {
    json = (await res.json()) as NewApiResponse<NewApiUser>;
  } catch {
    throw new Error(`New API login returned non-JSON (HTTP ${res.status})`);
  }
  if (!res.ok || json.success === false || !json.data) {
    throw new Error(json.message || `Login failed (HTTP ${res.status})`);
  }
  const cookie = pickSessionCookie(res.headers.get("set-cookie"));
  return { user: json.data, cookie };
}

export async function newapiRegister(input: {
  username: string;
  password: string;
  email: string;
  verification_code?: string;
  aff_code?: string;
}) {
  return newapiFetch<NewApiUser>("/api/user/register", { method: "POST", body: input });
}

export async function newapiGetSelf(auth: UserAuth) {
  return newapiFetch<NewApiUser>("/api/user/self", { auth });
}

export async function newapiAdminGetUser(userId: number) {
  return newapiFetch<NewApiUser>(`/api/user/${userId}`, { asAdmin: true });
}

export async function newapiAdminSearchUsers(keyword: string) {
  return newapiFetch<NewApiUser[]>("/api/user/search", {
    asAdmin: true,
    query: { keyword, group: "" },
  });
}

export async function newapiAdminTopUp(input: { user_id: number; quota: number; remark?: string }) {
  // NewAPI's /api/user/manage add_quota expects { id, action, value, mode }.
  // `remark` is not persisted by NewAPI for this action; kept here for caller logging only.
  return newapiFetch("/api/user/manage", {
    method: "POST", asAdmin: true,
    body: { id: input.user_id, action: "add_quota", mode: "add", value: input.quota },
  });
}

export async function newapiAdminListUsers(query: { page?: number; size?: number } = {}) {
  return newapiFetch<NewApiUser[]>("/api/user/", {
    asAdmin: true,
    query: { p: query.page ?? 1, page_size: query.size ?? 50 },
  });
}

// Admin: reset password for an arbitrary user. NewAPI's PUT /api/user/
// accepts a partial user payload — we only send id+password to avoid
// clobbering other fields.
export async function newapiAdminUpdatePassword(input: { user_id: number; password: string }) {
  return newapiFetch("/api/user/", {
    method: "PUT", asAdmin: true,
    body: { id: input.user_id, password: input.password },
  });
}

export async function newapiTestConnection() {
  return newapiFetch("/api/status");
}

// ─── Tokens (API keys) ───────────────────────────────────────────────────

export type NewApiToken = {
  id: number;
  user_id: number;
  key: string;
  status: number;
  name: string;
  created_time: number;
  accessed_time: number;
  expired_time: number;
  remain_quota: number;
  unlimited_quota: boolean;
  used_quota: number;
  model_limits_enabled: boolean;
  model_limits: string;
};

export async function newapiListTokens(auth: UserAuth, page = 1, size = 30) {
  return newapiFetch<NewApiToken[]>("/api/token/", {
    auth, query: { p: page, page_size: size },
  });
}

export async function newapiCreateToken(auth: UserAuth, input: {
  name: string;
  remain_quota: number;
  expired_time: number;
  unlimited_quota: boolean;
  model_limits_enabled?: boolean;
  model_limits?: string;
}) {
  return newapiFetch<NewApiToken>("/api/token/", { method: "POST", auth, body: input });
}

export async function newapiGetToken(auth: UserAuth, id: number) {
  return newapiFetch<NewApiToken>(`/api/token/${id}`, { auth });
}

export async function newapiGetTokenKey(auth: UserAuth, id: number) {
  return newapiFetch<{ key: string }>(`/api/token/${id}/key`, { method: "POST", auth });
}

export async function newapiGetTokenKeysBatch(auth: UserAuth, ids: number[]) {
  return newapiFetch<{ keys: Record<string, string> }>("/api/token/batch/keys", {
    method: "POST",
    auth,
    body: { ids: ids.slice(0, 100) },
  });
}

export async function newapiUpdateToken(auth: UserAuth, input: Partial<NewApiToken> & { id: number }) {
  return newapiFetch("/api/token/", { method: "PUT", auth, body: input });
}

export async function newapiDeleteToken(auth: UserAuth, id: number) {
  return newapiFetch(`/api/token/${id}`, { method: "DELETE", auth });
}

// ─── Usage logs ──────────────────────────────────────────────────────────

export type NewApiLog = {
  id: number;
  user_id: number;
  created_at: number;
  type: number;
  content: string;
  username: string;
  token_name: string;
  model_name: string;
  quota: number;
  prompt_tokens: number;
  completion_tokens: number;
  use_time: number;
  is_stream: boolean;
  channel: number;
};

export async function newapiSelfLogs(auth: UserAuth, query: {
  page?: number; size?: number;
  type?: number;
  start_timestamp?: number; end_timestamp?: number;
  token_name?: string; model_name?: string;
} = {}) {
  return newapiFetch<NewApiLog[]>("/api/log/self", {
    auth,
    query: {
      p: query.page ?? 1,
      page_size: query.size ?? 30,
      type: query.type ?? 0,
      start_timestamp: query.start_timestamp,
      end_timestamp: query.end_timestamp,
      token_name: query.token_name,
      model_name: query.model_name,
    },
  });
}

export async function newapiSelfStats(auth: UserAuth, query: {
  start_timestamp?: number; end_timestamp?: number;
} = {}) {
  return newapiFetch<Array<{ day: string; quota: number; count: number; model_name: string }>>(
    "/api/log/self/stat",
    { auth, query },
  );
}

// ─── Redeem codes ────────────────────────────────────────────────────────

export async function newapiRedeem(auth: UserAuth, key: string) {
  return newapiFetch<{ quota: number }>("/api/user/topup", {
    method: "POST", auth, body: { key },
  });
}

// ─── Models exposed to user ──────────────────────────────────────────────

export async function newapiUserModels(auth: UserAuth) {
  return newapiFetch<string[]>("/api/user/models", { auth });
}

// ─── Quota helpers ───────────────────────────────────────────────────────
export const QUOTA_PER_USD = Number(process.env.NEWAPI_QUOTA_PER_USD ?? 500000);

export function quotaToUsd(q: number | undefined | null): number {
  if (!q) return 0;
  return Math.round((q / QUOTA_PER_USD) * 10000) / 10000;
}
export function usdToQuota(usd: number): number {
  return Math.round(usd * QUOTA_PER_USD);
}
