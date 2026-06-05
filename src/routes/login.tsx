import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Toaster } from "sonner";
import { login } from "@/lib/auth.functions";
import { getSiteSettings } from "@/lib/cms.functions";

export const Route = createFileRoute("/login")({
  head: ({ loaderData }) => {
    const brand = (loaderData as { brand?: string } | undefined)?.brand ?? "Nova AI Relay";
    return {
      meta: [
        { title: `Sign in — ${brand}` },
        { name: "description", content: `Sign in to your ${brand} account to manage API keys, billing and usage.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  loader: async () => {
    const settings = await getSiteSettings().catch(() => ({} as { branding?: { name?: string } }));
    return { brand: settings.branding?.name ?? "Nova AI Relay" };
  },
  component: LoginPage,
});

function LoginPage() {
  const loginFn = useServerFn(login);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!accept) { toast.error("Please accept the Terms and Privacy Policy"); return; }
    const fd = new FormData(e.currentTarget);
    setError(null);
    setLoading(true);
    try {
      await loginFn({
        data: {
          username: String(fd.get("username") ?? "").trim(),
          password: String(fd.get("password") ?? ""),
        },
      });
      toast.success("Welcome back");
      navigate({ to: "/app" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-[70vh] grid place-items-center px-6 py-16">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center">Sign in</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Welcome back to {Route.useLoaderData().brand}.</p>
        {/* method="post" prevents accidental GET submit before JS hydration —
            otherwise the password ends up in the URL query string. */}
        <form method="post" action="?_login" onSubmit={onSubmit} className="mt-8 space-y-4" autoComplete="on">
          <div>
            <label htmlFor="login-username" className="text-sm font-medium">Username</label>
            <input
              id="login-username"
              name="username"
              autoComplete="username"
              required
              minLength={1}
              maxLength={64}
              className="mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium">Password</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              maxLength={128}
              className="mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
            <span>
              I agree to the <Link to="/legal/terms" className="text-primary hover:underline">Terms</Link>{" "}
              and <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>
          {error && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || !accept}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          No account? <Link to="/register" className="text-primary hover:underline">Create one</Link>
        </p>
      </div>
    </main>
  );
}
