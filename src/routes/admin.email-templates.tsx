import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Plus, Trash2, Eye, X } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import {
  adminListEmailTemplates,
  adminUpsertEmailTemplate,
  adminDeleteEmailTemplate,
  adminPreviewEmailTemplate,
} from "@/lib/admin.email.functions";

export const Route = createFileRoute("/admin/email-templates")({
  head: () => ({ meta: [{ title: "Email Templates — Admin" }] }),
  component: AdminEmailTemplatesPage,
});

type Tpl = {
  id?: string;
  key: string;
  name: string;
  subject: string;
  html: string;
  text: string | null;
  description: string | null;
  is_enabled: boolean;
  is_system: boolean;
  variables: string[];
};

function emptyTpl(): Tpl {
  return {
    key: "", name: "", subject: "", html: "", text: "",
    description: "", is_enabled: true, is_system: false, variables: [],
  };
}

function AdminEmailTemplatesPage() {
  const listFn = useServerFn(adminListEmailTemplates);
  const upsertFn = useServerFn(adminUpsertEmailTemplate);
  const deleteFn = useServerFn(adminDeleteEmailTemplate);
  const previewFn = useServerFn(adminPreviewEmailTemplate);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-templates"],
    queryFn: () => listFn(),
  });

  const [editing, setEditing] = useState<Tpl | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");

  const save = useMutation({
    mutationFn: (t: Tpl) => upsertFn({ data: {
      id: t.id, key: t.key, name: t.name, subject: t.subject,
      html: t.html, text: t.text || null, description: t.description || null,
      is_enabled: t.is_enabled, variables: t.variables,
    } }),
    onSuccess: () => { toast.success("Template saved"); setEditing(null); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  async function doPreview(t: Tpl) {
    const sampleVars: Record<string, string> = {
      first_name: "Jane", last_name: "Doe", username: "janedoe", email: "jane@example.com",
      code: "482910", balance: "5.50", country: "US",
      site_name: "NovaRelay", site_url: "https://novarelay.io",
    };
    try {
      const r = await previewFn({ data: { subject: t.subject, html: t.html, vars: sampleVars } });
      setPreviewSubject(r.subject); setPreviewHtml(r.html);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Preview failed"); }
  }

  return (
    <>
      <Toaster richColors position="top-center" />
      <AdminHeader title="Email Templates" description="System and custom templates with {{variable}} substitution." />
      <div className="p-8 space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setEditing(emptyTpl())}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New template
          </button>
        </div>

        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Key</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Type</th>
                <th className="text-left px-4 py-3">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No templates yet</td></tr>}
              {(data as Tpl[] | undefined)?.map((t) => (
                <tr key={t.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{t.name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{t.key}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-xs">{t.subject}</td>
                  <td className="px-4 py-3 text-xs">
                    {t.is_system ? <span className="rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5">System</span> : <span className="text-muted-foreground">Custom</span>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {t.is_enabled ? <span className="text-emerald-600 dark:text-emerald-400">Enabled</span> : <span className="text-muted-foreground">Disabled</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button onClick={() => doPreview(t)} className="text-muted-foreground hover:text-foreground" title="Preview"><Eye className="h-4 w-4 inline" /></button>
                    <button onClick={() => setEditing(t)} className="text-primary text-xs hover:underline">Edit</button>
                    {!t.is_system && (
                      <button onClick={() => { if (confirm("Delete template?")) del.mutate(t.id!); }} className="text-destructive/80 hover:text-destructive" title="Delete">
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <EditDialog tpl={editing} onClose={() => setEditing(null)} onSave={(t) => save.mutate(t)} onPreview={doPreview} saving={save.isPending} />
      )}
      {previewHtml !== null && (
        <PreviewDialog subject={previewSubject} html={previewHtml} onClose={() => setPreviewHtml(null)} />
      )}
    </>
  );
}

function EditDialog({ tpl, onClose, onSave, onPreview, saving }:
  { tpl: Tpl; onClose: () => void; onSave: (t: Tpl) => void; onPreview: (t: Tpl) => void; saving: boolean }) {
  const [t, setT] = useState<Tpl>(tpl);
  const fieldCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-3xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold">{tpl.id ? "Edit template" : "New template"}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Key</label>
              <input value={t.key} disabled={t.is_system} onChange={(e) => setT({ ...t, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "_") })}
                placeholder="e.g. campaign_promo" className={fieldCls + " mt-1 font-mono"} />
            </div>
            <div>
              <label className="text-sm font-medium">Name</label>
              <input value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} className={fieldCls + " mt-1"} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Subject</label>
            <input value={t.subject} onChange={(e) => setT({ ...t, subject: e.target.value })} className={fieldCls + " mt-1"} />
          </div>
          <div>
            <label className="text-sm font-medium">HTML body</label>
            <textarea value={t.html} onChange={(e) => setT({ ...t, html: e.target.value })} rows={14}
              className={fieldCls + " mt-1 font-mono text-xs"} />
            <p className="text-xs text-muted-foreground mt-1">
              Variables: <code>{"{{first_name}} {{last_name}} {{username}} {{email}} {{site_name}} {{site_url}} {{code}} {{balance}}"}</code>
            </p>
          </div>
          <div>
            <label className="text-sm font-medium">Plain text fallback (optional)</label>
            <textarea value={t.text ?? ""} onChange={(e) => setT({ ...t, text: e.target.value })} rows={3} className={fieldCls + " mt-1 font-mono text-xs"} />
          </div>
          <div>
            <label className="text-sm font-medium">Description (admin notes)</label>
            <input value={t.description ?? ""} onChange={(e) => setT({ ...t, description: e.target.value })} className={fieldCls + " mt-1"} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={t.is_enabled} onChange={(e) => setT({ ...t, is_enabled: e.target.checked })} className="h-4 w-4" />
            Enabled
          </label>
        </div>
        <div className="px-6 py-4 border-t border-border/60 flex justify-between">
          <button onClick={() => onPreview(t)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">
            Preview with sample data
          </button>
          <div className="space-x-2">
            <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
            <button onClick={() => onSave(t)} disabled={saving} className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewDialog({ subject, html, onClose }: { subject: string; html: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold">Preview</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="px-6 py-4 border-b border-border/60">
          <div className="text-xs text-muted-foreground">Subject</div>
          <div className="font-medium">{subject}</div>
        </div>
        <iframe srcDoc={html} title="Preview" className="w-full h-[500px] bg-white" />
      </div>
    </div>
  );
}
