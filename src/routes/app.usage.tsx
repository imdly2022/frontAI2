import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { usageStats } from "@/lib/console.functions";
import { DateRangePicker, defaultLast30, toRangeKey, type DateRangeValue } from "@/components/app/DateRangePicker";

export const Route = createFileRoute("/app/usage")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["usage", 30], queryFn: () => usageStats({ data: { days: 30 } }) }),
  component: UsagePage,
  errorComponent: ({ error }) => (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm">
        <div className="font-medium mb-2">Usage 加载失败</div>
        <pre className="text-xs whitespace-pre-wrap text-muted-foreground">{error?.message ?? String(error)}</pre>
      </div>
    </div>
  ),
  pendingComponent: () => <div className="p-8 text-sm text-muted-foreground">Loading usage…</div>,
});

function UsagePage() {
  const [range, setRange] = useState<DateRangeValue>(() => defaultLast30());
  const [start, end] = toRangeKey(range);
  const fetcher = useServerFn(usageStats);
  const { data } = useSuspenseQuery({
    queryKey: ["usage", start, end],
    queryFn: () => fetcher({ data: { start_timestamp: start, end_timestamp: end } }),
  });

  const byDay = useMemo(() => {
    const m = new Map<string, { quota: number; count: number }>();
    for (const r of data) {
      const cur = m.get(r.day) ?? { quota: 0, count: 0 };
      cur.quota += r.quota; cur.count += r.count;
      m.set(r.day, cur);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }));
  }, [data]);

  const byModel = useMemo(() => {
    const m = new Map<string, { quota: number; count: number }>();
    for (const r of data) {
      const cur = m.get(r.model_name) ?? { quota: 0, count: 0 };
      cur.quota += r.quota; cur.count += r.count;
      m.set(r.model_name, cur);
    }
    return Array.from(m.entries()).map(([model, v]) => ({ model, ...v }))
      .sort((a, b) => b.quota - a.quota).slice(0, 12);
  }, [data]);

  const max = Math.max(1, ...byDay.map(d => d.quota));
  const totalSpend = byDay.reduce((s, d) => s + d.quota, 0) / 500000;
  const totalRequests = byDay.reduce((s, d) => s + d.count, 0);

  function exportCsv() {
    const rows = ["day,model,requests,quota_usd"];
    for (const r of data) rows.push(`${r.day},${r.model_name},${r.count},${(r.quota/500000).toFixed(6)}`);
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `usage-${start}-${end}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-amber-500/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-amber-500/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-amber-500/90">Analytics</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Usage</h1>
            <p className="text-sm text-muted-foreground mt-1">Track spend and request volume over time.</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker value={range} onChange={setRange} />
            <button onClick={exportCsv} className="rounded-md border border-border/60 bg-background/80 backdrop-blur px-4 py-2 text-sm hover:bg-accent/50">Export CSV</button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Stat label="Total spend" value={`$${totalSpend.toFixed(4)}`} />
        <Stat label="Total requests" value={totalRequests.toLocaleString()} />
        <Stat label="Days tracked" value={byDay.length.toString()} />
      </div>

      <section className="rounded-xl border border-border/60 bg-card/40 p-6 mb-8">
        <h2 className="text-sm font-medium mb-4">Daily spend (USD)</h2>
        <div className="flex items-end gap-1 h-48">
          {byDay.length === 0 && <div className="w-full text-center text-sm text-muted-foreground self-center">No usage yet.</div>}
          {byDay.map((d) => (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.day}: $${(d.quota/500000).toFixed(4)}`}>
              <div className="w-full rounded-t bg-primary/70 group-hover:bg-primary transition-colors" style={{ height: `${(d.quota / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border/60 overflow-hidden">
        <div className="px-6 py-4 border-b border-border/60 bg-card/40"><h2 className="text-sm font-medium">Top models</h2></div>
        <table className="w-full text-sm">
          <thead className="bg-card/30 text-xs uppercase text-muted-foreground">
            <tr><th className="text-left px-6 py-2">Model</th><th className="text-right px-6 py-2">Requests</th><th className="text-right px-6 py-2">Spend</th></tr>
          </thead>
          <tbody>
            {byModel.length === 0 && <tr><td colSpan={3} className="px-6 py-8 text-center text-muted-foreground">No model usage yet.</td></tr>}
            {byModel.map((m) => (
              <tr key={m.model} className="border-t border-border/60">
                <td className="px-6 py-3 font-mono text-xs">{m.model}</td>
                <td className="px-6 py-3 text-right">{m.count.toLocaleString()}</td>
                <td className="px-6 py-3 text-right font-mono">${(m.quota / 500000).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}
