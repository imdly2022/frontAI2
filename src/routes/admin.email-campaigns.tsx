import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Plus, Send, Trash2, X, Users } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import {
  adminListEmailCampaigns,
  adminCreateEmailCampaign,
  adminSendEmailCampaign,
  adminDeleteEmailCampaign,
  adminListEmailTemplates,
  adminSearchUsersForEmail,
} from "@/lib/admin.email.functions";

export const Route = createFileRoute("/admin/email-campaigns")({
  head: () => ({ meta: [{ title: "Email Campaigns — Admin" }] }),
  component: AdminEmailCampaignsPage,
});

type Campaign = {
  id: string; name: string; template_id: string | null;
  recipient_count: number; sent_count: number; failed_count: number;
  status: string; subject_override: string | null;
  created_at: string; completed_at: string | null;
  email_templates?: { key: string; name: string } | null;
};

function AdminEmailCampaignsPage() {
  const listFn = useServerFn(adminListEmailCampaigns);
  const sendFn = useServerFn(adminSendEmailCampaign);
  const delFn = useServerFn(adminDeleteEmailCampaign);
  const [creating, setCreating] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-campaigns"],
    queryFn: () => listFn(),
  });

  const send = useMutation({
    mutationFn: (id: string) => sendFn({ data: { id } }),
    onSuccess: (r) => { toast.success(`Sent ${r.sent}, failed ${r.failed} (${r.status})`); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Deleted"); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  return (
    <>
      <Toaster richColors position="top-center" />
      <AdminHeader title="Email Campaigns" description="Send templated emails to selected users." />
      <div className="p-8 space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4" /> New campaign
          </button>
        </div>

        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Template</th>
                <th className="text-right px-4 py-3">Recipients</th>
                <th className="text-right px-4 py-3">Sent / Failed</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (data ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No campaigns yet</td></tr>}
              {(data as Campaign[] | undefined)?.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{c.email_templates?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-mono">{c.recipient_count}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    <span className="text-emerald-600 dark:text-emerald-400">{c.sent_count}</span>
                    {" / "}
                    <span className="text-destructive">{c.failed_count}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                    {c.status !== "completed" && (
                      <button onClick={() => send.mutate(c.id)} disabled={send.isPending}
                        className="inline-flex items-center gap-1 rounded-md bg-primary/10 text-primary px-2.5 py-1 text-xs font-medium hover:bg-primary/20 disabled:opacity-60">
                        <Send className="h-3 w-3" /> {c.status === "sending" ? "Resume" : "Send"}
                      </button>
                    )}
                    <button onClick={() => { if (confirm(`Delete campaign "${c.name}"?`)) del.mutate(c.id); }}
                      className="text-destructive/80 hover:text-destructive"><Trash2 className="h-4 w-4 inline" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Tip: each Send run processes recipients for ~20 seconds. For large campaigns, click Send again to resume.
        </p>
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refetch(); }} />}
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    sending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    failed: "bg-destructive/10 text-destructive",
  };
  return <span className={`rounded-full px-2 py-0.5 ${map[status] ?? "bg-muted"}`}>{status}</span>;
}

type User = { id: string; newapi_user_id: number; username: string; email: string; first_name: string | null; last_name: string | null; country: string | null };

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const tplFn = useServerFn(adminListEmailTemplates);
  const searchFn = useServerFn(adminSearchUsersForEmail);
  const createFn = useServerFn(adminCreateEmailCampaign);

  const { data: templates } = useQuery({
    queryKey: ["admin-email-templates-for-camp"],
    queryFn: () => tplFn(),
  });
  const [name, setName] = useState("");
  const [tplId, setTplId] = useState("");
  const [subjectOverride, setSubjectOverride] = useState("");
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("");
  const [selected, setSelected] = useState<Map<number, User>>(new Map());

  const usersQ = useQuery({
    queryKey: ["admin-email-user-search", search, country],
    queryFn: () => searchFn({ data: { search: search || undefined, country: country || undefined, limit: 200 } }),
  });

  function toggle(u: User) {
    const m = new Map(selected);
    if (m.has(u.newapi_user_id)) m.delete(u.newapi_user_id); else m.set(u.newapi_user_id, u);
    setSelected(m);
  }
  function addAllShown() {
    const m = new Map(selected);
    for (const u of (usersQ.data ?? []) as User[]) m.set(u.newapi_user_id, u);
    setSelected(m);
  }

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      name, template_id: tplId,
      subject_override: subjectOverride || null,
      recipient_ids: Array.from(selected.keys()),
    } }),
    onSuccess: () => { toast.success("Campaign created"); onCreated(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const fieldCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur grid place-items-center p-4 overflow-y-auto">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
          <h2 className="text-lg font-semibold">New campaign</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Campaign name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="June promo" className={fieldCls + " mt-1"} />
            </div>
            <div>
              <label className="text-sm font-medium">Template</label>
              <select value={tplId} onChange={(e) => setTplId(e.target.value)} className={fieldCls + " mt-1"}>
                <option value="">Select template…</option>
                {(templates as Array<{ id: string; name: string; key: string; is_enabled: boolean }> | undefined)?.filter(t => t.is_enabled).map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.key})</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Subject override (optional)</label>
            <input value={subjectOverride} onChange={(e) => setSubjectOverride(e.target.value)}
              placeholder="Leave empty to use template subject" className={fieldCls + " mt-1"} />
          </div>

          <div className="border-t border-border/60 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-semibold text-sm">Recipients ({selected.size} selected)</h3>
            </div>
            <div className="flex gap-2 mb-3">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search email / name / username" className={fieldCls + " flex-1"} />
              <input value={country} onChange={(e) => setCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="Country (2 letters)" className={fieldCls + " w-44"} />
              <button onClick={addAllShown} className="rounded-md border border-border px-3 py-2 text-xs hover:bg-secondary whitespace-nowrap">Add all shown</button>
            </div>
            <div className="rounded-md border border-border/60 max-h-[280px] overflow-y-auto">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-border/40">
                  {((usersQ.data ?? []) as User[]).map((u) => {
                    const checked = selected.has(u.newapi_user_id);
                    return (
                      <tr key={u.id} className={`hover:bg-secondary/30 cursor-pointer ${checked ? "bg-primary/5" : ""}`} onClick={() => toggle(u)}>
                        <td className="px-3 py-2 w-8">
                          <input type="checkbox" checked={checked} onChange={() => toggle(u)} className="h-4 w-4" />
                        </td>
                        <td className="px-3 py-2 font-medium">{[u.first_name, u.last_name].filter(Boolean).join(" ") || u.username}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.email}</td>
                        <td className="px-3 py-2 text-muted-foreground">{u.country ?? "—"}</td>
                      </tr>
                    );
                  })}
                  {usersQ.isLoading && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">Loading…</td></tr>}
                  {!usersQ.isLoading && (usersQ.data ?? []).length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">No users found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border/60 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-secondary">Cancel</button>
          <button onClick={() => create.mutate()} disabled={!name || !tplId || selected.size === 0 || create.isPending}
            className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
            {create.isPending ? "Creating…" : `Create campaign (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}
