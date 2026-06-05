import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminHeader } from "@/components/admin/AdminShell";
import { adminListTransactions } from "@/lib/transactions.functions";
import type { TxKind, UnifiedTx } from "@/lib/transactions.functions";
import { RefreshCw, Search, Download } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: OrdersPage,
});

const KIND_FILTERS: { id: string; label: string; kinds: TxKind[] | null }[] = [
  { id: "all",         label: "All",          kinds: null },
  { id: "topup",       label: "Recharges",    kinds: ["topup"] },
  { id: "commission",  label: "Commissions",  kinds: ["commission_earn", "commission_adjust", "commission_convert"] },
  { id: "withdrawal",  label: "Withdrawals",  kinds: ["withdraw_request", "withdraw_refund", "withdraw_paid"] },
];

const KIND_LABEL: Record<TxKind, { label: string; tone: string }> = {
  topup:               { label: "Recharge",         tone: "bg-emerald-500/15 text-emerald-600" },
  commission_earn:     { label: "Commission",       tone: "bg-emerald-500/15 text-emerald-600" },
  commission_adjust:   { label: "Adjustment",       tone: "bg-yellow-500/15 text-yellow-700" },
  commission_convert:  { label: "Convert",          tone: "bg-blue-500/15 text-blue-600" },
  withdraw_request:    { label: "Withdraw (req)",   tone: "bg-orange-500/15 text-orange-600" },
  withdraw_refund:     { label: "Withdraw refund",  tone: "bg-muted text-muted-foreground" },
  withdraw_paid:       { label: "Withdraw paid",    tone: "bg-violet-500/15 text-violet-600" },
};

function OrdersPage() {
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const fetcher = useServerFn(adminListTransactions);
  const kinds = KIND_FILTERS.find((t) => t.id === tab)?.kinds ?? undefined;

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["admin-tx", tab, q, from, to],
    queryFn: () => fetcher({ data: {
      kinds: kinds ?? undefined,
      q: q || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      limit: 500,
    }}),
    placeholderData: (prev) => prev,
  });
  const rows = (data ?? []) as UnifiedTx[];

  const totals = useMemo(() => {
    let inflow = 0, outflow = 0;
    for (const r of rows) {
      if (r.amount_usd >= 0) inflow += r.amount_usd;
      else outflow += -r.amount_usd;
    }
    return { inflow, outflow };
  }, [rows]);

  function exportCsv() {
    const header = ["created_at","order_no","kind","status","amount_usd","newapi_user_id","affiliate_id","ref","note"];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push([
        r.created_at, r.order_no, r.kind, r.status, r.amount_usd.toFixed(4),
        r.newapi_user_id ?? "", r.affiliate_id ?? "", r.ref ?? "",
        `"${r.note.replace(/"/g, '""')}"`,
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `orders-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <AdminHeader title="Orders" description="Unified view: recharges, commissions, withdrawals. Search by order #, NewAPI user id, provider order id, or note." />
      <div className="p-8 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="surface-card p-4">
            <div className="text-xs text-muted-foreground">Inflow (filtered)</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-600">+${totals.inflow.toFixed(2)}</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-xs text-muted-foreground">Outflow (filtered)</div>
            <div className="mt-1 text-2xl font-semibold text-destructive">-${totals.outflow.toFixed(2)}</div>
          </div>
          <div className="surface-card p-4">
            <div className="text-xs text-muted-foreground">Rows</div>
            <div className="mt-1 text-2xl font-semibold">{rows.length}</div>
          </div>
        </div>

        <div className="surface-card p-4 flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg border border-border/60 bg-secondary/40 p-0.5">
            {KIND_FILTERS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${tab === t.id ? "bg-background text-foreground font-medium" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); setQ(qDraft.trim()); }} className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input value={qDraft} onChange={(e) => setQDraft(e.target.value)}
                placeholder="Order #, user id, note…"
                className="pl-8 pr-3 py-1.5 rounded-md border border-border/60 bg-background text-sm w-64" />
            </div>
          </form>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm" />
            <span className="text-muted-foreground">–</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm" />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground px-2 py-1.5">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 text-sm text-foreground border border-border/60 rounded-md px-2.5 py-1.5 hover:bg-secondary">
              <Download className="h-4 w-4" /> CSV
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
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Ref / Provider</th>
                <th className="text-left px-4 py-3">Note</th>
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
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.order_no}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.tone}`}>{meta.label}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.newapi_user_id ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground truncate max-w-[180px]" title={r.ref ?? ""}>{r.ref ?? "—"}</td>
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
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No orders match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
