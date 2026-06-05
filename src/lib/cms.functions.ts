// Public CMS reads: site settings, pricing, models, docs, custom scripts.
// All read-only and unauthenticated.

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Variables exposed to docs page content (title, description, body).
 * Authors can write `{{site_name}}`, `{{site_url}}`, `{{api_base_url}}`
 * (or any alias below) and they get replaced at render time.
 * Lets us rebrand or move the API endpoint without editing every page.
 */
type DocVarKey = "site_name" | "site_url" | "api_base_url";

export const DOC_VAR_CATALOG: ReadonlyArray<{
  key: DocVarKey;
  label: string;
  description: string;
  aliases: string[];
}> = [
  {
    key: "site_name",
    label: "Site name",
    description: "Brand / site name configured in Admin → Site & SEO.",
    aliases: ["site_name", "sitename", "brand", "brand_name", "brandname", "name"],
  },
  {
    key: "site_url",
    label: "Site URL",
    description: "Public origin the docs are being served from (https://your-domain).",
    aliases: ["site_url", "siteurl", "website_url", "website", "base_url", "baseurl", "host", "domain", "url"],
  },
  {
    key: "api_base_url",
    label: "API base URL",
    description: "OpenAI-compatible endpoint used in code samples and curl commands.",
    aliases: ["api_base_url", "apibaseurl", "api_url", "apiurl", "api_endpoint", "apiendpoint", "endpoint", "apibase", "api_base"],
  },
];

const DOC_VAR_ALIASES: Record<string, DocVarKey> = (() => {
  const out: Record<string, DocVarKey> = {};
  for (const entry of DOC_VAR_CATALOG) {
    for (const alias of entry.aliases) out[alias.toLowerCase()] = entry.key;
  }
  return out;
})();

function substituteDocVars(text: string | null | undefined, vars: Record<DocVarKey, string>): string {
  if (!text) return text ?? "";
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const mapped = DOC_VAR_ALIASES[key.toLowerCase()];
    return mapped ? vars[mapped] : full;
  });
}

async function loadDocVars(): Promise<Record<DocVarKey, string>> {
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("key, value")
    .in("key", ["branding", "endpoints"]);
  const map = new Map<string, Record<string, unknown>>();
  for (const row of data ?? []) map.set(row.key, (row.value ?? {}) as Record<string, unknown>);
  const site_name = (map.get("branding")?.name as string) ?? "Nova AI Relay";
  const api_base_url = (map.get("endpoints")?.baseUrl as string) ?? "https://api.novarelay.io/v1";
  let site_url = "https://novarelay.io";
  try {
    const req = getRequest();
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const host = req.headers.get("host");
    if (host) site_url = `${proto}://${host}`;
  } catch {
    // No request context (rare) — fall back to the default above.
  }
  return { site_name, site_url, api_base_url };
}

/**
 * Public server fn used by the docs reference page and the admin docs editor
 * to show the current values + every supported alias.
 */
export const getDocVarReference = createServerFn({ method: "GET" }).handler(async () => {
  const values = await loadDocVars();
  return {
    values,
    catalog: DOC_VAR_CATALOG.map((c) => ({ ...c, value: values[c.key] })),
  };
});





// Keys safe to expose to anonymous browsers via the root loader.
// Sensitive keys (payments, tracking, newapi credentials, etc.) MUST NOT be
// included here — they are only readable through admin server functions.
const PUBLIC_SITE_SETTING_KEYS = [
  "branding",
  "hero",
  "contact",
  "company",
  "endpoints",
  "legal_terms",
  "legal_privacy",
  "newapi_public",
  "seo",
  "faq",
] as const;


