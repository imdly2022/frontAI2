import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Send } from "lucide-react";
import { AdminHeader } from "@/components/admin/AdminShell";
import {
  adminGetEmailSettings,
  adminSaveEmailSettings,
  adminSendTestEmail,
} from "@/lib/admin.email.functions";

export const Route = createFileRoute("/admin/email")({
  head: () => ({ meta: [{ title: "Email Settings — Admin" }] }),
  component: AdminEmailSettingsPage,
});

function AdminEmailSettingsPage() {
  const getFn = useServerFn(adminGetEmailSettings);
  const saveFn = useServerFn(adminSaveEmailSettings);
  const testFn = useServerFn(adminSendTestEmail);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-email-settings"],
    queryFn: () => getFn(),
  });

  const [enabled, setEnabled] = useState(true);
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testTo, setTestTo] = useState("");

  useEffect(() => {
    if (!data) return;
    setEnabled(data.enabled);
    setFromEmail(data.from_email);
    setFromName(data.from_name);
    setReplyTo(data.reply_to ?? "");
    setApiUrl(data.api_url ?? "");
    setApiKey(""); // never prefill the actual key
  }, [data]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      enabled, from_email: fromEmail, from_name: fromName,
      reply_to: replyTo || null,
      api_url: apiUrl || null,
      api_key: apiKey, // "" means keep existing
    } }),
    onSuccess: () => { toast.success("Email settings saved"); refetch(); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const test = useMutation({
    mutationFn: () => testFn({ data: { to: testTo } }),
    onSuccess: (r) => r.ok ? toast.success("Test email sent — check inbox") : toast.error("Test failed — check Send Log"),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Send failed"),
  });

  const fieldCls = "mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
  const labelCls = "text-sm font-medium";

  return (
    <>
      <Toaster richColors position="top-center" />
      <AdminHeader title="Email Settings" description="Configure how outbound emails are sent (ZeptoMail API)." />
      <div className="p-8 max-w-2xl space-y-8">
        {isLoading ? (
          <div className="text-muted-foreground">Loading…</div>
        ) : (
          <>
            <div className="rounded-lg border border-border/60 bg-card p-6 space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-input" />
                <span className="text-sm">Email sending enabled</span>
              </label>
              <div>
                <label className={labelCls} htmlFor="from-email">From email</label>
                <input id="from-email" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="noreply@yourdomain.com" className={fieldCls} />
                <p className="text-xs text-muted-foreground mt-1">Must be a verified sender in ZeptoMail.</p>
              </div>
              <div>
                <label className={labelCls} htmlFor="from-name">From name</label>
                <input id="from-name" type="text" value={fromName} onChange={(e) => setFromName(e.target.value)}
                  placeholder="NovaRelay" className={fieldCls} />
              </div>
              <div>
                <label className={labelCls} htmlFor="reply-to">Reply-to (optional)</label>
                <input id="reply-to" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)}
                  placeholder="support@yourdomain.com" className={fieldCls} />
              </div>

              <div className="pt-4 border-t border-border/60">
                <h3 className="text-sm font-semibold mb-3">ZeptoMail API</h3>
                <div className="space-y-4">
                  <div>
                    <label className={labelCls} htmlFor="api-url">API Endpoint</label>
                    <input id="api-url" type="url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)}
                      placeholder="https://api.zeptomail.com/v1.1/email" className={fieldCls} />
                    <p className="text-xs text-muted-foreground mt-1">
                      Default: <code className="font-mono">https://api.zeptomail.com/v1.1/email</code>.
                      Use <code className="font-mono">api.zeptomail.eu</code> for EU region.
                    </p>
                  </div>
                  <div>
                    <label className={labelCls} htmlFor="api-key">API Key (Send Mail Token)</label>
                    <input id="api-key" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
                      placeholder={data?.api_key_set ? `Current: ${data.api_key_masked} (leave empty to keep)` : "Paste your ZeptoMail Send Mail token"}
                      autoComplete="off" className={fieldCls} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {data?.api_key_set
                        ? "A key is saved. Leave blank to keep it; paste a new value to replace."
                        : data?.env_key_set
                          ? "Using ZEPTOMAIL_API_KEY from environment. Override here if needed."
                          : "No key configured. Paste your token here — sends will fail until set."}
                      {" "}Do NOT include the <code className="font-mono">Zoho-enczapikey</code> prefix.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button onClick={() => save.mutate()} disabled={save.isPending}
                  className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-60">
                  {save.isPending ? "Saving…" : "Save settings"}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border/60 bg-card p-6">
              <h2 className="text-base font-semibold mb-1">Send a test email</h2>
              <p className="text-xs text-muted-foreground mb-4">Verifies your ZeptoMail API key and sender setup.</p>
              <div className="flex gap-2">
                <input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                  placeholder="you@example.com" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <button onClick={() => test.mutate()} disabled={!testTo || test.isPending}
                  className="inline-flex items-center gap-1.5 rounded-md bg-foreground text-background px-4 py-2 text-sm font-medium disabled:opacity-60">
                  <Send className="h-4 w-4" /> {test.isPending ? "Sending…" : "Send test"}
                </button>
              </div>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>The API key set above is stored in the database and takes precedence over the <code className="font-mono">ZEPTOMAIL_API_KEY</code> environment variable.</p>
              <p>If you're deploying to Cloudflare Workers / Vercel, setting it here avoids having to configure secrets in the hosting dashboard.</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
