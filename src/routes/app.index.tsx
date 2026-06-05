import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUpRight, Wallet, Activity, KeyRound, Megaphone, ExternalLink,
  Sparkles, Zap, BookOpen, Gift, BarChart3, Users,
} from "lucide-react";
import { dashboardSummary } from "@/lib/console.functions";
import { getActiveAnnouncements } from "@/lib/cms.functions";

export const Route = createFileRoute("/app/")({
  loader: async ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["dashboard"], queryFn: () => dashboardSummary() }),
  component: DashboardPage,
});

type Level = "info" | "success" | "warning" | "critical";
const LEVEL_STYLES: Record<Level, { wrap: string; badge: string }> = {
  info: { wrap: "border-primary/30 bg-primary/5", badge: "bg-primary/10 text-primary" },
  success: { wrap: "border-emerald-500/30 bg-emerald-500/5", badge: "bg-emerald-500/10 text-emerald-500" },
  warning: { wrap: "border-amber-500/30 bg-amber-500/5", badge: "bg-amber-500/10 text-amber-500" },
  critical: { wrap: "border-destructive/40 bg-destructive/5", badge: "bg-destructive/10 text-destructive" },
};

const QUICK_ACTIONS: Array<{ to: "/app/keys" | "/app/billing" | "/app/usage" | "/app/redeem" | "/app/referrals" | "/docs"; label: string; desc: string; icon: typeof KeyRound; tone: string }> = [
  { to: "/app/keys", label: "Tokens", desc: "Create & manage API tokens", icon: KeyRound, tone: "from-primary/15 to-primary/5 text-primary" },
  { to: "/app/billing", label: "Top up", desc: "Add balance, view invoices", icon: Wallet, tone: "from-emerald-500/15 to-emerald-500/5 text-emerald-500" },
  { to: "/app/usage", label: "Usage", desc: "Per-model spend and tokens", icon: BarChart3, tone: "from-amber-500/15 to-amber-500/5 text-amber-500" },
  { to: "/app/redeem", label: "Redeem code", desc: "Apply a credit code", icon: Gift, tone: "from-pink-500/15 to-pink-500/5 text-pink-500" },
  { to: "/app/referrals", label: "Earn", desc: "Refer & earn commission", icon: Users, tone: "from-violet-500/15 to-violet-500/5 text-violet-500" },
  { to: "/docs", label: "Docs", desc: "API reference & guides", icon: BookOpen, tone: "from-sky-500/15 to-sky-500/5 text-sky-500" },
];

function DashboardPage() {
  const fetcher = useServerFn(dashboardSummary);
  const annFetcher = useServerFn(getActiveAnnouncements);
  const { data } = useSuspenseQuery({ queryKey: ["dashboard"], queryFn: () => fetcher() });
  const { data: announcements } = useQuery({
    queryKey: ["announcements", "active"],
    queryFn: () => annFetcher(),
    staleTime: 60_000,
  });

  const stats = [
    { label: "Balance", value: `$${data.balance_usd.toFixed(4)}`, icon: Wallet, accent: "text-primary", hint: "Available credit" },
    { label: "Spent (30d)", value: `$${data.used_usd.toFixed(4)}`, icon: Activity, accent: "", hint: "Across all tokens" },
    { label: "Requests", value: data.request_count.toLocaleString(), icon: Zap, accent: "", hint: "Lifetime" },
    { label: "Active tokens", value: data.recent_tokens.filter((t) => t.status === 1).length.toString(), icon: KeyRound, accent: "", hint: `${data.recent_tokens.length} total` },
  ];


  return (
    <div className="p-8 max-w-6xl mx-auto space-y-10">
      {/* Welcome hero */}
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-primary/20 blur-3xl" aria-hidden />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-primary/80">
              <Sparkles className="h-3.5 w-3.5" /> Welcome back
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{data.user?.username || data.user?.display_name || "there"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Account snapshot, quick actions and recent activity.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/app/keys" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/80 px-4 py-2.5 text-sm font-medium hover:bg-accent/40 transition">
              <KeyRound className="h-4 w-4" /> New token
            </Link>
            <Link to="/app/billing" className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition">
              Top up balance <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div
            key={s.label}
            className={`group relative overflow-hidden rounded-xl border border-border/60 p-5 transition hover:-translate-y-0.5 hover:shadow-md ${
              i === 0 ? "bg-gradient-to-br from-primary/10 via-card to-card" : "bg-card/40"
            }`}
          >
            <div className="flex items-center justify-between text-muted-foreground text-xs uppercase tracking-wider">
              {s.label}
              <s.icon className={`h-4 w-4 ${s.accent}`} />
            </div>
            <div className={`mt-2 text-2xl font-semibold ${s.accent}`}>{s.value}</div>
            <div className="mt-1 text-xs text-muted-foreground">{s.hint}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_ACTIONS.map((a) => (
            <Link
              key={a.label}
              to={a.to}
              className={`group relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br ${a.tone} p-5 transition hover:-translate-y-0.5 hover:shadow-md`}
            >
              <div className="flex items-start justify-between">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-background/70 backdrop-blur">
                  <a.icon className="h-5 w-5" />
                </div>
                <ArrowUpRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition" />
              </div>
              <div className="mt-4 font-semibold text-foreground">{a.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{a.desc}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent tokens */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent tokens</h2>
          <Link to="/app/keys" className="text-sm text-primary hover:underline">Manage →</Link>
        </div>
        {data.recent_tokens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-10 text-center text-muted-foreground">
            No tokens yet. <Link to="/app/keys" className="text-primary hover:underline">Create your first token</Link>.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-sm">
              <thead className="bg-card/50 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-4 py-3">Name</th><th className="text-left px-4 py-3">Status</th><th className="text-right px-4 py-3">Used</th></tr>
              </thead>
              <tbody>
                {data.recent_tokens.map((t) => (
                  <tr key={t.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.status === 1 ? "Active" : t.status === 2 ? "Paused" : "Inactive"}</td>
                    <td className="px-4 py-3 text-right font-mono text-muted-foreground">${(t.used_quota / 500000).toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Announcements — moved to bottom per user request */}
      {announcements && announcements.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Announcements
          </h2>
          {announcements.map((a) => {
            const style = LEVEL_STYLES[(a.level as Level) ?? "info"];
            return (
              <div key={a.id} className={`rounded-xl border p-4 ${style.wrap}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${style.badge}`}>
                    <Megaphone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.badge}`}>{a.level}</span>
                      <h3 className="font-semibold">{a.title}</h3>
                    </div>
                    {a.body && (
                      <div className="prose prose-sm prose-invert mt-1 max-w-none text-muted-foreground prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground prose-p:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{a.body}</ReactMarkdown>
                      </div>
                    )}
                    {a.link_url && (
                      <a href={a.link_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                        {a.link_label || "Learn more"} <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