export const getSiteSettings = createServerFn({ method: "GET" }).handler(
  async () => {
    const keys = [...PUBLIC_SITE_SETTING_KEYS, "payments"] as string[];
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("key, value")
      .in("key", keys);
    if (error) throw new Error(error.message);
    const allowed = new Set<string>(PUBLIC_SITE_SETTING_KEYS as unknown as string[]);
    const map: Record<string, unknown> = {};
    for (const row of data ?? []) {
      if (allowed.has(row.key)) {
        map[row.key] = row.value;
      } else if (row.key === "payments") {
        // Expose ONLY the enabled flags (and epay's enabled_types) so the
        // billing page can render provider buttons. Never expose api keys,
        // webhook secrets, merchant ids, or any other provider credentials.
        const pv = (row.value ?? {}) as Record<string, { enabled?: boolean; enabled_types?: string[] }>;
        map.payments = {
          epay: { enabled: pv.epay?.enabled === true, enabled_types: pv.epay?.enabled_types ?? [] },
          creem: { enabled: pv.creem?.enabled === true },
          whop: { enabled: pv.whop?.enabled === true },
          stripe: { enabled: pv.stripe?.enabled === true },
        };
      }
    }
    if (!map.endpoints) {
      map.endpoints = {
        baseUrl: "https://api.novagate.ai/v1",
        chatPath: "/chat/completions",
        messagesPath: "/messages",
        modelsPath: "/models",
      };
    }
    return map as {
      branding?: { name: string; tagline: string; logoEmoji?: string };
      hero?: {
        headline: string;
        subheadline: string;
        ctaPrimary: string;
        ctaSecondary: string;
      };
      contact?: { email?: string; telegram?: string; teams?: string; wechat?: string; docsUrl?: string; statusUrl?: string };
      newapi?: { baseUrl: string; configured: boolean };
      endpoints?: { baseUrl?: string; chatPath?: string; messagesPath?: string; modelsPath?: string };
      seo?: { defaultTitle?: string; defaultDescription?: string; twitterHandle?: string; ogImage?: string };
      faq?: { items?: Array<{ question: string; answer: string }> };
      payments?: {
        epay?: { enabled?: boolean; enabled_types?: string[] };
        creem?: { enabled?: boolean };
        whop?: { enabled?: boolean };
        stripe?: { enabled?: boolean };
      };
    };
  },
);

export const getPricingPlans = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("pricing_plans")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getModelsCatalog = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("models_catalog")
      .select("*")
      .eq("is_visible", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getDocsGroups = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("docs_groups")
      .select("id, slug, name, description, sort_order")
      .eq("is_visible", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

export const getDocsIndex = createServerFn({ method: "GET" }).handler(
  async () => {
    const { data, error } = await supabaseAdmin
      .from("docs_pages")
      .select("slug, title, description, category, sort_order")
      .eq("is_published", true)
      .order("sort_order");
    if (error) throw new Error(error.message);
    const vars = await loadDocVars();
    return (data ?? []).map((d) => ({
      ...d,
      title: substituteDocVars(d.title, vars),
      description: d.description == null ? d.description : substituteDocVars(d.description, vars),
    }));
  },
);

export const getDocPage = createServerFn({ method: "GET" })
  .inputValidator((input) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    const { data: page, error } = await supabaseAdmin
      .from("docs_pages")
      .select("*")
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!page) return page;
    const vars = await loadDocVars();
    return {
      ...page,
      title: substituteDocVars(page.title, vars),
      description: page.description == null ? page.description : substituteDocVars(page.description, vars),
      body_md: substituteDocVars(page.body_md, vars),
    };
  });


export const getCustomScriptsForRoute = createServerFn({ method: "GET" })
  .inputValidator((input) =>
    z.object({ scope: z.string().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabaseAdmin
      .from("custom_scripts")
      .select("placement, code, page_scope")
      .eq("is_enabled", true)
      .in("page_scope", ["global", data.scope])
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getActiveAnnouncements = createServerFn({ method: "GET" }).handler(
  async () => {
    const nowIso = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("id, title, body, level, link_url, link_label, starts_at, ends_at, sort_order, created_at")
      .eq("is_active", true)
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).filter((a) => {
      if (a.starts_at && a.starts_at > nowIso) return false;
      if (a.ends_at && a.ends_at < nowIso) return false;
      return true;
    });
  },
);

