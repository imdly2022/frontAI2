import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { adminListSettings, adminUpsertSetting } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/site")({
  head: () => ({ meta: [{ title: "Site & SEO — Admin" }, { name: "robots", content: "noindex" }] }),
  component: SiteSettingsPage,
});

type Row = { key: string; value: unknown };

// ─── Field schema definitions ────────────────────────────────────────────
type FieldType = "text" | "textarea" | "number" | "boolean" | "url" | "email" | "markdown" | "csv" | "qa_list";
type Field = { key: string; label: string; type: FieldType; placeholder?: string; help?: string; rows?: number };
type Section = {
  key: string;
  title: string;
  help: string;
  fields?: Field[];
  // For payments/tracking we use grouped subsections
  groups?: Array<{ key: string; title: string; fields: Field[] }>;
  defaults: Record<string, unknown>;
};

const SECTIONS: Section[] = [
  {
    key: "branding",
    title: "Branding",
    help: "Brand name + tagline used in header/footer.",
    defaults: { name: "NovaGate AI", tagline: "One API. Every model.", logoEmoji: "⚡" },
    fields: [
      { key: "name", label: "Site name", type: "text", placeholder: "NovaGate AI" },
      { key: "tagline", label: "Tagline", type: "text", placeholder: "One API. Every model." },
      { key: "logoEmoji", label: "Logo emoji", type: "text", placeholder: "⚡" },
    ],
  },
  {
    key: "hero",
    title: "Landing hero",
    help: "Landing page hero copy.",
    defaults: { headline: "", subheadline: "", ctaPrimary: "Get your API key", ctaSecondary: "View pricing" },
    fields: [
      { key: "headline", label: "Headline", type: "text" },
      { key: "subheadline", label: "Sub-headline", type: "textarea", rows: 2 },
      { key: "ctaPrimary", label: "Primary CTA", type: "text" },
      { key: "ctaSecondary", label: "Secondary CTA", type: "text" },
    ],
  },
  {
    key: "seo",
    title: "SEO defaults",
    help: "Sitewide SEO defaults used when a page doesn't set its own.",
    defaults: { defaultTitle: "", defaultDescription: "", twitterHandle: "", ogImage: "" },
    fields: [
      { key: "defaultTitle", label: "Default title", type: "text" },
      { key: "defaultDescription", label: "Default description", type: "textarea", rows: 2 },
      { key: "twitterHandle", label: "Twitter handle", type: "text", placeholder: "@yourhandle" },
      { key: "ogImage", label: "Open Graph image URL", type: "url" },
    ],
  },
  {
    key: "faq",
    title: "FAQ (for GEO / AI search)",
    help: "Q&A shown on the homepage and exposed as FAQPage JSON-LD. Helps AI search engines (ChatGPT, Perplexity, Google AIO) cite your answers.",
    defaults: { items: [] },
    fields: [
      { key: "items", label: "Questions & answers", type: "qa_list" },
    ],
  },
  {
    key: "referrals",
    title: "Referral program",
    help: "Defaults applied when a new affiliate account is auto-created. Edit per-affiliate rates in Admin → Affiliates.",
    defaults: { defaultCommissionRate: 0.10 },
    fields: [
      { key: "defaultCommissionRate", label: "Default commission rate (0–1, e.g. 0.10 = 10%)", type: "number", help: "Used for newly created referrer accounts." },
    ],
  },

  {
    key: "site",
    title: "Site URL",
    help: "Public base URL (https://example.com) used in sitemap & canonical.",
    defaults: { baseUrl: "" },
    fields: [{ key: "baseUrl", label: "Base URL", type: "url", placeholder: "https://example.com" }],
  },
  {
    key: "endpoints",
    title: "Public API endpoints",
    help: "Shown on the user Tokens page. Leave baseUrl blank to auto-derive from the site origin.",
    defaults: { baseUrl: "", chatPath: "/chat/completions", messagesPath: "/messages", modelsPath: "/models" },
    fields: [
      { key: "baseUrl", label: "Base URL (includes /v1)", type: "url", placeholder: "https://api.example.com/v1" },
      { key: "chatPath", label: "Chat path", type: "text" },
      { key: "messagesPath", label: "Messages path", type: "text" },
      { key: "modelsPath", label: "Models path", type: "text" },
    ],
  },
  {
    key: "contact",
    title: "Contact",
    help: "Footer contact channels. Leave any field empty to hide it.",
    defaults: { email: "", telegram: "", teams: "", wechat: "", docsUrl: "/docs", statusUrl: "" },
    fields: [
      { key: "email", label: "Support email", type: "email" },
      { key: "telegram", label: "Telegram", type: "text", placeholder: "@yourbot" },
      { key: "teams", label: "Teams link", type: "url" },
      { key: "wechat", label: "WeChat", type: "text" },
      { key: "docsUrl", label: "Docs URL", type: "text" },
      { key: "statusUrl", label: "Status URL", type: "url" },
    ],
  },
  {
    key: "newapi",
    title: "Upstream NewAPI",
    help: "Internal upstream base URL. NEWAPI_BASE_URL env wins if set.",
    defaults: { baseUrl: "https://ai.x1x.pw", configured: true },
    fields: [
      { key: "baseUrl", label: "Base URL", type: "url" },
      { key: "configured", label: "Configured", type: "boolean" },
    ],
  },
  {
    key: "payments",
    title: "Payments",
    help: "Webhook URLs: /api/public/payments/webhook/{epay|creem|whop|stripe}. For Creem set creem_product_id on each plan; for Whop set whop_plan_id. For Stripe pricing is created on the fly from each plan's price.",
    defaults: {
      currency: "USD",
      epay: { enabled: false, api_url: "", pid: "", key: "", enabled_types: ["alipay", "wxpay", "usdt"] },
      creem: { enabled: false, api_key: "", webhook_secret: "", test_mode: false },
      whop: { enabled: false, api_key: "", webhook_secret: "" },
      stripe: { enabled: false, publishable_key: "", secret_key: "", webhook_secret: "", test_mode: false },
    },
    groups: [
      {
        key: "currency",
        title: "Currency",
        fields: [{ key: "currency", label: "Currency", type: "text", placeholder: "USD" }],
      },
      {
        key: "epay",
        title: "ePay",
        fields: [
          { key: "epay.enabled", label: "Enabled", type: "boolean" },
          { key: "epay.api_url", label: "API URL", type: "url" },
          { key: "epay.pid", label: "PID", type: "text" },
          { key: "epay.key", label: "Merchant key", type: "text" },
          { key: "epay.enabled_types", label: "Enabled payment types (comma separated)", type: "csv", help: "e.g. alipay,wxpay,usdt" },
        ],
      },
      {
        key: "stripe",
        title: "Stripe",
        fields: [
          { key: "stripe.enabled", label: "Enabled", type: "boolean" },
          { key: "stripe.publishable_key", label: "Publishable key", type: "text", help: "pk_test_… or pk_live_… (optional, for future client-side use)" },
          { key: "stripe.secret_key", label: "Secret key", type: "text", help: "sk_test_… or sk_live_…  Falls back to env STRIPE_SECRET_KEY." },
          { key: "stripe.webhook_secret", label: "Webhook secret", type: "text", help: "whsec_… from Stripe Dashboard → Webhooks. Falls back to env STRIPE_WEBHOOK_SECRET." },
          { key: "stripe.test_mode", label: "Test mode (informational)", type: "boolean" },
        ],
      },
      {
        key: "creem",
        title: "Creem",
        fields: [
          { key: "creem.enabled", label: "Enabled", type: "boolean" },
          { key: "creem.api_key", label: "API key", type: "text", help: "creem_test_… auto-uses test API; creem_live_… uses production." },
          { key: "creem.webhook_secret", label: "Webhook secret", type: "text" },
          { key: "creem.test_mode", label: "Force test mode", type: "boolean" },
        ],
      },
      {
        key: "whop",
        title: "Whop",
        fields: [
          { key: "whop.enabled", label: "Enabled", type: "boolean" },
          { key: "whop.api_key", label: "API key", type: "text" },
          { key: "whop.webhook_secret", label: "Webhook secret", type: "text" },
        ],
      },
    ],
  },
  {
    key: "legal_terms",
    title: "Legal — Terms of Service",
    help: "Markdown shown at /legal/terms.",
    defaults: { title: "Terms of Service", updated: "", body_md: "" },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "updated", label: "Last updated (YYYY-MM-DD)", type: "text" },
      { key: "body_md", label: "Body (Markdown)", type: "markdown", rows: 16 },
    ],
  },
  {
    key: "legal_privacy",
    title: "Legal — Privacy Policy",
    help: "Markdown shown at /legal/privacy.",
    defaults: { title: "Privacy Policy", updated: "", body_md: "" },
    fields: [
      { key: "title", label: "Title", type: "text" },
      { key: "updated", label: "Last updated (YYYY-MM-DD)", type: "text" },
      { key: "body_md", label: "Body (Markdown)", type: "markdown", rows: 16 },
    ],
  },
  {
    key: "tracking",
    title: "Conversion tracking",
    help: "Server-side conversion tracking. Fires Lead on register and Purchase on paid webhook.",
    defaults: {
      facebook: { pixel_id: "", access_token: "", test_event_code: "" },
      google: { conversion_id: "", conversion_label: "" },
      tiktok: { pixel_code: "", access_token: "" },
    },
    groups: [
      {
        key: "facebook",
        title: "Facebook CAPI",
        fields: [
          { key: "facebook.pixel_id", label: "Pixel ID", type: "text" },
          { key: "facebook.access_token", label: "Access token", type: "text" },
          { key: "facebook.test_event_code", label: "Test event code", type: "text" },
        ],
      },
      {
        key: "google",
        title: "Google Ads",
        fields: [
          { key: "google.conversion_id", label: "Conversion ID", type: "text" },
          { key: "google.conversion_label", label: "Conversion label", type: "text" },
        ],
      },
      {
        key: "tiktok",
        title: "TikTok Events API",
        fields: [
          { key: "tiktok.pixel_code", label: "Pixel code", type: "text" },
          { key: "tiktok.access_token", label: "Access token", type: "text" },
        ],
      },
    ],
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function getPath(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[k] : undefined), obj);
}
function setPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split(".");
  const out = { ...obj };
  let cur: Record<string, unknown> = out;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    const next = cur[k];
    cur[k] = next && typeof next === "object" && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[keys[keys.length - 1]] = value;
  return out;
}
function mergeDefaults(defaults: Record<string, unknown>, existing: unknown): Record<string, unknown> {
  if (!existing || typeof existing !== "object" || Array.isArray(existing)) return { ...defaults };
  const ex = existing as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(defaults)) {
    const dv = defaults[k];
    const ev = ex[k];
    if (dv && typeof dv === "object" && !Array.isArray(dv)) {
      out[k] = mergeDefaults(dv as Record<string, unknown>, ev);
    } else {
      out[k] = ev !== undefined ? ev : dv;
    }
  }
  // Preserve any extra keys the user already has
  for (const k of Object.keys(ex)) if (!(k in out)) out[k] = ex[k];
  return out;
}

