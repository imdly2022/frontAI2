import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast, Toaster } from "sonner";
import { requestPasswordReset } from "@/lib/profile.functions";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const sendFn = useServerFn(requestPasswordReset);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    try {
      await sendFn({ data: { email: email.trim() } });
      toast.success("If that email exists, a code has been sent.");
      navigate({ to: "/reset-password", search: { email: email.trim() } as never });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] grid place-items-center px-6 py-16">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Forgot password</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">
          We'll email you a 6-digit code to reset your password.
        </p>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="fp-email" className="text-sm font-medium">Email</label>
            <input
              id="fp-email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Sending…" : "Send reset code"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Remembered it? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
