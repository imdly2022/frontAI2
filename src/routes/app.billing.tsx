import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPricingPlans, getSiteSettings } from "@/lib/cms.functions";
import { billingOverview } from "@/lib/billing.functions";
import { myTransactions, type UnifiedTx, type TxKind } from "@/lib/transactions.functions";
import { Wallet, RefreshCw, BarChart3 } from "lucide-react";
import type { PlanRow } from "@/lib/cms-types";

export const Route = createFileRoute("/app/billing")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["plans"], queryFn: () => getPricingPlans() }),
      context.queryClient.ensureQueryData({ queryKey: ["billing-overview"], queryFn: () => billingOverview() }),
      context.queryClient.ensureQueryData({ queryKey: ["site-settings"], queryFn: () => getSiteSettings() }),
    ]),
  component: BillingPage,
});

type Provider = "alipay" | "wechat" | "usdt" | "stripe" | "creem" | "whop";
const PROVIDER_LABEL: Record<Provider, { label: string; sub: string }> = {
  alipay: { label: "Alipay", sub: "支付宝" },
  wechat: { label: "WeChat Pay", sub: "微信支付" },
  usdt: { label: "USDT", sub: "TRC20" },
  stripe: { label: "Stripe", sub: "Card · Wallets · Bank" },
  creem: { label: "Card / Global", sub: "Creem" },
  whop: { label: "Whop Checkout", sub: "Whop" },
};

