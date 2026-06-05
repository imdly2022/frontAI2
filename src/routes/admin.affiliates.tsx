import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListAffiliates, adminUpdateAffiliate,
  adminListConversions, adminAdjustConversion, adminGetAffiliateLedger,
  adminListReferredUsers,
} from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/affiliates")({
  head: () => ({ meta: [{ title: "Affiliates — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AffiliatesAdmin,
});

type Affiliate = {
  id: string; slug: string; display_name: string | null; newapi_user_id: number;
  commission_rate: number; total_earnings: number; total_paid: number;
  available_balance_usd: number; pending_balance_usd: number;
  status: "active" | "paused" | "banned";
};

function AffiliatesAdmin() {
  const listFn = useServerFn(adminListAffiliates);
  const updFn = useServerFn(adminUpdateAffiliate);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "affiliates"], queryFn: () => listFn() });
  const [selected, setSelected] = useState<Affiliate | null>(null);

  async function update(id: string, patch: { commission_rate?: number; status?: "active" | "paused" | "banned" }) {
    try { await updFn({ data: { id, ...patch } }); toast.success("Updated"); qc.invalidateQueries({ queryKey: ["admin", "affiliates"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Update failed"); }
  }

  return (
    <>
      <AdminHeader title="Affiliates" description="Manage affiliate accounts, balances, and conversion adjustments." />
      <div className="p-8">
        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-left px-4 py-2">Display</th>
                <th className="text-left px-4 py-2">User ID</th>
                <th className="text-left px-4 py-2">Rate</th>
                <th className="text-right px-4 py-2">Available</th>
                <th className="text-right px-4 py-2">Lifetime</th>
                <th className="text-right px-4 py-2">Paid out</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {((data ?? []) as Affiliate[]).map((a) => (
                <tr key={a.id} className="border-t border-border/40">
                  <td className="px-4 py-2 font-mono text-xs">{a.slug}</td>
                  <td className="px-4 py-2">{a.display_name ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{a.newapi_user_id}</td>
                  <td className="px-4 py-2">
                    <input type="number" step="0.01" min={0} max={1} defaultValue={Number(a.commission_rate)} onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== Number(a.commission_rate)) update(a.id, { commission_rate: v });
                    }} className="w-20 rounded border border-input bg-background/50 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">${Number(a.available_balance_usd).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${Number(a.total_earnings).toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">${Number(a.total_paid).toFixed(2)}</td>
                  <td className="px-4 py-2">
                    <select defaultValue={a.status} onChange={(e) => update(a.id, { status: e.target.value as Affiliate["status"] })}
                      className="rounded border border-input bg-background/50 px-2 py-1 text-sm">
                      <option value="active">active</option>
                      <option value="paused">paused</option>
                      <option value="banned">banned</option>
                    </select>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setSelected(a)} className="text-xs text-primary hover:underline">View / Adjust</button>
                  </td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No affiliates yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <AffiliateDrawer affiliate={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function AffiliateDrawer({ affiliate, onClose }: { affiliate: Affiliate; onClose: () => void }) {
  const convFn = useServerFn(adminListConversions);
  const ledFn = useServerFn(adminGetAffiliateLedger);
  const refFn = useServerFn(adminListReferredUsers);
  const adjustFn = useServerFn(adminAdjustConversion);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"conversions" | "ledger" | "referred">("conversions");

  const conv = useQuery({
    queryKey: ["admin", "conv", affiliate.id],
    queryFn: () => convFn({ data: { affiliate_id: affiliate.id, limit: 100 } }),
  });
  const led = useQuery({
    queryKey: ["admin", "ledger", affiliate.id],
    queryFn: () => ledFn({ data: { affiliate_id: affiliate.id, limit: 200 } }),
    enabled: tab === "ledger",
  });
  const referred = useQuery({
    queryKey: ["admin", "referred", affiliate.id],
    queryFn: () => refFn({ data: { affiliate_id: affiliate.id, limit: 500 } }),
    enabled: tab === "referred",
  });

  const [adjusting, setAdjusting] = useState<{ id: string; commission_usd: number; status: string } | null>(null);
  const [newAmt, setNewAmt] = useState("");
  const [newStatus, setNewStatus] = useState<"pending"|"approved"|"rejected">("approved");
  const [note, setNote] = useState("");

  async function submitAdjust() {
    if (!adjusting || note.trim().length < 1) return;
    try {
      await adjustFn({ data: { id: adjusting.id, new_commission_usd: Number(newAmt), new_status: newStatus, note: note.trim() } });
      toast.success("Adjusted");
      setAdjusting(null); setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "conv", affiliate.id] });
      qc.invalidateQueries({ queryKey: ["admin", "ledger", affiliate.id] });
      qc.invalidateQueries({ queryKey: ["admin", "affiliates"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card rounded-lg border border-border/60 w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border/60">
          <h3 className="text-lg font-semibold">{affiliate.slug} <span className="text-sm text-muted-foreground font-normal">· uid {affiliate.newapi_user_id}</span></h3>
          <div className="text-sm text-muted-foreground">Available ${Number(affiliate.available_balance_usd).toFixed(2)} · Lifetime ${Number(affiliate.total_earnings).toFixed(2)} · Paid ${Number(affiliate.total_paid).toFixed(2)}</div>
        </div>
        <div className="px-6 pt-3 flex gap-2 border-b border-border/60">
          {(["conversions","ledger","referred"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {t === "conversions" ? "Conversions" : t === "ledger" ? "Ledger" : "Referred users"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {tab === "conversions" && (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Event</th><th className="text-right px-3 py-2">Sale</th><th className="text-right px-3 py-2">Commission</th><th className="text-left px-3 py-2">Status</th><th className="text-left px-3 py-2">Note</th><th></th></tr>
              </thead>
              <tbody>
                {(conv.data?.rows ?? []).map((c) => (
                  <tr key={c.id} className="border-t border-border/40">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.event}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${Number(c.amount_usd).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${Number(c.commission_usd).toFixed(4)}</td>
                    <td className="px-3 py-2"><span className="text-xs font-mono">{c.status}</span></td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate" title={c.note ?? ""}>{c.note ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => {
                        setAdjusting({ id: c.id, commission_usd: Number(c.commission_usd), status: c.status });
                        setNewAmt(String(c.commission_usd));
                        setNewStatus(c.status as "pending"|"approved"|"rejected");
                        setNote("");
                      }} className="text-xs text-primary hover:underline">Adjust</button>
                    </td>
                  </tr>
                ))}
                {!conv.data?.rows?.length && <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground italic">No conversions.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "ledger" && (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr><th className="text-left px-3 py-2">Date</th><th className="text-left px-3 py-2">Type</th><th className="text-right px-3 py-2">Amount</th><th className="text-right px-3 py-2">Balance after</th><th className="text-left px-3 py-2">Note</th></tr>
              </thead>
              <tbody>
                {(led.data ?? []).map((l) => (
                  <tr key={l.id} className="border-t border-border/40">
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{l.type}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${Number(l.amount_usd) >= 0 ? "text-emerald-500" : "text-amber-500"}`}>
                      {Number(l.amount_usd) >= 0 ? "+" : ""}${Number(l.amount_usd).toFixed(4)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">${Number(l.balance_after).toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-md truncate" title={l.note}>{l.note}</td>
                  </tr>
                ))}
                {!led.data?.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground italic">No entries.</td></tr>}
              </tbody>
            </table>
          )}
          {tab === "referred" && (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-3 py-2">User</th>
                  <th className="text-left px-3 py-2">NewAPI ID</th>
                  <th className="text-left px-3 py-2">Registered</th>
                  <th className="text-left px-3 py-2">Last login</th>
                  <th className="text-right px-3 py-2">Lifetime spend</th>
                </tr>
              </thead>
              <tbody>
                {(referred.data ?? []).map((u) => (
                  <tr key={u.id} className="border-t border-border/40">
                    <td className="px-3 py-2">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{u.newapi_user_id}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">${Number(u.lifetime_spend_usd).toFixed(2)}</td>
                  </tr>
                ))}
                {!referred.data?.length && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground italic">No referred users.</td></tr>}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-border/60 flex justify-end">
          <button onClick={onClose} className="rounded-md border border-border/60 px-4 py-2 text-sm">Close</button>
        </div>
      </div>

      {adjusting && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setAdjusting(null)}>
          <div className="bg-card rounded-lg border border-border/60 p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-3">Adjust conversion</h3>
            <p className="text-xs text-muted-foreground mb-3">Current: ${adjusting.commission_usd.toFixed(4)} · {adjusting.status}</p>
            <label className="block text-sm mb-2">
              <span className="text-muted-foreground">New commission (USD)</span>
              <input type="number" step="0.0001" min="0" value={newAmt} onChange={(e) => setNewAmt(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <label className="block text-sm mb-2">
              <span className="text-muted-foreground">Status</span>
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value as "pending"|"approved"|"rejected")}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                <option value="pending">pending</option>
                <option value="approved">approved</option>
                <option value="rejected">rejected (invalid order)</option>
              </select>
            </label>
            <label className="block text-sm mb-3">
              <span className="text-muted-foreground">Reason / note (required)</span>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3}
                placeholder="e.g. Chargeback / refund / invalid order / withdrawal-related"
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </label>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setAdjusting(null)} className="rounded-md border border-border/60 px-4 py-2 text-sm">Cancel</button>
              <button disabled={note.trim().length < 1} onClick={submitAdjust}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
