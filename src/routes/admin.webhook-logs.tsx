import { Fragment } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AdminHeader } from "@/components/admin/AdminShell";
import { adminListWebhookEvents, adminRetryWebhookEvent } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/webhook-logs")({
  head: () => ({ meta: [{ title: "Webhook Log — Admin" }, { name: "robots", content: "noindex" }] }),
  component: WebhookLogPage,
});

type Row = {
  id: string;
  provider: string;
  event_type: string | null;
  event_id: string | null;
  intent_id: string | null;
  status_code: number;
  signature_valid: boolean;
  outcome: string;
  error: string | null;
  duration_ms: number | null;
  payload: unknown;
  created_at: string;
};

function WebhookLogPage() {
  const listFn = useServerFn(adminListWebhookEvents);
  const retryFn = useServerFn(adminRetryWebhookEvent);
  const qc = useQueryClient();
  const [provider, setProvider] = useState<string>("");
  const [onlyFailures, setOnlyFailures] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["admin", "webhook-events", provider, onlyFailures],
    queryFn: () => listFn({ data: {
      ...(provider ? { provider } : {}),
      ...(onlyFailures ? { only_failures: true } : {}),
      limit: 150,
    } }),
    refetchInterval: 30_000,
  });
  const rows = (data ?? []) as Row[];

  async function retry(id: string) {
    if (!confirm("Replay this webhook event? This will re-run fulfillment for the linked payment intent.")) return;
    try {
      const r = await retryFn({ data: { id } });
      toast.success(`Retry: ${r.result}`);
      qc.invalidateQueries({ queryKey: ["admin", "webhook-events"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    }
  }

  return (
    <>
      <AdminHeader
        title="Webhook Log"
        description="Every webhook delivery (Stripe / Creem / Whop / ePay) is recorded here with status, signature validity, and outcome. Auto-refreshes every 30s."
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <select value={provider} onChange={(e) => setProvider(e.target.value)}
            className="rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm">
            <option value="">All providers</option>
            <option value="stripe">Stripe</option>
            <option value="creem">Creem</option>
            <option value="whop">Whop</option>
            <option value="epay">ePay</option>
          </select>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={onlyFailures} onChange={(e) => setOnlyFailures(e.target.checked)} />
            Only failures (HTTP ≥ 400)
          </label>
          <button onClick={() => refetch()} disabled={isFetching}
            className="text-sm text-primary hover:underline disabled:opacity-50">
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
          <div className="text-xs text-muted-foreground ml-auto">{rows.length} events</div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">Time</th>
                <th className="text-left px-3 py-2">Provider</th>
                <th className="text-left px-3 py-2">Event</th>
                <th className="text-left px-3 py-2">Outcome</th>
                <th className="text-left px-3 py-2">HTTP</th>
                <th className="text-left px-3 py-2">Sig</th>
                <th className="text-left px-3 py-2">Intent</th>
                <th className="text-left px-3 py-2">ms</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-muted-foreground text-xs">No webhook events yet.</td></tr>
              )}
              {rows.map((r) => {
                const isErr = r.status_code >= 400;
                const isOpen = expanded === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr className="border-t border-border/40 hover:bg-secondary/30">
                      <td className="px-3 py-2 text-muted-foreground text-xs whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 capitalize">{r.provider}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.event_type ?? "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded text-[11px] ${outcomeClass(r.outcome, isErr)}`}>{r.outcome}</span>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        <span className={isErr ? "text-destructive" : "text-success"}>{r.status_code}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">{r.signature_valid ? <span className="text-success">✓</span> : <span className="text-destructive">✗</span>}</td>
                      <td className="px-3 py-2 font-mono text-[11px] truncate max-w-[140px]">{r.intent_id ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{r.duration_ms ?? "—"}</td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <button onClick={() => setExpanded(isOpen ? null : r.id)}
                          className="text-xs text-primary hover:underline">{isOpen ? "Hide" : "Details"}</button>
                        {r.intent_id && (
                          <button onClick={() => retry(r.id)}
                            className="ml-3 text-xs text-primary hover:underline">Retry</button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={r.id + "-d"} className="border-t border-border/40 bg-background/40">
                        <td colSpan={9} className="px-3 py-3 space-y-2">
                          {r.error && (
                            <div className="text-xs text-destructive"><b>Error:</b> {r.error}</div>
                          )}
                          <div className="text-xs text-muted-foreground">Event ID: <code className="font-mono">{r.event_id ?? "—"}</code></div>
                          <pre className="text-[11px] font-mono whitespace-pre-wrap break-all bg-muted/30 rounded p-2 max-h-96 overflow-auto">
{JSON.stringify(r.payload, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-lg border border-border/40 bg-card/30 p-4 text-xs text-muted-foreground space-y-1">
          <p><b>How retries work:</b> 4xx responses tell the provider to stop retrying (bad signature, missing intent). 5xx responses trigger the provider's own retry schedule (Stripe retries for up to 3 days with exponential backoff).</p>
          <p><b>Idempotency:</b> if the same Stripe <code>event.id</code> arrives twice and we already fulfilled it, we ack 200 immediately and log it as <code>duplicate</code>.</p>
          <p><b>Manual retry:</b> only available for events linked to a payment intent. It re-runs fulfillment server-side; if the intent is already paid you'll see <code>already-paid</code>.</p>
        </div>
      </div>
    </>
  );
}

function outcomeClass(outcome: string, isErr: boolean): string {
  if (isErr) return "bg-destructive/15 text-destructive";
  if (outcome === "fulfilled") return "bg-success/15 text-success";
  if (outcome === "already-fulfilled" || outcome === "duplicate") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}
