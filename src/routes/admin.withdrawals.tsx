import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListWithdrawals, adminProcessWithdrawal } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/withdrawals")({
  head: () => ({ meta: [{ title: "Withdrawals — Admin" }, { name: "robots", content: "noindex" }] }),
  component: WithdrawalsAdmin,
});

function WithdrawalsAdmin() {
  const listFn = useServerFn(adminListWithdrawals);
  const processFn = useServerFn(adminProcessWithdrawal);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "paid" | "rejected">("pending");
  const [active, setActive] = useState<{ id: string; action: "approve" | "reject" | "paid" } | null>(null);
  const [note, setNote] = useState("");

  const { data } = useQuery({
    queryKey: ["admin", "withdrawals", filter],
    queryFn: () => listFn({ data: filter === "all" ? {} : { status: filter } }),
  });

  async function submit() {
    if (!active || note.trim().length < 1) return;
    try {
      await processFn({ data: { id: active.id, action: active.action, admin_note: note.trim() } });
      toast.success("Updated");
      setActive(null); setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "withdrawals"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <>
      <AdminHeader title="Withdrawals" description="Review and process affiliate withdrawal requests." />
      <div className="p-8 space-y-4">
        <div className="flex gap-2">
          {(["all","pending","approved","paid","rejected"] as const).map((s) => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-sm ${filter === s ? "bg-primary text-primary-foreground" : "border border-border/60 hover:bg-secondary"}`}>
              {s}
            </button>
          ))}
        </div>

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Affiliate</th>
                <th className="text-right px-4 py-2">Amount</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Contact info</th>
                <th className="text-left px-4 py-2">Admin note</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((w) => {
                const aff = (w as { affiliates?: { slug?: string; display_name?: string; newapi_user_id?: number } }).affiliates;
                const canAct = w.status === "pending" || w.status === "approved";
                return (
                  <tr key={w.id} className="border-t border-border/40 align-top">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{new Date(w.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs">{aff?.slug ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{aff?.display_name} · uid {aff?.newapi_user_id}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">${Number(w.amount_usd).toFixed(2)}</td>
                    <td className="px-4 py-2"><StatusBadge status={w.status} /></td>
                    <td className="px-4 py-2 text-xs max-w-xs whitespace-pre-wrap">{w.contact_note}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs whitespace-pre-wrap">{w.admin_note ?? "—"}</td>
                    <td className="px-4 py-2 text-right space-x-1 whitespace-nowrap">
                      {canAct && <>
                        {w.status === "pending" && (
                          <button onClick={() => { setActive({ id: w.id, action: "approve" }); setNote(""); }}
                            className="text-xs px-2 py-1 rounded border border-border/60 hover:bg-secondary">Approve</button>
                        )}
                        <button onClick={() => { setActive({ id: w.id, action: "paid" }); setNote(""); }}
                          className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90">Mark paid</button>
                        <button onClick={() => { setActive({ id: w.id, action: "reject" }); setNote(""); }}
                          className="text-xs px-2 py-1 rounded border border-border/60 text-destructive hover:bg-destructive/10">Reject</button>
                      </>}
                    </td>
                  </tr>
                );
              })}
              {!data?.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground italic">No withdrawal requests.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {active && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setActive(null)}>
          <div className="bg-card rounded-lg border border-border/60 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2 capitalize">{active.action} withdrawal</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {active.action === "reject" && "Funds will be returned to the affiliate's available balance."}
              {active.action === "paid" && "This finalizes the payout. Balance was already deducted at request time."}
              {active.action === "approve" && "Marks as approved (no balance change). Use 'Mark paid' once funds are sent."}
            </p>
            <label className="block text-sm mb-3">
              <span className="text-muted-foreground">Admin note (required) — e.g. transaction reference</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setActive(null)} className="rounded-md border border-border/60 px-4 py-2 text-sm">Cancel</button>
              <button disabled={note.trim().length < 1} onClick={submit}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-600",
    approved: "bg-blue-500/15 text-blue-600",
    paid: "bg-emerald-500/15 text-emerald-600",
    rejected: "bg-destructive/15 text-destructive",
  };
  return <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-muted"}`}>{status}</span>;
}
