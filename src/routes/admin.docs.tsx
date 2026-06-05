import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  adminListDocs,
  adminUpsertDoc,
  adminDeleteDoc,
  adminListDocGroups,
  adminUpsertDocGroup,
  adminDeleteDocGroup,
} from "@/lib/admin.functions";
import { getDocVarReference } from "@/lib/cms.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { RichEditor } from "@/components/admin/RichEditor";
import { DocVarReference, type DocVarEntry } from "@/components/docs/DocVarReference";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil } from "lucide-react";

export const Route = createFileRoute("/admin/docs")({
  head: () => ({ meta: [{ title: "Docs — Admin" }, { name: "robots", content: "noindex" }] }),
  component: DocsAdmin,
});

type Doc = {
  id?: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  body_md: string;
  is_published: boolean;
  sort_order: number;
};

type Group = {
  id?: string;
  slug: string;
  name: string;
  description?: string | null;
  sort_order: number;
  is_visible: boolean;
};

const EMPTY_DOC: Doc = { slug: "new-page", title: "New page", body_md: "", is_published: true, sort_order: 0 };
const EMPTY_GROUP: Group = { slug: "new-group", name: "New group", sort_order: 0, is_visible: true };

function DocsAdmin() {
  const listDocs = useServerFn(adminListDocs);
  const upsertDoc = useServerFn(adminUpsertDoc);
  const delDoc = useServerFn(adminDeleteDoc);
  const listGroups = useServerFn(adminListDocGroups);
  const upsertGroup = useServerFn(adminUpsertDocGroup);
  const delGroup = useServerFn(adminDeleteDocGroup);
  const qc = useQueryClient();
  const { data: docs } = useQuery({ queryKey: ["admin", "docs"], queryFn: () => listDocs() });
  const { data: groups } = useQuery({ queryKey: ["admin", "doc-groups"], queryFn: () => listGroups() });
  const [editing, setEditing] = useState<Doc | null>(null);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

  async function saveDoc(d: Doc) {
    try {
      await upsertDoc({ data: { ...d, sort_order: Number(d.sort_order) } });
      toast.success("Saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["admin", "docs"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function removeDoc(id: string) {
    if (!confirm("Delete this page?")) return;
    await delDoc({ data: { id } });
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["admin", "docs"] });
  }
  async function saveGroup(g: Group) {
    try {
      await upsertGroup({ data: { ...g, sort_order: Number(g.sort_order) } });
      toast.success("Group saved");
      setEditingGroup(null);
      qc.invalidateQueries({ queryKey: ["admin", "doc-groups"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  }
  async function removeGroup(id: string) {
    if (!confirm("Delete this group? Pages will become uncategorized.")) return;
    await delGroup({ data: { id } });
    toast.success("Group deleted");
    qc.invalidateQueries({ queryKey: ["admin", "doc-groups"] });
  }

  return (
    <>
      <AdminHeader title="Documentation" description="Manage doc groups (sidebar sections) and pages. Each page can be assigned to one group." />
      <div className="p-8 space-y-10">
        {/* Groups */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Groups</h2>
            <button onClick={() => setEditingGroup({ ...EMPTY_GROUP })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New group
            </button>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Slug</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Sort</th>
                  <th className="text-left px-4 py-2">Visible</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(groups ?? []).map((g) => (
                  <tr key={g.id} className="border-t border-border/40">
                    <td className="px-4 py-2 font-mono text-xs">{g.slug}</td>
                    <td className="px-4 py-2">{g.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{g.sort_order}</td>
                    <td className="px-4 py-2">{g.is_visible ? "✓" : "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => setEditingGroup(g as Group)} className="inline-flex items-center gap-1 text-primary hover:underline mr-3">
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </button>
                      <button onClick={() => g.id && removeGroup(g.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    </td>
                  </tr>
                ))}
                {(!groups || groups.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No groups yet. Create one to organize the docs sidebar.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pages */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold">Pages</h2>
            <button onClick={() => setEditing({ ...EMPTY_DOC })} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> New page
            </button>
          </div>
          <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2">Slug</th>
                  <th className="text-left px-4 py-2">Title</th>
                  <th className="text-left px-4 py-2">Group</th>
                  <th className="text-left px-4 py-2">Published</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(docs ?? []).map((d) => {
                  const group = (groups ?? []).find((g) => g.slug === d.category);
                  return (
                    <tr key={d.id} className="border-t border-border/40">
                      <td className="px-4 py-2 font-mono text-xs">{d.slug}</td>
                      <td className="px-4 py-2">{d.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">{group?.name ?? d.category ?? "—"}</td>
                      <td className="px-4 py-2">{d.is_published ? "✓" : "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => setEditing(d as Doc)} className="inline-flex items-center gap-1 text-primary hover:underline mr-3">
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </button>
                        <button onClick={() => d.id && removeDoc(d.id)} className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {(!docs || docs.length === 0) && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">No docs yet. Create your first page.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit page" : "New page"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <DocForm
              key={editing.id ?? "new"}
              doc={editing}
              groups={groups ?? []}
              onCancel={() => setEditing(null)}
              onSave={saveDoc}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingGroup} onOpenChange={(o) => !o && setEditingGroup(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingGroup?.id ? "Edit group" : "New group"}</DialogTitle>
          </DialogHeader>
          {editingGroup && (
            <GroupForm
              key={editingGroup.id ?? "new"}
              group={editingGroup}
              onCancel={() => setEditingGroup(null)}
              onSave={saveGroup}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function DocForm({ doc, groups, onCancel, onSave }: { doc: Doc; groups: Group[]; onCancel: () => void; onSave: (d: Doc) => Promise<void> }) {
  const [d, setD] = useState<Doc>(doc);
  const [showVars, setShowVars] = useState(false);
  const varRefFn = useServerFn(getDocVarReference);
  const { data: varRef } = useQuery({
    queryKey: ["admin", "doc-vars"],
    queryFn: () => varRefFn(),
    staleTime: 60_000,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(d); }} className="grid grid-cols-2 gap-3">
      <F label="Slug"><input required value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} className={ic} pattern="[a-z0-9-]+" /></F>
      <F label="Sort"><input type="number" value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: Number(e.target.value) })} className={ic} /></F>
      <F label="Title" full><input required value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} className={ic} /></F>
      <F label="Description" full><input value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} className={ic} /></F>
      <F label="Group">
        <select value={d.category ?? ""} onChange={(e) => setD({ ...d, category: e.target.value || null })} className={ic}>
          <option value="">— Uncategorized —</option>
          {groups.map((g) => (
            <option key={g.slug} value={g.slug}>{g.name}</option>
          ))}
        </select>
      </F>
      <label className="flex items-end gap-2 text-sm pb-1">
        <input type="checkbox" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} /> Published
      </label>
      <div className="col-span-2">
        <label className="text-xs text-muted-foreground">Content</label>
        <div className="mt-1">
          <RichEditor value={d.body_md} onChange={(html) => setD({ ...d, body_md: html })} placeholder="Write the page…" />
        </div>
        <div className="mt-2 rounded-lg border border-border/60 bg-secondary/30">
          <button
            type="button"
            onClick={() => setShowVars((s) => !s)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-foreground/80 hover:text-foreground"
          >
            <span>Available variables — click any chip to copy</span>
            <span className="text-muted-foreground">{showVars ? "Hide" : "Show"}</span>
          </button>
          {showVars && (
            <div className="px-3 pb-3">
              {varRef ? (
                <DocVarReference catalog={varRef.catalog as DocVarEntry[]} compact />
              ) : (
                <div className="text-xs text-muted-foreground py-2">Loading variables…</div>
              )}
              <p className="mt-3 text-[11px] text-muted-foreground">
                Variables work in <strong>title</strong>, <strong>description</strong> and <strong>body</strong>. They&apos;re resolved on every request, so renaming the site or moving the API endpoint updates every page automatically.
              </p>
            </div>
          )}
        </div>
      </div>
      <DialogFooter className="col-span-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </DialogFooter>
    </form>
  );
}

function GroupForm({ group, onCancel, onSave }: { group: Group; onCancel: () => void; onSave: (g: Group) => Promise<void> }) {
  const [g, setG] = useState<Group>(group);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(g); }} className="grid grid-cols-2 gap-3">
      <F label="Slug"><input required value={g.slug} onChange={(e) => setG({ ...g, slug: e.target.value })} className={ic} pattern="[a-z0-9-]+" /></F>
      <F label="Sort"><input type="number" value={g.sort_order} onChange={(e) => setG({ ...g, sort_order: Number(e.target.value) })} className={ic} /></F>
      <F label="Name" full><input required value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} className={ic} /></F>
      <F label="Description" full><input value={g.description ?? ""} onChange={(e) => setG({ ...g, description: e.target.value })} className={ic} /></F>
      <label className="flex items-end gap-2 text-sm pb-1 col-span-2">
        <input type="checkbox" checked={g.is_visible} onChange={(e) => setG({ ...g, is_visible: e.target.checked })} /> Visible on docs site
      </label>
      <DialogFooter className="col-span-2 mt-2">
        <button type="button" onClick={onCancel} className="rounded-md border border-input px-3 py-1.5 text-sm">Cancel</button>
        <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">Save</button>
      </DialogFooter>
    </form>
  );
}

const ic = "w-full rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm";
function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={full ? "col-span-2" : ""}><label className="text-xs text-muted-foreground">{label}</label><div className="mt-1">{children}</div></div>;
}
