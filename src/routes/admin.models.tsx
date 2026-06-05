import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  adminListModels, adminUpsertModel, adminDeleteModel,
  adminBulkDeleteModels, adminBulkSetModelVisibility,
  adminSyncModelsFromNewApi,
  adminListModelCategories, adminRenameModelCategory, adminDeleteModelCategory,
} from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, RefreshCw, Eye, EyeOff, Search, FolderTree, Pencil } from "lucide-react";


export const Route = createFileRoute("/admin/models")({
  head: () => ({ meta: [{ title: "Models — Admin" }, { name: "robots", content: "noindex" }] }),
  component: ModelsAdmin,
});

type M = {
  id?: string;
  provider: string;
  slug: string;
  display_name: string;
  description?: string | null;
  category?: string | null;
  modality: string;
  context_length?: number | null;
  input_price_per_1k?: number | null;
  output_price_per_1k?: number | null;
  cached_input_price_per_1k?: number | null;
  vendor_input_price_per_1k?: number | null;
  vendor_output_price_per_1k?: number | null;
  vendor_cached_input_price_per_1k?: number | null;
  badges: string[];
  is_visible: boolean;
  is_featured: boolean;
  sort_order: number;
};

const EMPTY: M = { provider: "openai", slug: "gpt-5", display_name: "GPT-5", modality: "chat", badges: [], is_visible: true, is_featured: false, sort_order: 0 };

function n(v: unknown) { return v != null && String(v) !== "" ? Number(v) : null; }

