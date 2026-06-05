import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminDashboardExtended, adminTestNewApi } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { CheckCircle2, XCircle, TrendingUp, Users as UsersIcon, CreditCard, MousePointerClick } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin overview" }, { name: "robots", content: "noindex" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const dashFn = useServerFn(adminDashboardExtended);
  const testFn = useServerFn(adminTestNewApi);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "dashboard-ext"], queryFn: () => dashFn() });
  const newapi = useQuery({ queryKey: ["admin", "newapi"], queryFn: () => testFn() });

  const convRate = data && data.total_clicks_30d > 0
    ? ((data.total_conversions_30d / data.total_clicks_30d) * 100).toFixed(2) : "0.00";

  // Build sparkline
  const series = data?.revenue_series ?? [];
  const max = Math.max(1, ...series.map((s) => s.usd));

  return (
    <>
      <AdminHeader title="Overview" description="Last 30 days at a glance." />
      <div className="p-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Stat icon={TrendingUp} label="Revenue 24h" value={isLoading ? "…" : `$${(data?.revenue_1d_usd ?? 0).toFixed(2)}`} />
          <Stat icon={CreditCard} label="Revenue 30d" value={isLoading ? "…" : `$${(data?.revenue_30d_usd ?? 0).toFixed(2)}`} />
          <Stat icon={MousePointerClick} label="Clicks 30d" value={isLoading ? "…" : String(data?.total_clicks_30d ?? 0)} sub={`${convRate}% conv`} />
          <Stat icon={UsersIcon} label="Active affiliates" value={isLoading ? "…" : String(data?.active_affiliates ?? 0)} sub={`${data?.pending_payments ?? 0} pending payments`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Revenue chart */}
          <section className="surface-card p-5 lg:col-span-2">
            <h2 className="font-semibold mb-4">Revenue · last 30 days</h2>
            {series.length === 0 ? (
              <div className="h-40 grid place-items-center text-sm text-muted-foreground">No data</div>
            ) : (
              <div className="flex items-end gap-1 h-40">
                {series.map((s) => (
                  <div key={s.day} className="flex-1 group relative">
                    <div
                      className="rounded-t-md bg-primary/80 group-hover:bg-primary transition-colors"
                      style={{ height: `${(s.usd / max) * 100}%`, minHeight: s.usd > 0 ? "2px" : "0" }}
                      title={`${s.day} — $${s.usd.toFixed(2)}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>{series[0]?.day}</span>
              <span>{series[series.length - 1]?.day}</span>
            </div>
          </section>

          {/* Channels */}
          <section className="surface-card p-5">
            <h2 className="font-semibold mb-4">Top traffic channels</h2>
            {(data?.channels ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">No traffic yet.</div>
            ) : (
              <ul className="space-y-2.5 text-sm">
                {data!.channels.map((c) => {
                  const maxC = data!.channels[0].clicks;
                  return (
                    <li key={c.source}>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium">{c.source}</span>
                        <span className="text-muted-foreground">{c.clicks}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${(c.clicks / maxC) * 100}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* NewAPI status */}
        <section className="surface-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">New API connector</h2>
            <a href="/admin/newapi" className="text-xs text-primary hover:underline">Configure →</a>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            {newapi.isLoading ? <span className="text-muted-foreground">Checking…</span>
              : newapi.data?.ok
                ? <><CheckCircle2 className="h-4 w-4 text-success" /> Connected · version {newapi.data.version}</>
                : <><XCircle className="h-4 w-4 text-destructive" /> {newapi.data?.error ?? "Not reachable"}</>
            }
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Recent payment intents</h2>
          <div className="surface-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-4 py-2">Created</th><th className="text-left px-4 py-2">User</th><th className="text-left px-4 py-2">Provider</th><th className="text-left px-4 py-2">Amount</th><th className="text-left px-4 py-2">Status</th></tr>
              </thead>
              <tbody>
                {(data?.recent_intents ?? []).map((i) => (
                  <tr key={i.id} className="border-t border-border/40">
                    <td className="px-4 py-2 text-muted-foreground">{new Date(i.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2 font-mono">{i.newapi_user_id}</td>
                    <td className="px-4 py-2 capitalize">{i.provider}</td>
                    <td className="px-4 py-2">${Number(i.amount_usd).toFixed(2)}</td>
                    <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${i.status === "paid" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{i.status}</span></td>
                  </tr>
                ))}
                {!data?.recent_intents?.length && (
                  <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={5}>No payment intents yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground">
        {label}
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-2 text-[28px] font-semibold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
