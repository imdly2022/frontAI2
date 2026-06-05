import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gift } from "lucide-react";
import { redeemCode } from "@/lib/console.functions";

export const Route = createFileRoute("/app/redeem")({
  component: RedeemPage,
});

function RedeemPage() {
  const fn = useServerFn(redeemCode);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const res = await fn({ data: { key: code.trim() } });
      setResult({ ok: true, msg: `+$${res.added_usd.toFixed(2)} added to your balance.` });
      setCode("");
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).message });
    } finally { setLoading(false); }
  }

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-pink-500/10 via-card/40 to-card/20 p-6">
        <div className="absolute -right-20 -top-20 h-60 w-60 rounded-full bg-pink-500/15 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-pink-500/90">
            <Gift className="h-3.5 w-3.5" /> Redeem
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Redeem a code</h1>
          <p className="text-sm text-muted-foreground mt-1">Got a promo or gift code? Enter it here to add credit.</p>
        </div>
      </header>

      <form onSubmit={submit} className="rounded-xl border border-border/60 bg-card/40 p-6 space-y-4">
        <label className="block text-sm">
          <span className="text-muted-foreground">Redemption code</span>
          <input value={code} onChange={(e) => setCode(e.target.value)} required minLength={4}
            placeholder="XXXX-XXXX-XXXX"
            className="mt-1 w-full rounded-md border border-border/60 bg-background px-3 py-2.5 text-sm font-mono tracking-wider focus:outline-none focus:border-primary" />
        </label>
        {result && (
          <div className={`text-sm rounded-md p-3 ${result.ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
            {result.msg}
          </div>
        )}
        <button disabled={loading || code.length < 4}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
          <Gift className="h-4 w-4" /> {loading ? "Redeeming…" : "Redeem"}
        </button>
      </form>
    </div>
  );
}