// ─── Page ────────────────────────────────────────────────────────────────
function SiteSettingsPage() {
  const listFn = useServerFn(adminListSettings);
  const upsertFn = useServerFn(adminUpsertSetting);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => listFn() });

  return (
    <>
      <AdminHeader title="Site & SEO" description="Edit branding, landing copy, SEO defaults and connector config." />
      <div className="p-8 space-y-6 max-w-4xl">
        {SECTIONS.map((s) => {
          const existing = (data ?? []).find((r: Row) => r.key === s.key);
          const initial = mergeDefaults(s.defaults, existing?.value);
          return (
            <SectionEditor
              key={s.key}
              section={s}
              initial={initial}
              onSave={async (value) => {
                await upsertFn({ data: { key: s.key, value } });
                toast.success(`Saved ${s.title}`);
                qc.invalidateQueries({ queryKey: ["admin", "settings"] });
              }}
            />
          );
        })}
      </div>
    </>
  );
}

function SectionEditor({ section, initial, onSave }: { section: Section; initial: Record<string, unknown>; onSave: (v: unknown) => Promise<void> }) {
  const [state, setState] = useState<Record<string, unknown>>(initial);
  const [saving, setSaving] = useState(false);
  const [rawMode, setRawMode] = useState(false);
  const [rawText, setRawText] = useState(() => JSON.stringify(initial, null, 2));

  // Re-sync when the loaded data arrives later
  const initialJson = useMemo(() => JSON.stringify(initial), [initial]);
  useEffect(() => {
    setState(initial);
    setRawText(JSON.stringify(initial, null, 2));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialJson]);

  async function save() {
    let payload: unknown = state;
    if (rawMode) {
      try { payload = JSON.parse(rawText); } catch { toast.error("Invalid JSON"); return; }
    }
    setSaving(true);
    try {
      await onSave(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border/60 bg-card/40 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{section.title}</h3>
          <p className="text-xs text-muted-foreground mt-1">{section.help}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRawMode((v) => !v)}
            className="rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-accent"
          >
            {rawMode ? "Form view" : "Raw JSON"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-4">
        {rawMode ? (
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            rows={Math.min(20, rawText.split("\n").length + 1)}
            className="w-full rounded-md border border-input bg-background/50 px-3 py-2 font-mono text-xs"
          />
        ) : section.groups ? (
          <div className="space-y-5">
            {section.groups.map((g) => (
              <div key={g.key} className="rounded-md border border-border/40 p-4">
                <h4 className="text-sm font-medium mb-3">{g.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {g.fields.map((f) => (
                    <FieldInput
                      key={f.key}
                      field={f}
                      value={getPath(state, f.key)}
                      onChange={(v) => setState((s) => setPath(s, f.key, v))}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(section.fields ?? []).map((f) => (
              <FieldInput
                key={f.key}
                field={f}
                value={getPath(state, f.key)}
                onChange={(v) => setState((s) => setPath(s, f.key, v))}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (v: unknown) => void }) {
  const full = field.type === "textarea" || field.type === "markdown" || field.type === "csv" || field.type === "qa_list";
  const baseInput = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";

  let control: React.ReactNode;
  if (field.type === "boolean") {
    control = (
      <label className="flex items-center gap-2 text-sm py-1.5">
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-muted-foreground">Enabled</span>
      </label>
    );
  } else if (field.type === "number") {
    control = (
      <input
        type="number"
        value={typeof value === "number" ? value : ""}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
        className={baseInput}
        placeholder={field.placeholder}
      />
    );
  } else if (field.type === "textarea" || field.type === "markdown") {
    control = (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        rows={field.rows ?? 4}
        spellCheck={field.type === "markdown"}
        className={`${baseInput} ${field.type === "markdown" ? "font-mono text-xs" : ""}`}
        placeholder={field.placeholder}
      />
    );
  } else if (field.type === "csv") {
    const arr = Array.isArray(value) ? (value as unknown[]).map(String) : typeof value === "string" ? [value] : [];
    control = (
      <input
        type="text"
        value={arr.join(",")}
        onChange={(e) => onChange(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))}
        className={baseInput}
        placeholder={field.placeholder}
      />
    );
  } else if (field.type === "qa_list") {
    type QA = { question: string; answer: string };
    const items: QA[] = Array.isArray(value)
      ? (value as unknown[]).map((it) => {
          const o = (it ?? {}) as Record<string, unknown>;
          return { question: String(o.question ?? ""), answer: String(o.answer ?? "") };
        })
      : [];
    const update = (next: QA[]) => onChange(next);
    control = (
      <div className="space-y-3">
        {items.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No questions yet. Click "Add question" to start.</p>
        )}
        {items.map((it, i) => (
          <div key={i} className="rounded-md border border-border/40 p-3 space-y-2 bg-background/30">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Q{i + 1}</span>
              <button
                type="button"
                onClick={() => update(items.filter((_, j) => j !== i))}
                className="text-xs text-destructive hover:underline"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              value={it.question}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)))}
              className={baseInput}
              placeholder="Question (e.g. Which models are supported?)"
            />
            <textarea
              value={it.answer}
              onChange={(e) => update(items.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)))}
              rows={3}
              className={baseInput}
              placeholder="Answer. Variables like {{site_name}} and {{api_base_url}} are substituted at render."
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => update([...items, { question: "", answer: "" }])}
          className="rounded-md border border-input px-3 py-1.5 text-xs hover:bg-accent"
        >
          + Add question
        </button>
      </div>
    );
  } else {
    control = (
      <input
        type={field.type === "url" ? "url" : field.type === "email" ? "email" : "text"}
        value={typeof value === "string" ? value : value == null ? "" : String(value)}
        onChange={(e) => onChange(e.target.value)}
        className={baseInput}
        placeholder={field.placeholder}
      />
    );
  }

  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="text-xs text-muted-foreground">{field.label}</label>
      <div className="mt-1">{control}</div>
      {field.help && <p className="text-xs text-muted-foreground mt-1">{field.help}</p>}
    </div>
  );
}
