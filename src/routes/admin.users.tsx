import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Search, RefreshCw, Download, Trash2, Wallet, Gift } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import {
  adminListUsers, adminGetUserBalances, adminBackfillUsers, adminDeleteUser,
  adminAdjustUserBalance, adminGetSignupBonus, adminSetSignupBonus,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/users")({
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const listFn = useServerFn(adminListUsers);
  const balanceFn = useServerFn(adminGetUserBalances);
  const backfillFn = useServerFn(adminBackfillUsers);
  const deleteFn = useServerFn(adminDeleteUser);
  const adjustFn = useServerFn(adminAdjustUserBalance);
  const getBonusFn = useServerFn(adminGetSignupBonus);
  const setBonusFn = useServerFn(adminSetSignupBonus);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-users", debounced, offset],
    queryFn: () => listFn({ data: { search: debounced || undefined, limit, offset } }),
  });

  const balances = useMutation({
    mutationFn: (ids: number[]) => balanceFn({ data: { ids } }),
  });

  const ids = (data?.rows ?? []).map((r: { newapi_user_id: number }) => r.newapi_user_id);
  useEffect(() => {
    if (ids.length) balances.mutate(ids);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ids)]);

  // ── Signup bonus config ──
  const { data: bonus, refetch: refetchBonus } = useQuery({
    queryKey: ["admin-signup-bonus"],
    queryFn: () => getBonusFn(),
  });
  const [bonusForm, setBonusForm] = useState<{ enabled: boolean; amount_usd: string; note: string } | null>(null);
  useEffect(() => {
    if (bonus && !bonusForm) {
      setBonusForm({ enabled: bonus.enabled, amount_usd: String(bonus.amount_usd), note: bonus.note });
    }
  }, [bonus, bonusForm]);

  async function handleAdjust(u: { newapi_user_id: number; username: string }) {
    const raw = window.prompt(
      `Adjust balance for ${u.username} (USD).\nPositive = add, Negative = deduct.`,
      "10",
    );
    if (raw === null) return;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount === 0) {
      toast.error("Invalid amount");
      return;
    }
    const note = window.prompt("Optional note (shown in billing record):", "") ?? "";
    try {
      await adjustFn({ data: { newapi_user_id: u.newapi_user_id, amount_usd: amount, note: note || undefined } });
      toast.success(`${amount > 0 ? "Added" : "Deducted"} $${Math.abs(amount).toFixed(2)}`);
      if (ids.length) balances.mutate(ids);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Adjustment failed");
    }
  }

  return (
    <>
      <AdminHeader title="Users" description="All registered users mirrored from NewAPI." />
      <div className="p-8">
        {/* Signup bonus config */}
        <div className="mb-6 rounded-lg border border-border/60 bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Gift className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Signup Bonus</h2>
            <span className="text-xs text-muted-foreground">Automatically granted on registration; recorded in billing.</span>
          </div>
          {bonusForm && (
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={bonusForm.enabled}
                  onChange={(e) => setBonusForm({ ...bonusForm, enabled: e.target.checked })}
                />
                Enabled
              </label>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Amount (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={bonusForm.amount_usd}
                  onChange={(e) => setBonusForm({ ...bonusForm, amount_usd: e.target.value })}
                  className="w-28 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs text-muted-foreground mb-1">Billing note</label>
                <input
                  type="text"
                  value={bonusForm.note}
                  onChange={(e) => setBonusForm({ ...bonusForm, note: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </div>
              <button
                onClick={async () => {
                  const amt = Number(bonusForm.amount_usd);
                  if (!Number.isFinite(amt) || amt < 0) { toast.error("Invalid amount"); return; }
                  try {
                    await setBonusFn({ data: { enabled: bonusForm.enabled, amount_usd: amt, note: bonusForm.note || "Welcome bonus" } });
                    toast.success("Signup bonus saved");
                    refetchBonus();
                  } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search email or username..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm"
            />
          </div>
          <button
            onClick={() => { refetch(); if (ids.length) balances.mutate(ids); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-secondary"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={async () => {
              try {
                const r = await backfillFn();
                toast.success(`Backfilled ${r.inserted} new, ${r.updated} updated (${r.total} from NewAPI)`);
                refetch();
              } catch (e) { toast.error(e instanceof Error ? e.message : "Backfill failed"); }
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary/40 px-3 py-2 text-sm text-primary hover:bg-primary/10"
          >
            <Download className="h-4 w-4" /> Backfill from NewAPI
          </button>
          <div className="text-sm text-muted-foreground ml-auto">
            {data?.total ?? 0} users
          </div>
        </div>


        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Country</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-right px-4 py-3">Balance</th>
                <th className="text-right px-4 py-3">Spend</th>
                <th className="text-left px-4 py-3">Ref</th>
                <th className="text-left px-4 py-3">Registered</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td></tr>
              )}
              {!isLoading && (data?.rows ?? []).length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No users found</td></tr>
              )}
              {(data?.rows ?? []).map((u: { id: string; newapi_user_id: number; username: string; email: string; first_name: string | null; last_name: string | null; country: string | null; phone: string | null; register_country: string | null; affiliate_id: string | null; created_at: string; lifetime_spend_usd: number }) => {
                const bal = (balances.data as Record<number, { balance_usd: number; used_usd: number } | { error: string }> | undefined)?.[u.newapi_user_id];
                const aff = (u as { affiliates?: { slug?: string; display_name?: string } | null }).affiliates;
                const fullName = [u.first_name, u.last_name].filter(Boolean).join(" ");
                return (
                  <tr key={u.id} className="hover:bg-secondary/30">
                    <td className="px-4 py-3">
                      <div className="font-medium">{u.username}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">{fullName || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-xs">
                      {u.country ?? <span className="text-muted-foreground">—</span>}
                      {u.register_country && u.register_country !== u.country && (
                        <span className="ml-1 text-muted-foreground">(IP: {u.register_country})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono">{u.phone || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right font-mono">
                      {bal && "balance_usd" in bal ? `$${bal.balance_usd.toFixed(2)}` : bal && "error" in bal ? <span className="text-destructive text-xs">err</span> : "..."}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">${Number(u.lifetime_spend_usd).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs">{aff ? (aff.display_name ?? aff.slug) : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleAdjust({ newapi_user_id: u.newapi_user_id, username: u.username })}
                          className="text-primary/80 hover:text-primary"
                          title="Adjust balance"
                        >
                          <Wallet className="h-4 w-4" />
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete local record for ${u.username}? (NewAPI account is preserved)`)) return;
                            try { await deleteFn({ data: { id: u.id } }); toast.success("Deleted"); refetch(); }
                            catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
                          }}
                          className="text-destructive/80 hover:text-destructive"
                          title="Delete local record"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <button
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            ← Previous
          </button>
          <div className="text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + limit, data?.total ?? 0)} of {data?.total ?? 0}
          </div>
          <button
            disabled={(data?.rows ?? []).length < limit}
            onClick={() => setOffset(offset + limit)}
            className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      </div>
    </>
  );
}
