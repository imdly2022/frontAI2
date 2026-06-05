import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListPlans, adminUpsertPlan, adminDeletePlan } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/pricing")({
  head: () => ({ meta: [{ title: "Pricing — Admin" }, { name: "robots", content: "noindex" }] }),
  component: PricingAdmin,
});

type Plan = {
  id?: string;
  name: string;
  description?: string | null;
  price_usd: number;
  credits: number;
  bonus_credits: number;
  is_popular: boolean;
  is_active: boolean;
  sort_order: number;
  creem_product_id?: string | null;
  whop_plan_id?: string | null;
};

const EMPTY: Plan = { name: "Starter", price_usd: 10, credits: 10, bonus_credits: 0, is_popular: false, is_active: true, sort_order: 0, description: "", creem_product_id: "", whop_plan_id: "" };

function PricingAdmin() {
  const listFn = useServerFn(adminListPlans);
  const upsertFn = useServerFn(adminUpsertPlan);
  const delFn = useServerFn(adminDeletePlan);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "plans"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Plan | null>(null);

  async function save(p: Plan) {
    try {
      await upsertFn({ data: { ...p, price_usd: Number(p.price_usd), credits: Number(p.credits), bonus_credits: Number(p.bonus_credits), sort_order: Number(p.sort_order) } });
      toast.success("Plan saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "plans"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this plan?")) return;
    try { await delFn({ data: { id } }); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "plans"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Delete failed"); }
  }

  return (
    <>
      <AdminHeader title="Pricing plans" description="Top-up packs shown on /pricing and in the checkout." />
      <div className="p-8">
        <button onClick={() => setEditing({ ...EMPTY })} className="mb-4 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New plan
        </button>
        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Price</th><th className="text-left px-4 py-2">Credits</th><th className="text-left px-4 py-2">Bonus</th><th className="text-left px-4 py-2">Status</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((p) => (
                <tr key={p.id} className="border-t border-border/40">
                  <td className="px-4 py-2 font-medium">{p.name}{p.is_popular && <span className="ml-2 text-[10px] uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">popular</span>}</td>
                  <td className="px-4 py-2">${Number(p.price_usd).toFixed(2)}</td>
                  <td className="px-4 py-2">{Number(p.credits)}</td>
                  <td className="px-4 py-2">{Number(p.bonus_credits ?? 0)}</td>
                  <td className="px-4 py-2"><span className={`text-xs ${p.is_active ? "text-success" : "text-muted-foreground"}`}>{p.is_active ? "active" : "hidden"}</span></td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(p as Plan)} className="text-primary hover:underline mr-3">Edit</button>
                    <button onClick={() => p.id && remove(p.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && (
          <PlanForm key={editing.id ?? "new"} plan={editing} onCancel={() => setEditing(null)} onSave={save} />
        )}
      </div>
    </>
  );
}

function PlanForm({ plan, onCancel, onSave }: { plan: Plan; onCancel: () => void; onSave: (p: Plan) => Promise<void> }) {
  const [p, setP] = useState<Plan>(plan);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(p); }} className="mt-6 rounded-lg border border-border/60 bg-card/60 p-5 grid grid-cols-2 gap-3 max-w-2xl">
      <Field label="Name"><input required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} className={inputCls} /></Field>
      <Field label="Sort"><input type="number" value={p.sort_order} onChange={(e) => setP({ ...p, sort_order: Number(e.target.value) })} className={inputCls} /></Field>
      <Field label="Price (USD)"><input type="number" step="0.01" required value={p.price_usd} onChange={(e) => setP({ ...p, price_usd: Number(e.target.value) })} className={inputCls} /></Field>
      <Field label="Credits"><input type="number" required value={p.credits} onChange={(e) => setP({ ...p, credits: Number(e.target.value) })} className={inputCls} /></Field>
      <Field label="Bonus credits"><input type="number" value={p.bonus_credits} onChange={(e) => setP({ ...p, bonus_credits: Number(e.target.value) })} className={inputCls} /></Field>
      <Field label="Description" full>
        <textarea value={p.description ?? ""} onChange={(e) => setP({ ...p, description: e.target.value })} className={inputCls + " min-h-[60px]"} />
      </Field>
      <Field label="Creem product ID"><input value={p.creem_product_id ?? ""} onChange={(e) => setP({ ...p, creem_product_id: e.target.value })} placeholder="prod_..." className={inputCls} /></Field>
      <Field label="Whop plan ID"><input value={p.whop_plan_id ?? ""} onChange={(e) => setP({ ...p, whop_plan_id: e.target.value })} placeholder="plan_..." className={inputCls} /></Field>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.is_active} onChange={(e) => setP({ ...p, is_active: e.target.checked })} /> Active
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={p.is_popular} onChange={(e) => setP({ ...p, is_popular: e.target.checked })} /> Mark as most popular
      </label>
      <div className="col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </div>
    </form>
  );
}

const inputCls = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";
function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2" : ""}><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
