import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listLogs } from "@/lib/console.functions";
import { DateRangePicker, defaultLast30, toRangeKey, type DateRangeValue } from "@/components/app/DateRangePicker";

const TYPE_LABEL: Record<number, string> = { 0: "All", 1: "Top-up", 2: "Consume", 3: "Admin", 4: "System" };

export const Route = createFileRoute("/app/logs")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["logs", 1, 0, 30], queryFn: () => listLogs({ data: { page: 1, type: 0, days: 30 } }) }),
  component: LogsPage,
});

function LogsPage() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState(0);
  const [tokenName, setTokenName] = useState("");
  const [modelName, setModelName] = useState("");
  const [range, setRange] = useState<DateRangeValue>(() => defaultLast30());
  const [start, end] = toRangeKey(range);
  const fetcher = useServerFn(listLogs);
  const { data } = useSuspenseQuery({
    queryKey: ["logs", page, type, start, end, tokenName, modelName],
    queryFn: () => fetcher({ data: {
      page, type, start_timestamp: start, end_timestamp: end,
      token_name: tokenName || undefined, model_name: modelName || undefined,
    } }),
  });

  function updateRange(v: DateRangeValue) { setRange(v); setPage(1); }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-sky-500/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-sky-500/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wider text-sky-500/90">Activity</div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Logs</h1>
            <p className="text-sm text-muted-foreground mt-1">Every request, top-up, and admin action.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={type} onChange={(e) => { setType(Number(e.target.value)); setPage(1); }} className="rounded-md border border-border/60 bg-background/80 backdrop-blur px-3 py-2 text-sm">
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <DateRangePicker value={range} onChange={updateRange} />
          </div>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2">
          <input
            value={tokenName}
            onChange={(e) => { setTokenName(e.target.value); setPage(1); }}
            placeholder="Filter by key name"
            className="rounded-md border border-border/60 bg-background/80 backdrop-blur px-3 py-2 text-sm w-48"
          />
          <input
            value={modelName}
            onChange={(e) => { setModelName(e.target.value); setPage(1); }}
            placeholder="Filter by model"
            className="rounded-md border border-border/60 bg-background/80 backdrop-blur px-3 py-2 text-sm w-48"
          />
          {(tokenName || modelName) && (
            <button onClick={() => { setTokenName(""); setModelName(""); setPage(1); }} className="rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-accent/50">Clear</button>
          )}
        </div>
      </header>

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead className="bg-card/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Time</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Key</th>
              <th className="text-left px-4 py-3">Model</th>
              <th className="text-right px-4 py-3">Tokens</th>
              <th className="text-right px-4 py-3">Quota</th>
              <th className="text-right px-4 py-3">Latency</th>
            </tr>
          </thead>
          <tbody>
            {data.items.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No log entries.</td></tr>}
            {data.items.map((l) => (
              <tr key={l.id} className="border-t border-border/60">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{new Date(l.created_at * 1000).toLocaleString()}</td>
                <td className="px-4 py-3">{TYPE_LABEL[l.type] ?? l.type}</td>
                <td className="px-4 py-3 text-muted-foreground">{l.token_name || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.model_name || "—"}</td>
                <td className="px-4 py-3 text-right font-mono">{(l.prompt_tokens || 0).toLocaleString()} / {(l.completion_tokens || 0).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">{l.type === 2 ? `-$${(l.quota/500000).toFixed(4)}` : l.type === 1 ? `+$${(l.quota/500000).toFixed(2)}` : "—"}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{l.use_time ? `${l.use_time}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mt-4 text-sm text-muted-foreground">
        <div>Page {page}</div>
        <div className="flex gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="rounded-md border border-border/60 px-3 py-1.5 disabled:opacity-40 hover:bg-accent/50">Prev</button>
          <button disabled={data.items.length < 30} onClick={() => setPage(p => p + 1)} className="rounded-md border border-border/60 px-3 py-1.5 disabled:opacity-40 hover:bg-accent/50">Next</button>
        </div>
      </div>
    </div>
  );
}
