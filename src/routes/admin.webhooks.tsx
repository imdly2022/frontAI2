import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { adminWebhookHealth } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/webhooks")({
  head: () => ({ meta: [{ title: "Webhook Health — Admin" }, { name: "robots", content: "noindex" }] }),
  component: WebhookHealthPage,
});

function WebhookHealthPage() {
  const fn = useServerFn(adminWebhookHealth);
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin", "webhook-health"],
    queryFn: () => fn({}),
    refetchInterval: 30_000,
  });

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);

  function copy(text: string) {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copied"),
      () => toast.error("Copy failed"),
    );
  }

  return (
    <>
      <AdminHeader
        title="Webhook Health"
        description="Webhook URLs for each provider plus the most recent payment intent processed. Auto-refreshes every 30s."
      />
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Paste the URL below into each provider's webhook settings. The "Latest intent" column shows the most recent payment we recorded for that provider — if a checkout succeeded but it stays in <code className="text-xs">pending</code>, your webhook is not reaching us.
          </p>
          <button
            onClick={() => refetch()}
            className="text-sm text-primary hover:underline disabled:opacity-50"
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        <div className="space-y-4">
          {(data?.providers ?? []).map((p) => {
            const url = origin + p.webhook_path;
            const lastIntent = p.latest_intent;
            const lastPaidAgo = p.latest_paid_at ? timeAgo(p.latest_paid_at) : "never";
            return (
              <div key={p.provider} className="rounded-lg border border-border/60 bg-card/40 p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold capitalize">{p.provider}</h3>
                      <Badge ok={p.enabled} label={p.enabled ? "Enabled" : "Disabled"} />
                      <Badge ok={p.configured} label={p.configured ? "Configured" : "Missing keys"} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last successful payment: <span className="font-medium text-foreground">{lastPaidAgo}</span>
                      {" · "}Paid (24h): <span className="font-medium text-foreground">{p.paid_count_24h}</span>
                      {" · "}Pending (24h): <span className="font-medium text-foreground">{p.pending_count_24h}</span>
                    </p>
                  </div>
                </div>

                <WebhookUrlRow url={url} onCopy={() => copy(url)} />

                <div className="text-xs">
                  <div className="text-muted-foreground mb-1">Latest payment intent</div>
                  {lastIntent ? (
                    <div className="rounded-md border border-border/40 bg-background/40 p-3 grid grid-cols-2 md:grid-cols-5 gap-3">
                      <Field label="Order" value={lastIntent.order_no} mono />
                      <Field label="Status" value={<StatusPill status={lastIntent.status} />} />
                      <Field label="Amount" value={`$${lastIntent.amount_usd.toFixed(2)}`} />
                      <Field label="Provider order" value={lastIntent.provider_order_id ?? "—"} mono />
                      <Field label="Created" value={new Date(lastIntent.created_at).toLocaleString()} />
                    </div>
                  ) : (
                    <div className="text-muted-foreground italic">No payment intents yet for this provider.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <HealthHints />
      </div>
    </>
  );
}

function WebhookUrlRow({ url, onCopy }: { url: string; onCopy: () => void }) {
  const [reachable, setReachable] = useState<null | "ok" | "fail" | "checking">(null);
  async function check() {
    setReachable("checking");
    try {
      // Webhooks reject GET with !=success, but a 4xx response still means
      // the route is reachable. Any HTTP response counts as reachable.
      const res = await fetch(url, { method: "GET" });
      setReachable(res.status >= 200 && res.status < 600 ? "ok" : "fail");
    } catch {
      setReachable("fail");
    }
  }
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 truncate rounded-md border border-border/40 bg-background/40 px-3 py-2 text-xs font-mono">
        {url}
      </code>
      <button onClick={onCopy} className="rounded-md border border-border/40 px-3 py-2 text-xs hover:bg-secondary inline-flex items-center gap-1">
        <Copy className="h-3 w-3" /> Copy
      </button>
      <button onClick={check} className="rounded-md border border-border/40 px-3 py-2 text-xs hover:bg-secondary">
        {reachable === "checking" ? "Checking…" : "Ping"}
      </button>
      {reachable === "ok" && <span className="text-success text-xs inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Reachable</span>}
      {reachable === "fail" && <span className="text-destructive text-xs inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> Unreachable</span>}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`px-2 py-0.5 rounded text-[11px] ${ok ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
      {label}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === "paid" ? "bg-success/15 text-success"
    : status === "failed" ? "bg-destructive/15 text-destructive"
    : "bg-muted text-muted-foreground";
  return <span className={`px-2 py-0.5 rounded text-[11px] ${cls}`}>{status}</span>;
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</div>
    </div>
  );
}

function HealthHints() {
  return (
    <div className="rounded-lg border border-border/40 bg-card/30 p-4 text-xs text-muted-foreground">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p>If the latest intent stays <code>pending</code> after a successful checkout, the provider isn't calling our webhook — verify the URL in the provider dashboard and that the webhook secret matches Site &amp; SEO → Payments.</p>
          <p>Use "Ping" to confirm the URL is reachable from your browser. Any HTTP response (including 4xx) means the route is live.</p>
        </div>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
