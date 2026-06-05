import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { COUNTRIES, isBlockedCountry } from "@/lib/countries";

export const Route = createFileRoute("/app/settings")({
  loader: ({ context }) =>
    context.queryClient.ensureQueryData({ queryKey: ["my-profile"], queryFn: () => getMyProfile() }),
  component: SettingsPage,
});

function SettingsPage() {
  const getFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const qc = useQueryClient();
  const { data: p } = useQuery({ queryKey: ["my-profile"], queryFn: () => getFn() });

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [display, setDisplay] = useState("");
  const [country, setCountry] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (!p) return;
    setFirst(p.first_name ?? "");
    setLast(p.last_name ?? "");
    setDisplay(p.display_name ?? "");
    setCountry(p.country ?? "");
    setPhone(p.phone ?? "");
  }, [p]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: {
      first_name: first.trim(), last_name: last.trim(), display_name: display.trim(),
      country: country || null, phone: phone.trim() || null,
    } }),
    onSuccess: () => { toast.success("Profile saved"); qc.invalidateQueries({ queryKey: ["my-profile"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const inputCls = "mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm";

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <Toaster richColors position="top-center" />
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-violet-500/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-violet-500/15 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="text-xs font-medium uppercase tracking-wider text-violet-500/90">Profile</div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Account settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your profile details and contact info.</p>
        </div>
      </header>

      <section className="rounded-xl border border-border/60 bg-card/40 p-6 space-y-4">
        <Row label="Username" value={p?.username ?? "—"} />
        <Row label="Email" value={p?.email ?? "—"} />
        <Row label="User ID" value={p?.newapi_user_id?.toString() ?? "—"} mono />
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-6">
        <h2 className="text-base font-semibold mb-4">Personal information</h2>
        <form
          onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">First name</label>
              <input value={first} onChange={(e) => setFirst(e.target.value)} maxLength={80} className={inputCls} />
            </div>
            <div>
              <label className="text-sm font-medium">Last name</label>
              <input value={last} onChange={(e) => setLast(e.target.value)} maxLength={80} className={inputCls} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Display name</label>
            <input value={display} onChange={(e) => setDisplay(e.target.value)} maxLength={80} className={inputCls} />
          </div>
          <div>
            <label className="text-sm font-medium">Country</label>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={inputCls}>
              <option value="">— Select —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} disabled={isBlockedCountry(c.code)}>
                  {c.name}{isBlockedCountry(c.code) ? " (not supported)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} className={inputCls} />
          </div>
          <button type="submit" disabled={save.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border/60 bg-card/40 p-6">
        <h2 className="text-sm font-medium mb-3">API endpoint</h2>
        <p className="text-sm text-muted-foreground mb-3">Point your OpenAI SDK at this base URL using your API key from the Keys page:</p>
        <code className="block rounded-md bg-background/60 p-3 font-mono text-xs">https://ai.x1x.pw/v1</code>
      </section>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono" : "font-medium"}>{value}</span>
    </div>
  );
}
