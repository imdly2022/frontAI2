import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminListScripts, adminUpsertScript, adminDeleteScript, ALLOWED_PLACEMENTS, ALLOWED_SCOPES } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Plus, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/scripts")({
  head: () => ({ meta: [{ title: "Custom Scripts — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ScriptsAdmin,
});

type S = {
  id?: string;
  name: string;
  code: string;
  placement: typeof ALLOWED_PLACEMENTS[number];
  page_scope: typeof ALLOWED_SCOPES[number];
  is_enabled: boolean;
  sort_order: number;
};

const EMPTY: S = { name: "Google Analytics", code: "<script>/* paste tracking snippet here */</script>", placement: "head", page_scope: "global", is_enabled: true, sort_order: 0 };

function ScriptsAdmin() {
  const listFn = useServerFn(adminListScripts);
  const upsertFn = useServerFn(adminUpsertScript);
  const delFn = useServerFn(adminDeleteScript);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "scripts"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<S | null>(null);

  async function save(s: S) {
    try { await upsertFn({ data: { ...s, sort_order: Number(s.sort_order) } }); toast.success("Saved"); setEditing(null); qc.invalidateQueries({ queryKey: ["admin", "scripts"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  }
  async function remove(id: string) { if (!confirm("Delete script?")) return; await delFn({ data: { id } }); toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin", "scripts"] }); }

  return (
    <>
      <AdminHeader title="Custom scripts" description="Inject HTML/JS into specific pages — analytics, pixels, chat widgets." />
      <div className="p-8 space-y-4">
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm flex gap-3">
          <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
          <div>
            Snippets are injected as raw HTML — admin only. Don't paste untrusted code. Use <code className="font-mono">head</code> for tracking, <code className="font-mono">body_end</code> for chat widgets.
          </div>
        </div>

        <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-4 w-4" /> New script
        </button>

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left px-4 py-2">Name</th><th className="text-left px-4 py-2">Scope</th><th className="text-left px-4 py-2">Placement</th><th className="text-left px-4 py-2">Enabled</th><th></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((s) => (
                <tr key={s.id} className="border-t border-border/40">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.page_scope}</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.placement}</td>
                  <td className="px-4 py-2">{s.is_enabled ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => setEditing(s as S)} className="text-primary hover:underline mr-3">Edit</button>
                    <button onClick={() => s.id && remove(s.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editing && <ScriptForm key={editing.id ?? "new"} s={editing} onCancel={() => setEditing(null)} onSave={save} />}
      </div>
    </>
  );
}

function ScriptForm({ s, onCancel, onSave }: { s: S; onCancel: () => void; onSave: (s: S) => Promise<void> }) {
  const [v, setV] = useState<S>(s);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(v); }} className="mt-2 rounded-lg border border-border/60 bg-card/60 p-5 grid grid-cols-3 gap-3 max-w-4xl">
      <F label="Name" full><input required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={ic} /></F>
      <F label="Page scope">
        <select value={v.page_scope} onChange={(e) => setV({ ...v, page_scope: e.target.value as S["page_scope"] })} className={ic}>
          {ALLOWED_SCOPES.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </F>
      <F label="Placement">
        <select value={v.placement} onChange={(e) => setV({ ...v, placement: e.target.value as S["placement"] })} className={ic}>
          {ALLOWED_PLACEMENTS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </F>
      <F label="Sort"><input type="number" value={v.sort_order} onChange={(e) => setV({ ...v, sort_order: Number(e.target.value) })} className={ic} /></F>
      <F label="HTML / JS snippet" full>
        <textarea required value={v.code} onChange={(e) => setV({ ...v, code: e.target.value })} className={ic + " min-h-[180px] font-mono text-xs"} />
      </F>
      <label className="col-span-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.is_enabled} onChange={(e) => setV({ ...v, is_enabled: e.target.checked })} /> Enabled
      </label>
      <div className="col-span-3 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </div>
    </form>
  );
}

const ic = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";
function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-3" : ""}><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