function BillingPage() {
  const plansFn = useServerFn(getPricingPlans);
  const overviewFn = useServerFn(billingOverview);
  const settingsFn = useServerFn(getSiteSettings);
  const qc = useQueryClient();

  const { data: plansData } = useQuery({ queryKey: ["plans"], queryFn: () => plansFn() }) as { data: PlanRow[] | undefined };
  const plans: PlanRow[] = plansData ?? [];
  const { data: overview, refetch } = useQuery({ queryKey: ["billing-overview"], queryFn: () => overviewFn() });
  const { data: settings } = useQuery({ queryKey: ["site-settings"], queryFn: () => settingsFn() });

  const pay = (settings as { payments?: {
    epay?: { enabled?: boolean; enabled_types?: string[] };
    creem?: { enabled?: boolean };
    whop?: { enabled?: boolean };
    stripe?: { enabled?: boolean };
  } } | undefined)?.payments;
  const enabledTypes: string[] = pay?.epay?.enabled_types ?? ["alipay", "wechat"];
  const epayEnabled = pay?.epay?.enabled === true;
  const stripeNative = pay?.stripe?.enabled === true;
  const typeMap: Record<string, Provider> = { alipay: "alipay", wxpay: "wechat", wechat: "wechat", usdt: "usdt", stripe: "stripe" };
  const epayProviders: Provider[] = epayEnabled
    ? (Array.from(new Set(enabledTypes.map((t) => typeMap[t]).filter(Boolean))) as Provider[])
        // If native Stripe is enabled, prefer it over the epay "stripe" channel.
        .filter((p) => !(stripeNative && p === "stripe"))
    : [];
  const availableProviders: Provider[] = [
    ...epayProviders,
    ...(stripeNative ? (["stripe"] as Provider[]) : []),
    ...(pay?.creem?.enabled ? (["creem"] as Provider[]) : []),
    ...(pay?.whop?.enabled ? (["whop"] as Provider[]) : []),
  ];

  const [selected, setSelected] = useState<PlanRow | null>(null);
  const [method, setMethod] = useState<Provider | null>(null);
  useEffect(() => {
    if (availableProviders.length === 0) { if (method !== null) setMethod(null); return; }
    if (!method || !availableProviders.includes(method)) setMethod(availableProviders[0]);
  }, [availableProviders.join(","), method]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  // After provider redirect (?paid=<intent_id>), poll our verify endpoint a
  // few times. Fallback for when the webhook hasn't arrived yet.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const intentId = url.searchParams.get("paid");
    if (!intentId) return;
    let cancelled = false;
    setVerifyMsg("Confirming your payment…");
    (async () => {
      for (let i = 0; i < 8 && !cancelled; i++) {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ intent_id: intentId }),
          });
          const j = await res.json() as { status?: string; error?: string };
          if (!res.ok) {
            setVerifyMsg(j.error ? `Payment paid, but crediting failed: ${j.error}` : "Payment paid, but crediting failed. Please contact support.");
            return;
          }
          if (j.status === "paid") {
            setVerifyMsg("Payment confirmed — credits added.");
            qc.invalidateQueries({ queryKey: ["billing-overview"] });
            qc.invalidateQueries({ queryKey: ["my-tx"] });
            url.searchParams.delete("paid");
            window.history.replaceState({}, "", url.toString());
            return;
          }
        } catch { /* keep polling */ }
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setVerifyMsg("Still processing — refresh in a moment if the balance hasn't updated.");
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function startCheckout() {
    if (!selected || !method) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: selected.id, provider: method }),
      });
      const json = await res.json() as { pay_url?: string; error?: string };
      if (!res.ok || !json.pay_url) throw new Error(json.error ?? "Payment provider unavailable");
      window.location.href = json.pay_url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-8">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-emerald-500/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-emerald-500/20 blur-3xl" aria-hidden />
        <div className="absolute -left-10 bottom-0 h-40 w-40 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-emerald-500/90">
              <Wallet className="h-3.5 w-3.5" /> Billing
            </div>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">Top up your account</h1>
            <p className="text-sm text-muted-foreground mt-1">Credits never expire. Pick a pack and pay your way.</p>
          </div>
          <button onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ["billing-overview"] }); }}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </header>

      {/* Balance + KPIs */}
      <div className="grid gap-4 sm:grid-cols-3 mb-10">
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Wallet className="h-3.5 w-3.5" /> Current balance
          </div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">${(overview?.balance_usd ?? 0).toFixed(4)}</div>
        </div>
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total spent</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">${(overview?.used_usd ?? 0).toFixed(4)}</div>
        </div>
        <div className="surface-card p-6">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Requests</div>
          <div className="mt-2 text-3xl font-semibold tracking-tight">{(overview?.request_count ?? 0).toLocaleString()}</div>
        </div>
      </div>

      <section className="mb-10">
        <h2 className="text-sm font-medium mb-3 text-muted-foreground">1. Pick a credit pack</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const active = selected?.id === p.id;
            return (
              <button key={p.id} onClick={() => setSelected(p)}
                className={`text-left rounded-2xl border bg-card p-5 transition-all ${active ? "border-primary shadow-[var(--shadow-glow)]" : "border-border/60 hover:border-border hover:-translate-y-0.5"}`}>
                <div className="font-medium">{p.name}</div>
                <div className="mt-2 text-2xl font-semibold tracking-tight">${Number(p.price_usd)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {Number(p.credits)} credits{Number(p.bonus_credits) > 0 && ` + ${Number(p.bonus_credits)} bonus`}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selected && availableProviders.length > 0 && (
        <section className="mb-10">
          <h2 className="text-sm font-medium mb-3 text-muted-foreground">2. Choose payment method</h2>
          <div className="grid gap-2 sm:grid-cols-4">
            {availableProviders.map((id) => (
              <button key={id} onClick={() => setMethod(id)}
                className={`rounded-2xl border bg-card p-4 text-left transition-all ${method === id ? "border-primary shadow-[var(--shadow-glow)]" : "border-border/60 hover:border-border"}`}>
                <div className="font-medium">{PROVIDER_LABEL[id].label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{PROVIDER_LABEL[id].sub}</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {verifyMsg && (
        <div className="mb-4 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm text-emerald-600">{verifyMsg}</div>
      )}
      {error && <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>}

      {availableProviders.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          Payments are not enabled yet. Ask an administrator to configure a provider in Admin → Site &amp; SEO → <code className="font-mono">payments</code>.
        </div>
      ) : (
        <button disabled={!selected || !method || loading} onClick={startCheckout}
          className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
          {loading ? "Redirecting…" : selected ? "Pay now" : "Select a pack to continue"}
        </button>
      )}

      {/* Unified transactions */}
      <TransactionsSection />
    </div>
  );
}

const TAB_DEFS: { id: string; label: string; kinds: TxKind[] | null }[] = [
  { id: "all",         label: "All",          kinds: null },
  { id: "topup",       label: "Recharges",    kinds: ["topup"] },
  { id: "commission",  label: "Commissions",  kinds: ["commission_earn", "commission_adjust", "commission_convert"] },
  { id: "withdrawal",  label: "Withdrawals",  kinds: ["withdraw_request", "withdraw_refund", "withdraw_paid"] },
];

const KIND_LABEL: Record<TxKind, { label: string; tone: string }> = {
  topup:               { label: "Recharge",         tone: "bg-emerald-500/15 text-emerald-600" },
  commission_earn:     { label: "Commission earn",  tone: "bg-emerald-500/15 text-emerald-600" },
  commission_adjust:   { label: "Adjustment",       tone: "bg-yellow-500/15 text-yellow-700" },
  commission_convert:  { label: "Convert→Balance",  tone: "bg-blue-500/15 text-blue-600" },
  withdraw_request:    { label: "Withdraw (held)",  tone: "bg-orange-500/15 text-orange-600" },
  withdraw_refund:     { label: "Withdraw refund",  tone: "bg-muted text-muted-foreground" },
  withdraw_paid:       { label: "Withdraw paid",    tone: "bg-violet-500/15 text-violet-600" },
};

function TransactionsSection() {
  const [tab, setTab] = useState("all");
  const fetcher = useServerFn(myTransactions);
  const kinds = TAB_DEFS.find((t) => t.id === tab)?.kinds ?? undefined;
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["my-tx", tab],
    queryFn: () => fetcher({ data: { kinds: kinds ?? undefined, limit: 200 } }),
    placeholderData: (prev) => prev,
  });
  const rows = (data ?? []) as UnifiedTx[];

  return (
    <section className="mt-14">
      <div className="flex items-end justify-between mb-3 gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-medium text-muted-foreground">Transaction history</h2>
          <p className="text-xs text-muted-foreground/70 mt-0.5">
            Every recharge, commission and withdrawal carries an internal order number. For API usage details, see{" "}
            <Link to="/app/usage" className="text-primary inline-flex items-center gap-1 hover:underline">
              <BarChart3 className="h-3 w-3" /> Usage
            </Link>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
            {TAB_DEFS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === t.id ? "bg-secondary text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <button onClick={() => refetch()} className="text-muted-foreground hover:text-foreground p-1.5">
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="surface-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Date</th>
              <th className="text-left px-4 py-3">Order #</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Detail</th>
              <th className="text-right px-4 py-3">Amount</th>
              <th className="text-left px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const meta = KIND_LABEL[r.kind];
              const positive = r.amount_usd >= 0;
              return (
                <tr key={r.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.order_no}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-md truncate" title={r.note}>{r.note}</td>
                  <td className={`px-4 py-3 text-right font-mono ${positive ? "text-foreground" : "text-destructive"}`}>
                    {positive ? "+" : ""}${r.amount_usd.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                      r.status === "paid" || r.status === "posted" ? "bg-success/15 text-success"
                        : r.status === "pending" ? "bg-yellow-500/15 text-yellow-700"
                        : r.status === "rejected" ? "bg-destructive/15 text-destructive"
                        : "bg-muted text-muted-foreground"
                    }`}>{r.status}</span>
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No transactions yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
