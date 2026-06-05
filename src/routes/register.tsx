import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { register } from "@/lib/auth.functions";
import { getSiteSettings } from "@/lib/cms.functions";
import { detectCountry } from "@/lib/profile.functions";
import { COUNTRIES, isBlockedCountry } from "@/lib/countries";

export const Route = createFileRoute("/register")({
  head: ({ loaderData }) => {
    const brand = (loaderData as { brand?: string } | undefined)?.brand ?? "Nova AI Relay";
    return {
      meta: [
        { title: `Create account — ${brand}` },
        { name: "description", content: `Sign up for ${brand} and get one API key for every major LLM provider.` },
        { name: "robots", content: "noindex" },
      ],
    };
  },
  loader: async () => {
    const settings = await getSiteSettings().catch(() => ({} as { branding?: { name?: string } }));
    return { brand: settings.branding?.name ?? "Nova AI Relay" };
  },
  component: RegisterPage,
});

function RegisterPage() {
  const registerFn = useServerFn(register);
  const detectFn = useServerFn(detectCountry);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [country, setCountry] = useState<string>("");
  const [accept, setAccept] = useState(false);

  const { data: geo } = useQuery({
    queryKey: ["detect-country"],
    queryFn: () => detectFn(),
    staleTime: Infinity,
  });

  useEffect(() => {
    if (geo?.country && !country) setCountry(geo.country);
  }, [geo, country]);

  const blockedByIP = geo?.blocked === true;
  const blockedByChoice = isBlockedCountry(country);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!accept) { toast.error("Please accept the Terms and Privacy Policy"); return; }
    if (blockedByIP || blockedByChoice) { toast.error("Registration is not available in your country."); return; }
    const fd = new FormData(e.currentTarget);
    setError(null);
    setLoading(true);
    try {
      await registerFn({
        data: {
          username: String(fd.get("username") ?? "").trim(),
          password: String(fd.get("password") ?? ""),
          email: String(fd.get("email") ?? "").trim(),
          first_name: String(fd.get("first_name") ?? "").trim(),
          last_name: String(fd.get("last_name") ?? "").trim(),
          country: country.toUpperCase(),
          phone: String(fd.get("phone") ?? "").trim() || undefined,
          accept_terms: true as const,
        },
      });
      toast.success("Account created. Please sign in.");
      navigate({ to: "/login" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Registration failed";
      setError(msg); toast.error(msg);
    } finally { setLoading(false); }
  }

  const inputCls = "mt-1 w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm";

  return (
    <main className="min-h-[70vh] grid place-items-center px-6 py-16">
      <Toaster richColors position="top-center" />
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center">Create your account</h1>
        <p className="text-sm text-muted-foreground text-center mt-1">Get an API key in 30 seconds.</p>

        {blockedByIP && (
          <div role="alert" className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Registration is not available from your location.
          </div>
        )}

        <form method="post" action="?_register" onSubmit={onSubmit} className="mt-6 space-y-4" autoComplete="on">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-first" className="text-sm font-medium">First name *</label>
              <input id="reg-first" name="first_name" required minLength={1} maxLength={80} autoComplete="given-name" className={inputCls} />
            </div>
            <div>
              <label htmlFor="reg-last" className="text-sm font-medium">Last name *</label>
              <input id="reg-last" name="last_name" required minLength={1} maxLength={80} autoComplete="family-name" className={inputCls} />
            </div>
          </div>
          <div>
            <label htmlFor="reg-username" className="text-sm font-medium">Username *</label>
            <input id="reg-username" name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_-]+" className={inputCls} />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium">Email *</label>
            <input id="reg-email" name="email" type="email" autoComplete="email" required className={inputCls} />
          </div>
          <div>
            <label htmlFor="reg-country" className="text-sm font-medium">
              Country * {geo?.country && <span className="text-xs text-muted-foreground">(detected: {geo.country})</span>}
            </label>
            <select
              id="reg-country" name="country" required
              value={country} onChange={(e) => setCountry(e.target.value)}
              className={inputCls}
            >
              <option value="">— Select your country —</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code} disabled={isBlockedCountry(c.code)}>
                  {c.name} {isBlockedCountry(c.code) ? "(not supported)" : ""}
                </option>
              ))}
            </select>
            {blockedByChoice && (
              <p className="mt-1 text-xs text-destructive">Registration is not available in this country.</p>
            )}
          </div>
          <div>
            <label htmlFor="reg-phone" className="text-sm font-medium">Phone <span className="text-muted-foreground">(optional)</span></label>
            <input id="reg-phone" name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="+1 555 1234" className={inputCls} />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium">Password *</label>
            <input id="reg-password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={128} className={inputCls} />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
            <span>
              I agree to the <Link to="/legal/terms" className="text-primary hover:underline">Terms of Service</Link>{" "}
              and <Link to="/legal/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
            </span>
          </label>

          {error && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <button type="submit" disabled={loading || blockedByIP || blockedByChoice || !accept}
            className="w-full rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="text-center text-sm text-muted-foreground mt-6">
          Have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
