import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Plus, Copy, Check, Trash2, PauseCircle, PlayCircle,
  Zap, Lightbulb, KeyRound, Shield, Eye, EyeOff, ExternalLink, Download,
} from "lucide-react";
import { listTokens, createKey, getKey, updateKey, deleteKey } from "@/lib/console.functions";
import { getSiteSettings } from "@/lib/cms.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type CcswitchApp = {
  id: "claude" | "codex" | "gemini" | "opencode" | "openclaw" | "hermes";
  name: string;
  desc: string;
  accent: string; // tailwind classes for the icon tile
  letter: string;
};

const CCSWITCH_APPS: CcswitchApp[] = [
  { id: "claude",   name: "Claude Code",   desc: "Anthropic CLI & Desktop",        accent: "bg-orange-500/15 text-orange-500 border-orange-500/30",   letter: "C" },
  { id: "codex",    name: "Codex CLI",     desc: "OpenAI Codex assistant",          accent: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", letter: "X" },
  { id: "gemini",   name: "Gemini CLI",    desc: "Google Gemini terminal",          accent: "bg-sky-500/15 text-sky-500 border-sky-500/30",            letter: "G" },
  { id: "opencode", name: "OpenCode",      desc: "Open-source code agent",          accent: "bg-violet-500/15 text-violet-500 border-violet-500/30",   letter: "O" },
  { id: "openclaw", name: "OpenClaw",      desc: "Local AI agent project",          accent: "bg-rose-500/15 text-rose-500 border-rose-500/30",         letter: "Ø" },
  { id: "hermes",   name: "Hermes Agent",  desc: "Agent framework (2026.05+)",      accent: "bg-amber-500/15 text-amber-500 border-amber-500/30",      letter: "H" },
];

function todayStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function buildCcswitchUrl(opts: { app: CcswitchApp["id"]; brand: string; endpoint: string; token: string }) {
  const name = `${opts.brand} ${todayStamp()}`;
  return `ccswitch://v1/import?resource=provider&app=${opts.app}&name=${encodeURIComponent(name)}&endpoint=${encodeURIComponent(opts.endpoint)}&apiKey=${encodeURIComponent(opts.token)}`;
}

export const Route = createFileRoute("/app/keys")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["keys", 1], queryFn: () => listTokens({ data: { page: 1 } }) }),
      context.queryClient.fetchQuery({ queryKey: ["site-settings", "tokens"], queryFn: () => getSiteSettings() }),
    ]),
  component: KeysPage,
});

function useOrigin() {
  if (typeof window === "undefined") return "";
  return window.location.origin;
}

function CopyBtn({ value, label = "Copy", className = "", tone = "ghost", size = "sm" }: { value: string; label?: string; className?: string; tone?: "ghost" | "primary" | "subtle"; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  const base =
    tone === "primary" ? "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/40"
    : tone === "subtle" ? "bg-primary/10 text-primary border border-primary/30 hover:bg-primary/15"
    : "bg-background border-border/60 text-foreground/80 hover:bg-accent/50 hover:text-foreground";
  const sz = size === "md" ? "px-3 py-2 text-sm" : "px-2.5 py-1.5 text-xs";
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1600);
      }}
      className={`inline-flex items-center gap-1.5 rounded-md border font-medium transition-colors ${base} ${sz} ${className}`}
    >
      {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {done ? "Copied" : label}
    </button>
  );
}

function isMaskedToken(value: string) {
  return /\*{4,}/.test(value);
}

function normalizeEndpointBase(raw: unknown, origin: string) {
  const value = typeof raw === "string" ? raw : "";
  const trimmed = value.trim().replace(/\/+$/, "");
  return trimmed || (origin ? `${origin}/v1` : "https://api.example.com/v1");
}

