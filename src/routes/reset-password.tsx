import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { z } from "zod";
import { verifyPasswordReset } from "@/lib/profile.functions";

const searchSchema = z.object({ email: z.string().email().optional() });

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password" },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s) => searchSchema.parse(s),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { email: initialEmail } = Route.useSearch();
  const verifyFn = useServerFn(verifyPasswordReset);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyFn({ data: { email: email.trim(), code: code.trim(), new_password: pw } });
      toast.success("Password reset. Please sign in.");
      navigate({ to: "/login" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setLoading(false);
    }
  }

  const inputCls = "mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm";

  return (
    <main className="min-h-[70vh] grid place-items-center px-6 py-16">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Reset password</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Enter the 6-digit code we emailed you and choose a new password.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="rp-email" className="text-sm font-medium">Email</label>
            <input id="rp-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="rp-code" className="text-sm font-medium">6-digit code</label>
            <input id="rp-code" inputMode="numeric" pattern="\d{6}" maxLength={6} required
              value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={inputCls + " tracking-widest font-mono"} />
          </div>
          <div>
            <label htmlFor="rp-pw" className="text-sm font-medium">New password</label>
            <input id="rp-pw" type="password" minLength={8} maxLength={128} required
              value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Resetting…" : "Reset password"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Didn't receive a code? <Link to="/forgot-password" className="text-primary hover:underline">Send again</Link>
        </p>
      </div>
    </main>
  );
}
