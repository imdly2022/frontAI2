import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Toaster } from "sonner";
import { Search, RefreshCw } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import { adminListEmailLog } from "@/lib/admin.email.functions";

export const Route = createFileRoute("/admin/email-logs")({
  head: () => ({ meta: [{ title: "Email Send Log — Admin" }] }),
  component: AdminEmailLogPage,
});

type Row = {
  id: string; to_email: string; to_name: string | null; subject: string;
  template_key: string | null; campaign_id: string | null;
  status: "sent" | "failed"; error: string | null;
  provider_message_id: string | null; created_at: string;
};

function AdminEmailLogPage() {
  const listFn = useServerFn(adminListEmailLog);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | "sent" | "failed">("");
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-log", search, status, offset],
    queryFn: () => listFn({ data: {
      search: search || undefined,
      status: (status || undefined) as "sent" | "failed" | undefined,
      limit, offset,
    } }),
  });

  return (
    <>
      <Toaster richColors position="top-center" />
      <AdminHeader title="Email Send Log" description="All outbound emails with delivery status." />
      <div className="p-8 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search by recipient email…" className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm" />
          </div>
          <select value={status} onChange={(e) => { setStatus(e.target.value as "" | "sent" | "failed"); setOffset(0); }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
          </select>
          <button onClick={() => refetch()} className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-secondary">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <div className="text-sm text-muted-foreground ml-auto">{data?.total ?? 0} entries</div>
        </div>

        <div className="rounded-lg border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3">When</th>
                <th className="text-left px-4 py-3">Recipient</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Template</th>
                <th className="text-left px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>}
              {!isLoading && (data?.rows ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No emails found</td></tr>}
              {((data?.rows ?? []) as Row[]).map((r) => (
                <tr key={r.id} className="hover:bg-secondary/30">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm">{r.to_email}</div>
                    {r.to_name && <div className="text-xs text-muted-foreground">{r.to_name}</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">{r.subject}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{r.template_key ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    {r.status === "sent" ? (
                      <span className="rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">sent</span>
                    ) : (
                      <div>
                        <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5">failed</span>
                        {r.error && <div className="text-[10px] text-destructive/80 mt-1 max-w-md truncate" title={r.error}>{r.error}</div>}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between">
          <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}
            className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-50">← Previous</button>
          <div className="text-sm text-muted-foreground">
            {data?.total ? `${offset + 1}–${Math.min(offset + limit, data.total)} of ${data.total}` : "—"}
          </div>
          <button disabled={(data?.rows ?? []).length < limit} onClick={() => setOffset(offset + limit)}
            className="rounded-md border border-border/60 px-3 py-1.5 text-sm disabled:opacity-50">Next →</button>
        </div>
      </div>
    </>
  );
}