function TokenField({ value, masked: maskedDefault = true }: { value: string; masked?: boolean }) {
  const [masked, setMasked] = useState(maskedDefault);
  const isMaskedFromServer = /\*{4,}/.test(value); // NewAPI already returns masked, no point toggling
  const showMask = masked && !isMaskedFromServer && value.length > 12;
  const display = showMask
    ? `${value.slice(0, 6)}${"•".repeat(Math.max(8, Math.min(28, value.length - 10)))}${value.slice(-4)}`
    : value;
  return (
    <div className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/70 px-3 py-2 font-mono text-xs hover:border-border transition-colors">
      <span className="flex-1 min-w-0 truncate select-all tracking-wide text-foreground/90">{display}</span>
      {!isMaskedFromServer && value.length > 12 && (
        <button
          type="button"
          onClick={() => setMasked((v) => !v)}
          className="rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          aria-label={masked ? "Reveal" : "Hide"}
          title={masked ? "Reveal" : "Hide"}
        >
          {masked ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </button>
      )}
      <CopyBtn value={value} label="Copy" />
    </div>
  );
}

function ListedTokenField({ tokenId, value }: { tokenId: number; value: string }) {
  const getFn = useServerFn(getKey);
  const [full, setFull] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const reveal = useMutation({
    mutationFn: () => getFn({ data: { id: tokenId } }),
    onSuccess: (res) => setFull((res as { key: string | null })?.key ?? null),
  });
  const displayValue = full ?? value;

  async function copyFullToken() {
    let token = full ?? value;
    if (isMaskedToken(token)) {
      const res = await reveal.mutateAsync();
      token = (res as { key: string | null })?.key ?? "";
    }
    if (!token || isMaskedToken(token)) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="group flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/70 px-3 py-2 font-mono text-xs hover:border-border transition-colors">
      <span className="flex-1 min-w-0 truncate select-all tracking-wide text-foreground/90">{displayValue}</span>
      {!full && isMaskedToken(value) && (
        <button
          type="button"
          onClick={() => reveal.mutate()}
          disabled={reveal.isPending}
          className="rounded p-1 text-muted-foreground hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
          aria-label="Reveal token"
          title="Reveal token"
        >
          <Eye className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={copyFullToken}
        disabled={reveal.isPending}
        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-accent/50 hover:text-foreground disabled:opacity-50"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {reveal.isPending ? "Fetching…" : copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function CcswitchPicker({
  trigger,
  brand,
  endpoint,
  resolveToken,
  align = "end",
}: {
  trigger: React.ReactNode;
  brand: string;
  endpoint: string;
  resolveToken: () => Promise<string>;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copiedApp, setCopiedApp] = useState<string | null>(null);

  async function ensureToken() {
    if (token) return token;
    setLoading(true);
    setErr(null);
    try {
      const t = await resolveToken();
      setToken(t);
      return t;
    } catch (e) {
      setErr((e as Error).message || "Failed to fetch token");
      throw e;
    } finally {
      setLoading(false);
    }
  }

  async function launch(app: CcswitchApp) {
    try {
      const t = await ensureToken();
      window.location.href = buildCcswitchUrl({ app: app.id, brand, endpoint, token: t });
    } catch { /* surfaced via err */ }
  }

  async function copy(app: CcswitchApp) {
    try {
      const t = await ensureToken();
      await navigator.clipboard.writeText(buildCcswitchUrl({ app: app.id, brand, endpoint, token: t }));
      setCopiedApp(app.id);
      setTimeout(() => setCopiedApp((c) => (c === app.id ? null : c)), 1600);
    } catch { /* surfaced via err */ }
  }

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) ensureToken().catch(() => {}); }}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-[380px] p-0 overflow-hidden border-border/60">
        <div className="relative bg-gradient-to-br from-primary/15 via-card to-card px-4 py-3 border-b border-border/60">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary/20 text-primary">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold leading-tight">Import to CCSwitch</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Profile name: <span className="font-mono text-foreground/80">{brand} {todayStamp()}</span>
              </div>
            </div>
          </div>
        </div>

        {loading && !token && (
          <div className="px-4 py-3 text-xs text-muted-foreground">Fetching token…</div>
        )}
        {err && (
          <div className="px-4 py-2 text-xs text-destructive border-b border-border/60 bg-destructive/5">{err}</div>
        )}

        <div className="p-2 grid grid-cols-1 gap-1 max-h-[360px] overflow-auto">
          {CCSWITCH_APPS.map((app) => (
            <div
              key={app.id}
              className="group flex items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 hover:bg-accent/50 hover:border-border/60 transition-colors"
            >
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border font-semibold ${app.accent}`}>
                {app.letter}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{app.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{app.desc}</div>
              </div>
              <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => copy(app)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background px-2 py-1 text-[11px] hover:bg-accent disabled:opacity-50"
                  title="Copy ccswitch:// URL"
                >
                  {copiedApp === app.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </button>
                <button
                  type="button"
                  onClick={() => launch(app)}
                  disabled={loading}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  title={`Open in ${app.name}`}
                >
                  <ExternalLink className="h-3 w-3" /> Open
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-2 border-t border-border/60 bg-muted/30 text-[10px] text-muted-foreground flex items-center justify-between">
          <span>Requires CCSwitch installed. Endpoint: <span className="font-mono text-foreground/70">{endpoint}</span></span>
          <a
            href="https://github.com/farion1231/cc-switch/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:text-primary/80 hover:underline"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function KeysPage() {
  const qc = useQueryClient();
  const fetcher = useServerFn(listTokens);
  const createFn = useServerFn(createKey);
  const updateFn = useServerFn(updateKey);
  const deleteFn = useServerFn(deleteKey);
  const getFn = useServerFn(getKey);
  const { data } = useSuspenseQuery({ queryKey: ["keys", 1], queryFn: () => fetcher({ data: { page: 1 } }) });
  const { data: site } = useSuspenseQuery({ queryKey: ["site-settings", "tokens"], queryFn: () => getSiteSettings() });

  const origin = useOrigin();
  const brandName = site?.branding?.name ?? "Nova AI Relay";
  const cfg = site?.endpoints ?? {};
  const apiBase = useMemo(() => {
    return normalizeEndpointBase(cfg.baseUrl, origin);
  }, [cfg.baseUrl, origin]);

  async function resolveTokenById(tokenId: number, listed: string): Promise<string> {
    if (listed && !isMaskedToken(listed)) return listed;
    const res = await getFn({ data: { id: tokenId } });
    const key = (res as { key: string | null })?.key ?? "";
    if (!key || isMaskedToken(key)) throw new Error("无法获取完整 token，请重新创建");
    return key;
  }

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState("");
  const [unlimited, setUnlimited] = useState(true);
  const [quotaUsd, setQuotaUsd] = useState(10);
  const [expiresDays, setExpiresDays] = useState(0);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [createWarn, setCreateWarn] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name || "Default token", unlimited, quota_usd: quotaUsd, expires_days: expiresDays, model_limits: [] } }),
    onSuccess: (res) => {
      const k = (res as { key: string | null })?.key ?? null;
      if (k) {
        setCreatedKey(k);
        setCreateWarn(null);
      } else {
        setCreatedKey(null);
        setCreateWarn("Token created, but the upstream did not return the full key. Recreate the token or copy from the list below.");
      }
      setShowNew(false);
      setName("");
      qc.invalidateQueries({ queryKey: ["keys"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: number; status: 1 | 2 }) => updateFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });
  const remove = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });


  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary/80">
              <KeyRound className="h-3.5 w-3.5" /> API access
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Tokens</h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl">
              Create, pause and delete API tokens. OpenAI / Anthropic / Claude Code compatible — point your client at the base URL.
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shadow-sm">
            <Plus className="h-4 w-4" /> New token
          </button>
        </div>

        {/* Compact Base URL bar */}
        <div className="relative mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-background/60 backdrop-blur px-3 py-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Base URL</span>
          <code className="flex-1 min-w-0 truncate font-mono text-xs text-foreground/90">{apiBase}</code>
          <CopyBtn value={apiBase} label="Copy" tone="subtle" />
        </div>

        {/* Subtle CCSwitch tip */}
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200/60 bg-rose-500/[0.08] px-3 py-2">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-500" />
          <p className="text-xs leading-relaxed text-foreground/80">
            Recommended: use{" "}
            <span className="font-medium text-foreground">CC Switch</span>
            {" "}to build a unified key manager—one command to gracefully switch and dispatch all token authorizations across Claude, Gemini, Codex, OpenClaw, Hermes, and more.
            <a
              href="https://github.com/farion1231/cc-switch/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-medium text-rose-600 hover:text-rose-700 hover:underline"
            >
              <Download className="h-3.5 w-3.5" />
              Download CCSwitch
            </a>
          </p>
        </div>
      </header>

      {createWarn && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-400">
          {createWarn}
        </div>
      )}

      {createdKey && (
        <div className="rounded-xl border border-success/40 bg-gradient-to-br from-success/10 to-success/5 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-success/20 text-success">
              <Check className="h-4 w-4" />
            </div>
            <div className="text-sm font-semibold text-success">Token created — copy it now, it won't be shown again</div>
          </div>
          <TokenField value={createdKey} masked={false} />
          <div className="flex items-center gap-2 flex-wrap">
            <CcswitchPicker
              brand={brandName}
              endpoint={apiBase}
              resolveToken={async () => createdKey}
              align="start"
              trigger={
                <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                  <Zap className="h-3.5 w-3.5" /> Import to CCSwitch
                </button>
              }
            />
            <button onClick={() => setCreatedKey(null)} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        </div>
      )}

      {showNew && (
        <div className="rounded-xl border border-border/60 bg-card/40 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="text-muted-foreground">Token name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="prod-backend"
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm focus:outline-none focus:border-primary" />
            </label>
            <label className="block text-sm">
              <span className="text-muted-foreground">Expires (days, 0 = never)</span>
              <input type="number" min={0} value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))}
                className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={unlimited} onChange={(e) => setUnlimited(e.target.checked)} />
            Unlimited quota (draws from account balance)
          </label>
          {!unlimited && (
            <label className="block text-sm">
              <span className="text-muted-foreground">Quota (USD)</span>
              <input type="number" min={0} step="0.01" value={quotaUsd} onChange={(e) => setQuotaUsd(Number(e.target.value))}
                className="mt-1 w-full max-w-xs rounded-md border border-border/60 bg-background px-3 py-2 text-sm" />
            </label>
          )}
          {create.error && <div className="text-sm text-destructive">{(create.error as Error).message}</div>}
          <div className="flex gap-2 pt-2">
            <button onClick={() => create.mutate()} disabled={create.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {create.isPending ? "Creating…" : "Create token"}
            </button>
            <button onClick={() => setShowNew(false)} className="rounded-md border border-border/60 px-4 py-2 text-sm hover:bg-accent/50">Cancel</button>
          </div>
        </div>
      )}

      <section>
        <div className="flex items-end justify-between mb-3">
          <h2 className="text-base font-semibold">Your tokens</h2>
          <span className="text-xs text-muted-foreground">{data.items.length} total</span>
        </div>

        {data.items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-card/30 p-10 text-center">
            <Shield className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">No tokens yet. Create one to start making requests.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {data.items.map((t) => {
              const statusLabel = t.status === 1 ? "Active" : t.status === 2 ? "Paused" : t.status === 3 ? "Expired" : "Exhausted";
              const statusTone =
                t.status === 1 ? "bg-success/15 text-success border-success/30"
                : t.status === 2 ? "bg-amber-500/10 text-amber-600 border-amber-500/30"
                : "bg-muted text-muted-foreground border-border";
              const display = t.key ?? "—";
              return (
                <div key={t.id} className="rounded-xl border border-border/60 bg-card/40 p-4 hover:border-border transition-colors">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{t.name}</span>
                      <span className={`text-[10px] uppercase tracking-wide rounded-full border px-2 py-0.5 ${statusTone}`}>{statusLabel}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <span>Used <span className="font-mono text-foreground">${(t.used_quota / 500000).toFixed(4)}</span></span>
                      <span>Quota <span className="font-mono text-foreground">{t.unlimited_quota ? "∞" : `$${(t.remain_quota / 500000).toFixed(2)}`}</span></span>
                    </div>
                  </div>
                  <ListedTokenField tokenId={t.id} value={display} />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <CcswitchPicker
                      brand={brandName}
                      endpoint={apiBase}
                      resolveToken={() => resolveTokenById(t.id, t.key ?? "")}
                      trigger={
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 text-primary border border-primary/30 px-2.5 py-1.5 text-xs font-medium hover:bg-primary/15 transition-colors"
                          title="Import this token into CCSwitch"
                        >
                          <Zap className="h-3.5 w-3.5" /> Import to CCSwitch
                        </button>
                      }
                    />
                    <button
                      onClick={() => toggle.mutate({ id: t.id, status: t.status === 1 ? 2 : 1 })}
                      disabled={toggle.isPending || t.status > 2}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-xs hover:bg-accent/50 disabled:opacity-40"
                    >
                      {t.status === 1 ? <><PauseCircle className="h-3.5 w-3.5" /> Pause</> : <><PlayCircle className="h-3.5 w-3.5" /> Resume</>}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Delete token "${t.name}"?`)) remove.mutate(t.id); }}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
