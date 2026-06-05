import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { adminTestNewApi } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";
import { CheckCircle2, XCircle, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/admin/newapi")({
  head: () => ({ meta: [{ title: "New API — Admin" }, { name: "robots", content: "noindex" }] }),
  component: NewApiAdmin,
});

function NewApiAdmin() {
  const testFn = useServerFn(adminTestNewApi);
  const { data, isFetching, refetch } = useQuery({ queryKey: ["admin", "newapi-test"], queryFn: () => testFn() });

  return (
    <>
      <AdminHeader title="New API connector" description="Status of the backing New API gateway." />
      <div className="p-8 space-y-6 max-w-2xl">
        <section className="rounded-lg border border-border/60 bg-card/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold">Connection status</div>
              <div className="text-xs text-muted-foreground mt-1">Calls <code className="font-mono">GET /api/status</code> on the configured base URL.</div>
            </div>
            <button onClick={() => refetch()} className="inline-flex items-center gap-2 rounded-md border border-input bg-background/50 px-3 py-1.5 text-sm">
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Retest
            </button>
          </div>
          <div className="mt-4 text-sm flex items-center gap-2">
            {isFetching ? "Checking…" : data?.ok ? (
              <><CheckCircle2 className="h-4 w-4 text-success" /> Connected · version {data.version}</>
            ) : (
              <><XCircle className="h-4 w-4 text-destructive" /> {data?.error ?? "Not connected"}</>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border/60 bg-card/40 p-5 text-sm space-y-2">
          <div className="font-semibold">Configuration</div>
          <p className="text-muted-foreground">
            Base URL is read from the <code className="font-mono">NEWAPI_BASE_URL</code> env first, then from
            <code className="font-mono"> site_settings.newapi.baseUrl</code> (editable in Site &amp; SEO).
          </p>
          <p className="text-muted-foreground">
            Admin token is the secret <code className="font-mono">NEWAPI_ADMIN_TOKEN</code> — never exposed to the browser.
          </p>
        </section>
      </div>
    </>
  );
}
