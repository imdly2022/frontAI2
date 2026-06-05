import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListPayments, adminMarkPaymentPaid } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/payments")({
  head: () => ({ meta: [{ title: "Payments — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PaymentsAdmin,
});

function PaymentsAdmin() {
  const listFn = useServerFn(adminListPayments);
  const markFn = useServerFn(adminMarkPaymentPaid);
  const qc = useQueryClient();
  const [status, setStatus] = useState<"" | "pending" | "paid" | "failed" | "cancelled">("");
  const { data } = useQuery({
    queryKey: ["admin", "payments", status],
    queryFn: () => listFn({ data: status ? { status, limit: 100 } : { limit: 100 } }),
  });

  async function mark(id: string) {
    if (!confirm("Mark this payment as PAID and credit the user?")) return;
    try { await markFn({ data: { id } }); toast.success("Marked paid + user credited"); qc.invalidateQueries({ queryKey: ["admin", "payments"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <>
      <AdminHeader title="Payments" description="Manage payment intents from all providers." />
      <div className="p-8 space-y-4">
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Created</th><th className="text-left px-4 py-2">User</th><th className="text-left px-4 py-2">Provider</th><th className="text-left px-4 py-2">Order</th><th className="text-left px-4 py-2">Amount</th><th className="text-left px-4 py-2">Credits</th><th className="text-left px-4 py-2">Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(p.created_at).toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.newapi_user_id}</td>
                  <td className="px-4 py-2">{p.provider}</td>
                  <td className="px-4 py-2 font-mono text-xs">{p.provider_order_id ?? "—"}</td>
                  <td className="px-4 py-2">${Number(p.amount_usd).toFixed(2)}</td>
                  <td className="px-4 py-2">{Number(p.credits)} {Number(p.bonus_credits) > 0 && <span className="text-success text-xs">+{Number(p.bonus_credits)}</span>}</td>
                  <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded text-xs ${p.status === "paid" ? "bg-success/15 text-success" : p.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>{p.status}</span></td>
                  <td className="px-4 py-2 text-right">
                    {p.status === "pending" && <button onClick={() => mark(p.id)} className="text-primary hover:underline text-xs">Mark paid</button>}
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No payments.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
