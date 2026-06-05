import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plus, Trash2, ArrowRightLeft, BanknoteArrowDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { listMyPostbacks, upsertMyPostback, deleteMyPostback } from "@/lib/affiliate.postbacks.functions";
import { myCommissionSummary, convertCommissionToBalance, requestWithdrawal } from "@/lib/commissions.functions";

type Postback = {
  id: string;
  url_template: string;
  events: string[];
  is_enabled: boolean;
  last_status: number | null;
  last_fired_at: string | null;
  fire_count: number;
};

export const Route = createFileRoute("/app/referrals")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData({ queryKey: ["my-postbacks"], queryFn: () => listMyPostbacks() }),
      context.queryClient.ensureQueryData({ queryKey: ["my-commission"], queryFn: () => myCommissionSummary() }),
    ]),
  component: ReferralsPage,
});

const ALL_EVENTS = ["signup", "sale", "first_topup"] as const;

function ReferralsPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listMyPostbacks);
  const upsertFn = useServerFn(upsertMyPostback);
  const delFn = useServerFn(deleteMyPostback);
  const summaryFn = useServerFn(myCommissionSummary);
  const convertFn = useServerFn(convertCommissionToBalance);
  const withdrawFn = useServerFn(requestWithdrawal);

  const { data: pb } = useSuspenseQuery({ queryKey: ["my-postbacks"], queryFn: () => listFn() });
  const { data: cs } = useSuspenseQuery({ queryKey: ["my-commission"], queryFn: () => summaryFn() });

  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<Partial<Postback> | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [convertAmt, setConvertAmt] = useState("");
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [withdrawContact, setWithdrawContact] = useState("");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const aff = pb.affiliate.slug;
  const link = `${origin}/?ref=${aff}`;

  const save = useMutation({
    mutationFn: (v: Partial<Postback>) => upsertFn({ data: {
      id: v.id,
      url_template: v.url_template ?? "",
      events: (v.events ?? ["sale"]) as ("signup"|"sale"|"first_topup")[],
      is_enabled: v.is_enabled ?? true,
    } }),
    onSuccess: () => { toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["my-postbacks"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["my-postbacks"] }); },
  });
  const convert = useMutation({
    mutationFn: (amount: number) => convertFn({ data: { amount_usd: amount } }),
    onSuccess: () => { toast.success("Converted to balance"); setConvertOpen(false); setConvertAmt(""); qc.invalidateQueries({ queryKey: ["my-commission"] }); },
    onError: (e) => toast.error((e as Error).message),
  });
  const withdraw = useMutation({
    mutationFn: (v: { amount: number; contact: string }) => withdrawFn({ data: { amount_usd: v.amount, contact_note: v.contact } }),
    onSuccess: () => { toast.success("Withdrawal requested — admin will contact you"); setWithdrawOpen(false); setWithdrawAmt(""); setWithdrawContact(""); qc.invalidateQueries({ queryKey: ["my-commission"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const available = cs.affiliate.available_balance_usd;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Referrals & Affiliate</h1>
        <p className="text-sm text-muted-foreground mt-1">Earn {(cs.affiliate.commission_rate * 100).toFixed(0)}% commission on every dollar your referrals spend.</p>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/40 p-6 mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Your link</div>
        <div className="flex gap-2">
          <input readOnly value={link} className="flex-1 rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-mono" />
          <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Append <code className="font-mono">&amp;sub1=...&amp;sub2=...</code> through <code className="font-mono">sub5</code> to track sub-sources.
        </p>
      </section>

      {/* Balance + actions */}
      <section className="grid gap-4 sm:grid-cols-3 mb-4">
        <Stat label="Available balance" value={`$${available.toFixed(2)}`} highlight />
        <Stat label="Lifetime earnings" value={`$${cs.affiliate.total_earnings_usd.toFixed(2)}`} />
        <Stat label="Total paid out" value={`$${cs.affiliate.total_paid_usd.toFixed(2)}`} />
      </section>

      <div className="flex gap-2 mb-8">
        <button onClick={() => setConvertOpen(true)} disabled={available <= 0}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <ArrowRightLeft className="h-4 w-4" /> Convert to balance
        </button>
        <button onClick={() => setWithdrawOpen(true)} disabled={available <= 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-4 py-2 text-sm font-medium hover:bg-secondary disabled:opacity-50">
          <BanknoteArrowDown className="h-4 w-4" /> Withdraw
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Stat label="Total referrals" value={(pb.stats?.signups ?? 0).toString()} />
        <Stat label="Paid conversions" value={(pb.stats?.sales ?? 0).toString()} />
        <Stat label="Pending withdrawals" value={cs.withdrawals.filter((w) => w.status === "pending" || w.status === "approved").length.toString()} />
      </div>

      {/* Ledger */}
      <section className="mb-10 rounded-xl border border-border/60 bg-card/40">
        <div className="px-6 py-4 border-b border-border/60">
          <h2 className="text-sm font-medium">Commission ledger</h2>
          <p className="text-xs text-muted-foreground mt-1">Every credit, conversion, and withdrawal — fully auditable.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Type</th><th className="text-right px-4 py-2">Amount</th><th className="text-right px-4 py-2">Balance after</th><th className="text-left px-4 py-2">Note</th></tr>
            </thead>
            <tbody>
              {cs.ledger.map((l) => (
                <tr key={l.id} className="border-t border-border/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.type}</td>
                  <td className={`px-4 py-2 text-right tabular-nums ${Number(l.amount_usd) >= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                    {Number(l.amount_usd) >= 0 ? "+" : ""}${Number(l.amount_usd).toFixed(4)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">${Number(l.balance_after).toFixed(2)}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground max-w-md truncate" title={l.note}>{l.note}</td>
                </tr>
              ))}
              {!cs.ledger.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground italic">No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      {/* Postbacks */}
      <section className="rounded-xl border border-border/60 bg-card/40 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium">Postback URLs (S2S)</h2>
          <button onClick={() => setEditing({ url_template: "", events: ["sale"], is_enabled: true })}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> Add postback
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          We GET your URL on each conversion, substituting <code className="font-mono">{`{click_id} {sub1..5} {amount} {commission} {event} {transaction_id} {newapi_user_id}`}</code>.
        </p>

        <div className="space-y-2">
          {pb.postbacks.length === 0 && <div className="text-sm text-muted-foreground italic">No postbacks yet.</div>}
          {pb.postbacks.map((p: Postback) => (
            <div key={p.id} className="rounded-md border border-border/60 bg-background/40 p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs truncate">{p.url_template}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Events: {p.events.join(", ")} · {p.is_enabled ? "Enabled" : "Disabled"} · Fired {p.fire_count}× · Last: {p.last_status ?? "—"}
                </div>
              </div>
              <button onClick={() => setEditing(p)} className="text-primary text-sm hover:underline">Edit</button>
              <button onClick={() => { if (confirm("Delete this postback?")) remove.mutate(p.id); }}
                className="text-muted-foreground hover:text-destructive p-1">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {editing && (
          <form onSubmit={(e) => { e.preventDefault(); save.mutate(editing); }}
            className="mt-4 rounded-md border border-border/60 bg-background/40 p-4 space-y-3">
            <label className="block text-sm">
              <span className="text-muted-foreground">Postback URL template</span>
              <input required type="url" value={editing.url_template ?? ""}
                onChange={(e) => setEditing({ ...editing, url_template: e.target.value })}
                placeholder="https://tracker.example.com/postback?cid={click_id}&amount={amount}"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono" />
            </label>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Fire on events</div>
              <div className="flex flex-wrap gap-3">
                {ALL_EVENTS.map((ev) => (
                  <label key={ev} className="text-sm flex items-center gap-1.5">
                    <input type="checkbox" checked={(editing.events ?? []).includes(ev)}
                      onChange={(e) => {
                        const set = new Set(editing.events ?? []);
                        if (e.target.checked) set.add(ev); else set.delete(ev);
                        setEditing({ ...editing, events: Array.from(set) });
                      }} />
                    {ev}
                  </label>
                ))}
              </div>
            </div>
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={editing.is_enabled ?? true}
                onChange={(e) => setEditing({ ...editing, is_enabled: e.target.checked })} />
              Enabled
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={save.isPending}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
                {save.isPending ? "Saving…" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(null)}
                className="rounded-md border border-border/60 px-4 py-2 text-sm">Cancel</button>
            </div>
          </form>
        )}
      </section>

      {/* Convert dialog */}
      {convertOpen && (
        <Modal onClose={() => setConvertOpen(false)} title="Convert commission to API balance">
          <p className="text-sm text-muted-foreground mb-3">
            Move funds from your commission balance into your NewAPI quota. Available: <strong>${available.toFixed(2)}</strong>
          </p>
          <label className="block text-sm mb-3">
            <span className="text-muted-foreground">Amount (USD)</span>
            <input type="number" step="0.01" min="0.01" max={available} value={convertAmt}
              onChange={(e) => setConvertAmt(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setConvertOpen(false)} className="rounded-md border border-border/60 px-4 py-2 text-sm">Cancel</button>
            <button disabled={convert.isPending || !Number(convertAmt)}
              onClick={() => convert.mutate(Number(convertAmt))}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {convert.isPending ? "Converting…" : "Convert"}
            </button>
          </div>
        </Modal>
      )}

      {/* Withdraw dialog */}
      {withdrawOpen && (
        <Modal onClose={() => setWithdrawOpen(false)} title="Request withdrawal">
          <p className="text-sm text-muted-foreground mb-3">
            Withdrawals are processed manually — <strong>please contact admin</strong> after submitting.
            Provide your preferred payout method (PayPal / USDT / etc.) in the note.
          </p>
          <label className="block text-sm mb-3">
            <span className="text-muted-foreground">Amount (USD). Available: ${available.toFixed(2)}</span>
            <input type="number" step="0.01" min="0.01" max={available} value={withdrawAmt}
              onChange={(e) => setWithdrawAmt(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <label className="block text-sm mb-3">
            <span className="text-muted-foreground">Payout method & contact info</span>
            <textarea value={withdrawContact} onChange={(e) => setWithdrawContact(e.target.value)}
              placeholder="e.g. PayPal: you@example.com / USDT-TRC20: T..."
              rows={4}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
          </label>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setWithdrawOpen(false)} className="rounded-md border border-border/60 px-4 py-2 text-sm">Cancel</button>
            <button disabled={withdraw.isPending || !Number(withdrawAmt) || withdrawContact.trim().length < 3}
              onClick={() => withdraw.mutate({ amount: Number(withdrawAmt), contact: withdrawContact.trim() })}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {withdraw.isPending ? "Submitting…" : "Submit request"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-5 ${highlight ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card/40"}`}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function Modal({ children, title, onClose }: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border/60 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}