function ModelsAdmin() {
  const listFn = useServerFn(adminListModels);
  const upsertFn = useServerFn(adminUpsertModel);
  const delFn = useServerFn(adminDeleteModel);
  const bulkDelFn = useServerFn(adminBulkDeleteModels);
  const bulkVisFn = useServerFn(adminBulkSetModelVisibility);
  const syncFn = useServerFn(adminSyncModelsFromNewApi);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "models"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<M | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const all = (data ?? []) as M[];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((m) =>
      m.slug.toLowerCase().includes(needle) ||
      m.display_name.toLowerCase().includes(needle) ||
      m.provider.toLowerCase().includes(needle) ||
      (m.category ?? "").toLowerCase().includes(needle)
    );
  }, [data, q]);

  const allVisibleIds = useMemo(() => rows.map((r) => r.id!).filter(Boolean), [rows]);
  const allChecked = allVisibleIds.length > 0 && allVisibleIds.every((id) => selected.has(id));
  const someChecked = allVisibleIds.some((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => {
      if (allChecked) {
        const next = new Set(prev);
        allVisibleIds.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      allVisibleIds.forEach((id) => next.add(id));
      return next;
    });
  }

  async function doSync() {
    setSyncing(true);
    try {
      const res = await syncFn();
      toast.success(`Synced: ${res.inserted} new (of ${res.total_remote} remote, ${res.existing} already known). Newly added models are hidden — review & set prices.`);
      qc.invalidateQueries({ queryKey: ["admin", "models"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Sync failed"); }
    finally { setSyncing(false); }
  }

  async function save(m: M) {
    try {
      await upsertFn({ data: {
        ...m,
        context_length: m.context_length ? Number(m.context_length) : null,
        input_price_per_1k: n(m.input_price_per_1k),
        output_price_per_1k: n(m.output_price_per_1k),
        cached_input_price_per_1k: n(m.cached_input_price_per_1k),
        vendor_input_price_per_1k: n(m.vendor_input_price_per_1k),
        vendor_output_price_per_1k: n(m.vendor_output_price_per_1k),
        vendor_cached_input_price_per_1k: n(m.vendor_cached_input_price_per_1k),
        sort_order: Number(m.sort_order),
      }});
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "models"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Save failed"); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this model?")) return;
    await delFn({ data: { id } });
    toast.success("Deleted");
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
    qc.invalidateQueries({ queryKey: ["admin", "models"] });
  }
  const [confirmBulkDel, setConfirmBulkDel] = useState(false);
  const [bulkBusy, setBulkBusy] = useState<string | null>(null);
  const [showGroups, setShowGroups] = useState(false);

  async function bulkDelete() {
    const ids = Array.from(selected);
    if (!ids.length) return;
    const CHUNK = 100;
    let done = 0;
    try {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const slice = ids.slice(i, i + CHUNK);
        setBulkBusy(`Deleting ${done + 1}–${done + slice.length} of ${ids.length}…`);
        const res = await bulkDelFn({ data: { ids: slice } });
        done += res?.deleted ?? slice.length;
      }
      toast.success(`Deleted ${done} model(s)`);
      setSelected(new Set());
      setConfirmBulkDel(false);
      qc.invalidateQueries({ queryKey: ["admin", "models"] });
    } catch (e) {
      console.error("[bulkDelete]", e);
      toast.error(`${e instanceof Error ? e.message : "Bulk delete failed"} (${done}/${ids.length} done)`);
      qc.invalidateQueries({ queryKey: ["admin", "models"] });
    } finally {
      setBulkBusy(null);
    }
  }

  async function bulkSetVisible(is_visible: boolean) {
    const ids = Array.from(selected);
    if (!ids.length) return;
    try {
      await bulkVisFn({ data: { ids, is_visible } });
      toast.success(`${is_visible ? "Shown" : "Hidden"} ${ids.length} model(s)`);
      qc.invalidateQueries({ queryKey: ["admin", "models"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Bulk update failed"); }
  }

  return (
    <>
      <AdminHeader title="Models catalog" description="Vendor (official) price + our price. Only visible rows appear on /models." />
      <div className="p-8">
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New model
          </button>
          <button onClick={doSync} disabled={syncing} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-secondary disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} /> {syncing ? "Syncing…" : "Sync from NewAPI"}
          </button>
          <button onClick={() => setShowGroups(true)} className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-sm hover:bg-secondary">
            <FolderTree className="h-4 w-4" /> Manage groups
          </button>
          <div className="relative ml-auto">
            <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search slug, name, provider…"
              className="rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm w-72"
            />
          </div>
        </div>


        {selected.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{selected.size} selected</span>
            <button onClick={() => bulkSetVisible(true)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-secondary">
              <Eye className="h-3.5 w-3.5" /> Show
            </button>
            <button onClick={() => bulkSetVisible(false)} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-secondary">
              <EyeOff className="h-3.5 w-3.5" /> Hide
            </button>
            <button onClick={() => setConfirmBulkDel(true)} className="inline-flex items-center gap-1 rounded-md bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground hover:bg-destructive/90">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Clear</button>
          </div>
        )}

        <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                    onChange={toggleAll}
                    aria-label="Select all"
                  />
                </th>
                <th className="text-left px-4 py-2">Provider</th>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-left px-4 py-2">Display</th>
                <th className="text-left px-4 py-2">Vendor in/out</th>
                <th className="text-left px-4 py-2">Ours in/out</th>
                <th className="text-left px-4 py-2">Visible</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className={`border-t border-border/40 ${selected.has(m.id!) ? "bg-primary/5" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(m.id!)} onChange={() => m.id && toggleOne(m.id)} aria-label={`Select ${m.slug}`} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{m.provider}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.slug}</td>
                  <td className="px-4 py-2">{m.display_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                    {m.vendor_input_price_per_1k != null ? `$${(Number(m.vendor_input_price_per_1k) * 1000).toFixed(2)} / $${(Number(m.vendor_output_price_per_1k ?? 0) * 1000).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {m.input_price_per_1k != null ? `$${(Number(m.input_price_per_1k) * 1000).toFixed(2)} / $${(Number(m.output_price_per_1k ?? 0) * 1000).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-4 py-2">{m.is_visible ? "✓" : "—"}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(m)} className="text-primary hover:underline mr-3">Edit</button>
                    <button onClick={() => m.id && remove(m.id)} className="text-muted-foreground hover:text-destructive" aria-label="Delete">
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No models match.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? `Edit ${editing.display_name}` : "New model"}</DialogTitle>
            </DialogHeader>
            {editing && <ModelForm
              key={editing.id ?? "new"}
              model={editing}
              categories={Array.from(new Set((data ?? []).map((m: M) => m.category).filter(Boolean) as string[])).sort()}
              onCancel={() => setEditing(null)}
              onSave={save}
            />}
          </DialogContent>
        </Dialog>

        <AlertDialog open={confirmBulkDel} onOpenChange={(o) => { if (!bulkBusy) setConfirmBulkDel(o); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selected.size} model(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                {bulkBusy ?? "This cannot be undone. Large selections are deleted in batches of 100."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={!!bulkBusy}>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={!!bulkBusy} onClick={(e) => { e.preventDefault(); bulkDelete(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {bulkBusy ? "Working…" : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <GroupsDialog open={showGroups} onOpenChange={setShowGroups} onChanged={() => qc.invalidateQueries({ queryKey: ["admin", "models"] })} />

      </div>
    </>
  );
}

function ModelForm({ model, categories, onCancel, onSave }: { model: M; categories: string[]; onCancel: () => void; onSave: (m: M) => Promise<void> }) {
  const [m, setM] = useState<M>(model);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(m); }} className="grid grid-cols-2 gap-3">
      <F label="Provider"><input required value={m.provider} onChange={(e) => setM({ ...m, provider: e.target.value })} className={ic} /></F>
      <F label="Slug"><input required value={m.slug} onChange={(e) => setM({ ...m, slug: e.target.value })} className={ic} /></F>
      <F label="Display name" full><input required value={m.display_name} onChange={(e) => setM({ ...m, display_name: e.target.value })} className={ic} /></F>
      <F label="Description" full><textarea value={m.description ?? ""} onChange={(e) => setM({ ...m, description: e.target.value })} className={ic + " min-h-[60px]"} /></F>
      <F label="Group (category)">
        <input
          list="model-categories"
          value={m.category ?? ""}
          onChange={(e) => setM({ ...m, category: e.target.value })}
          className={ic}
          placeholder="e.g. Chat, Reasoning, Image…"
        />
        <datalist id="model-categories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </F>
      <F label="Modality"><input value={m.modality} onChange={(e) => setM({ ...m, modality: e.target.value })} className={ic} /></F>
      <F label="Context length"><input type="number" value={m.context_length ?? ""} onChange={(e) => setM({ ...m, context_length: e.target.value === "" ? null : Number(e.target.value) })} className={ic} /></F>
      <F label="Sort"><input type="number" value={m.sort_order} onChange={(e) => setM({ ...m, sort_order: Number(e.target.value) })} className={ic} /></F>

      <div className="col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">Vendor (official) USD / 1M tokens</div>
      <F label="Vendor input / 1M"><input type="number" step="0.01" value={m.vendor_input_price_per_1k == null ? "" : Number(m.vendor_input_price_per_1k) * 1000} onChange={(e) => setM({ ...m, vendor_input_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>
      <F label="Vendor output / 1M"><input type="number" step="0.01" value={m.vendor_output_price_per_1k == null ? "" : Number(m.vendor_output_price_per_1k) * 1000} onChange={(e) => setM({ ...m, vendor_output_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>
      <F label="Vendor cached input / 1M" full><input type="number" step="0.01" value={m.vendor_cached_input_price_per_1k == null ? "" : Number(m.vendor_cached_input_price_per_1k) * 1000} onChange={(e) => setM({ ...m, vendor_cached_input_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>

      <div className="col-span-2 mt-2 text-xs uppercase tracking-wider text-muted-foreground">Our price USD / 1M tokens</div>
      <F label="Input / 1M"><input type="number" step="0.01" value={m.input_price_per_1k == null ? "" : Number(m.input_price_per_1k) * 1000} onChange={(e) => setM({ ...m, input_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>
      <F label="Output / 1M"><input type="number" step="0.01" value={m.output_price_per_1k == null ? "" : Number(m.output_price_per_1k) * 1000} onChange={(e) => setM({ ...m, output_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>
      <F label="Cached input / 1M" full><input type="number" step="0.01" value={m.cached_input_price_per_1k == null ? "" : Number(m.cached_input_price_per_1k) * 1000} onChange={(e) => setM({ ...m, cached_input_price_per_1k: e.target.value === "" ? null : Number(e.target.value) / 1000 })} className={ic} /></F>

      <F label="Badges (comma-separated)" full>
        <input value={m.badges.join(",")} onChange={(e) => setM({ ...m, badges: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} className={ic} placeholder="popular,new" />
      </F>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={m.is_visible} onChange={(e) => setM({ ...m, is_visible: e.target.checked })} /> Visible on public site
      </label>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={m.is_featured} onChange={(e) => setM({ ...m, is_featured: e.target.checked })} disabled={!m.is_visible} />
        <span>Featured on homepage <span className="text-xs text-muted-foreground">(highlighted in the savings showcase — requires Visible)</span></span>
      </label>
      <div className="col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </div>
    </form>
  );
}

const ic = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";
function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2" : ""}><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}

function GroupsDialog({ open, onOpenChange, onChanged }: { open: boolean; onOpenChange: (o: boolean) => void; onChanged: () => void }) {
  const listFn = useServerFn(adminListModelCategories);
  const renameFn = useServerFn(adminRenameModelCategory);
  const delFn = useServerFn(adminDeleteModelCategory);
  const qc = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["admin", "model-categories"],
    queryFn: () => listFn(),
    enabled: open,
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  async function doRename(from: string) {
    const to = draft.trim();
    if (!to || to === from) { setEditing(null); return; }
    try {
      const res = await renameFn({ data: { from, to } });
      toast.success(`Renamed (${res.updated} models)`);
      setEditing(null);
      await refetch();
      onChanged();
      qc.invalidateQueries({ queryKey: ["admin", "model-categories"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Rename failed"); }
  }

  async function doDelete(name: string, mode: "unset" | "delete") {
    const msg = mode === "delete"
      ? `Delete ALL models in group "${name}"? This permanently removes them.`
      : `Remove group "${name}"? Models in it will be uncategorised (kept).`;
    if (!confirm(msg)) return;
    try {
      const res = await delFn({ data: { name, mode } });
      toast.success(mode === "delete" ? `Deleted ${res.deleted ?? 0} models` : `Uncategorised ${res.unset ?? 0} models`);
      await refetch();
      onChanged();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FolderTree className="h-4 w-4" /> Model groups</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground -mt-2">
          Rename or delete category groups used across the catalog. Renaming updates every model in the group.
        </p>
        <div className="mt-2 max-h-[60vh] overflow-y-auto divide-y divide-border/40 rounded-md border border-border/40">
          {(data ?? []).length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No groups yet. Set a category on a model first.</div>
          )}
          {(data ?? []).map((g) => (
            <div key={g.name} className="flex items-center gap-2 px-3 py-2">
              {editing === g.name ? (
                <>
                  <input
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") doRename(g.name); if (e.key === "Escape") setEditing(null); }}
                    className="flex-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm"
                  />
                  <button onClick={() => doRename(g.name)} className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">Save</button>
                  <button onClick={() => setEditing(null)} className="rounded-md border border-input px-2.5 py-1.5 text-xs hover:bg-secondary">Cancel</button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{g.name}</div>
                    <div className="text-xs text-muted-foreground">{g.count} {g.count === 1 ? "model" : "models"}</div>
                  </div>
                  <button onClick={() => { setEditing(g.name); setDraft(g.name); }} title="Rename" className="rounded-md border border-input p-1.5 hover:bg-secondary">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => doDelete(g.name, "unset")} title="Remove group (keep models)" className="rounded-md border border-input px-2 py-1.5 text-xs hover:bg-secondary">
                    Uncategorise
                  </button>
                  <button onClick={() => doDelete(g.name, "delete")} title="Delete group AND its models" className="rounded-md border border-destructive/40 bg-destructive/5 p-1.5 text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

