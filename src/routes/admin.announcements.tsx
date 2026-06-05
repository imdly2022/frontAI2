import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Megaphone } from "lucide-react";
import {
  adminListAnnouncements, adminUpsertAnnouncement, adminDeleteAnnouncement,
} from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/admin/announcements")({
  head: () => ({ meta: [{ title: "Announcements — Admin" }, { name: "robots", content: "noindex" }] }),
  component: AnnouncementsAdmin,
});

type Level = "info" | "success" | "warning" | "critical";
type A = {
  id?: string;
  title: string;
  body: string;
  level: Level;
  is_active: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  link_url?: string | null;
  link_label?: string | null;
  sort_order: number;
};
const EMPTY: A = { title: "", body: "", level: "info", is_active: true, sort_order: 0 };

const LEVEL_STYLES: Record<Level, string> = {
  info: "bg-primary/10 text-primary border-primary/30",
  success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

function AnnouncementsAdmin() {
  const listFn = useServerFn(adminListAnnouncements);
  const upsertFn = useServerFn(adminUpsertAnnouncement);
  const delFn = useServerFn(adminDeleteAnnouncement);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "announcements"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<A | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

  async function save(a: A) {
    try {
      const payload = {
        ...a,
        starts_at: a.starts_at || null,
        ends_at: a.ends_at || null,
        link_url: a.link_url || null,
        link_label: a.link_label || null,
      };
      await upsertFn({ data: payload });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    } catch (e) {
      console.error("[announcement save]", e);
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function doDelete() {
    if (!delId) return;
    try {
      await delFn({ data: { id: delId } });
      toast.success("Deleted");
      setDelId(null);
      qc.invalidateQueries({ queryKey: ["admin", "announcements"] });
    } catch (e) {
      console.error("[announcement delete]", e);
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  const rows = (data ?? []) as A[];

  return (
    <>
      <AdminHeader title="Announcements" description="Shown to logged-in users on their dashboard." />
      <div className="p-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{rows.length} total</p>
          <button onClick={() => setEditing({ ...EMPTY })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New announcement
          </button>
        </div>

        <div className="space-y-3">
          {rows.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 p-12 text-center">
              <Megaphone className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm text-muted-foreground">No announcements yet.</p>
            </div>
          )}
          {rows.map((a) => (
            <div key={a.id} className="rounded-lg border border-border/60 bg-card/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider ${LEVEL_STYLES[a.level]}`}>{a.level}</span>
                    {!a.is_active && <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">inactive</span>}
                    <h3 className="font-medium">{a.title}</h3>
                  </div>
                  {a.body && <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{a.body}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Order: {a.sort_order}</span>
                    {a.starts_at && <span>From: {new Date(a.starts_at).toLocaleString()}</span>}
                    {a.ends_at && <span>Until: {new Date(a.ends_at).toLocaleString()}</span>}
                    {a.link_url && <span>Link: {a.link_label || a.link_url}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button onClick={() => setEditing(a)} className="rounded-md border border-input px-2 py-1 text-xs hover:bg-secondary inline-flex items-center gap-1">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button onClick={() => a.id && setDelId(a.id)} className="rounded-md border border-input px-2 py-1 text-xs text-muted-foreground hover:bg-destructive hover:text-destructive-foreground hover:border-destructive inline-flex items-center gap-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing?.id ? "Edit announcement" : "New announcement"}</DialogTitle>
            </DialogHeader>
            {editing && <AnnouncementForm key={editing.id ?? "new"} value={editing} onCancel={() => setEditing(null)} onSave={save} />}
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!delId} onOpenChange={(o) => { if (!o) setDelId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete announcement?</AlertDialogTitle>
              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={doDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

const ic = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";

function AnnouncementForm({ value, onCancel, onSave }: { value: A; onCancel: () => void; onSave: (a: A) => Promise<void> }) {
  const [a, setA] = useState<A>(value);
  // datetime-local needs YYYY-MM-DDTHH:mm
  const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");
  const fromLocal = (v: string) => (v ? new Date(v).toISOString() : null);

  return (
    <form
      className="grid grid-cols-2 gap-4"
      onSubmit={(e) => { e.preventDefault(); onSave(a); }}
    >
      <div className="col-span-2">
        <label className="text-xs text-muted-foreground">Title</label>
        <input required maxLength={200} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} className={`${ic} mt-1`} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-muted-foreground">Body (Markdown supported by reader)</label>
        <textarea rows={5} maxLength={4000} value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} className={`${ic} mt-1 font-mono text-xs`} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Level</label>
        <select value={a.level} onChange={(e) => setA({ ...a, level: e.target.value as Level })} className={`${ic} mt-1`}>
          <option value="info">Info</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="critical">Critical</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Sort order</label>
        <input type="number" value={a.sort_order} onChange={(e) => setA({ ...a, sort_order: Number(e.target.value) })} className={`${ic} mt-1`} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Starts at (optional)</label>
        <input type="datetime-local" value={toLocal(a.starts_at)} onChange={(e) => setA({ ...a, starts_at: fromLocal(e.target.value) })} className={`${ic} mt-1`} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Ends at (optional)</label>
        <input type="datetime-local" value={toLocal(a.ends_at)} onChange={(e) => setA({ ...a, ends_at: fromLocal(e.target.value) })} className={`${ic} mt-1`} />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Link URL (optional)</label>
        <input type="url" value={a.link_url ?? ""} onChange={(e) => setA({ ...a, link_url: e.target.value })} className={`${ic} mt-1`} placeholder="https://…" />
      </div>
      <div>
        <label className="text-xs text-muted-foreground">Link label</label>
        <input value={a.link_label ?? ""} onChange={(e) => setA({ ...a, link_label: e.target.value })} className={`${ic} mt-1`} placeholder="Learn more" />
      </div>
      <label className="col-span-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={a.is_active} onChange={(e) => setA({ ...a, is_active: e.target.checked })} />
        Active (visible on user dashboard)
      </label>
      <div className="col-span-2 flex justify-end gap-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </div>
    </form>
  );
}
