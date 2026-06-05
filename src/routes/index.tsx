import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Code2, Globe, Shield, Zap } from "lucide-react";
import { getSiteSettings, getModelsCatalog, getPricingPlans } from "@/lib/cms.functions";
import { trackClick } from "@/lib/affiliate.functions";
import type { ModelRow as BaseModelRow, PlanRow, SiteSettings } from "@/lib/cms-types";

type ModelRow = BaseModelRow & {
  cached_input_price_per_1k?: number | null;
  vendor_input_price_per_1k?: number | null;
  vendor_output_price_per_1k?: number | null;
  vendor_cached_input_price_per_1k?: number | null;
  is_featured?: boolean;
};

function discountPct(ours?: number | null, vendor?: number | null) {
  if (ours == null || vendor == null || vendor <= 0 || ours >= vendor) return null;
  return Math.round(((vendor - ours) / vendor) * 100);
}
function maxSavings(m: ModelRow) {
  const pcts = [
    discountPct(m.input_price_per_1k, m.vendor_input_price_per_1k),
    discountPct(m.output_price_per_1k, m.vendor_output_price_per_1k),
    discountPct(m.cached_input_price_per_1k, m.vendor_cached_input_price_per_1k),
  ].filter((x): x is number => x != null);
  return pcts.length ? Math.max(...pcts) : null;
}
function fmt(p?: number | null) {
  if (p == null) return null;
  const n = Number(p) * 1000; // stored per-1K, display per-1M
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export const Route = createFileRoute("/")({
  head: ({ loaderData }) => {
    const data = loaderData as { settings?: SiteSettings; plans?: PlanRow[] } | undefined;
    const settings = data?.settings ?? {};
    const plans = data?.plans ?? [];
    const brand = settings.branding?.name ?? "Nova AI Relay";
    const tagline = settings.branding?.tagline ?? "One API. Every Model.";
    const title = `${brand} — ${tagline}`;
    const desc = settings.seo?.defaultDescription
      ?? "OpenAI-compatible gateway to GPT, Claude, Gemini, DeepSeek and more. Unified billing, one key, pay per token.";
    const faqItems = (settings.faq?.items ?? []).filter((it) => it?.question && it?.answer);

    const scripts: Array<{ type: string; children: string }> = [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: brand,
          description: desc,
          url: "/",
          ...(settings.contact?.email ? { email: settings.contact.email } : {}),
        }),
      },
    ];
    if (plans.length > 0) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${brand} credit packs`,
          itemListElement: plans.map((p, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Product",
              name: p.name,
              description: p.description ?? `${p.credits} credits`,
              offers: { "@type": "Offer", price: String(p.price_usd), priceCurrency: "USD", availability: "https://schema.org/InStock" },
            },
          })),
        }),
      });
    }
    if (faqItems.length > 0) {
      scripts.push({
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqItems.map((it) => ({
            "@type": "Question",
            name: it.question,
            acceptedAnswer: { "@type": "Answer", text: it.answer },
          })),
        }),
      });
    }
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:url", content: "/" },
      ],
      links: [{ rel: "canonical", href: "/" }],
      scripts,
    };
  },
  loader: async (): Promise<{ settings: SiteSettings; models: ModelRow[]; plans: PlanRow[] }> => {
    const [settings, models, plans] = await Promise.all([
      getSiteSettings(),
      getModelsCatalog(),
      getPricingPlans(),
    ]);
    return { settings: settings as SiteSettings, models: models as ModelRow[], plans: plans as PlanRow[] };
  },
  component: HomePage,
});

function HomePage() {
  const { settings, models, plans } = Route.useLoaderData() as { settings: SiteSettings; models: ModelRow[]; plans: PlanRow[] };
  const track = useServerFn(trackClick);

  // Capture ?ref=SLUG&sub1=... for affiliate attribution on first visit.
  useEffect(() => {
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("ref");
    if (!ref) return;
    track({
      data: {
        ref,
        sub1: url.searchParams.get("sub1") ?? undefined,
        sub2: url.searchParams.get("sub2") ?? undefined,
        sub3: url.searchParams.get("sub3") ?? undefined,
        sub4: url.searchParams.get("sub4") ?? undefined,
        sub5: url.searchParams.get("sub5") ?? undefined,
        landing: url.pathname,
      },
    }).catch(() => {});
  }, [track]);

  const hero = settings.hero;
  const providers = Array.from(new Set(models.map((m) => m.provider))).slice(0, 12);
  return (
    <main>
      {/* ============ HERO ============ */}
      <section className="aurora-bg relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-70" aria-hidden />
        <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-[#0071e3]/25 blur-3xl animate-float" aria-hidden />
        <div className="absolute top-10 right-0 h-80 w-80 rounded-full bg-[#ff5fa2]/20 blur-3xl animate-float" style={{ animationDelay: "2s" }} aria-hidden />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7b5cff]/20 blur-3xl animate-float" style={{ animationDelay: "4s" }} aria-hidden />

        <div className="relative mx-auto max-w-6xl px-6 pt-28 pb-24 md:pt-36 md:pb-32 text-center fade-up">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-xs text-foreground/70 mb-8 shadow-sm backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            OpenAI-compatible · {models.length}+ models live
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[88px] font-semibold tracking-[-0.04em] leading-[0.98]">
            <span className="block">{hero?.headline ?? "All the world's AI."}</span>
            <span className="block text-gradient">One endpoint.</span>
          </h1>
          <p className="mt-7 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {hero?.subheadline ?? "OpenAI-compatible gateway to GPT, Claude, Gemini, DeepSeek and 100+ models. One key, unified billing, pay per token."}
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register" className="btn-gradient inline-flex items-center gap-2">
              {hero?.ctaPrimary ?? "Get your API key"}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/pricing" className="btn-pill border border-border bg-white/70 backdrop-blur hover:bg-white">
              {hero?.ctaSecondary ?? "View pricing"}
            </Link>
          </div>

          {/* Terminal preview */}
          <div className="mt-16 max-w-3xl mx-auto text-left">
            <div className="glass-card overflow-hidden">
              <div className="flex items-center gap-1.5 border-b border-border/60 px-4 py-3">
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-xs text-muted-foreground font-mono">~ curl novagate.ai</span>
              </div>
              <pre className="px-5 py-5 overflow-x-auto text-[13px] leading-relaxed font-mono"><code>
{`$ curl https://api.novagate.ai/v1/chat/completions \\
  -H "Authorization: Bearer $NOVAGATE_KEY" \\
  -d '{"model":"gpt-5","messages":[{"role":"user","content":"Hi"}]}'`}
              </code></pre>
            </div>
          </div>

          {/* Stat strip */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto">
            {[
              { k: `${models.length}+`, v: "Models" },
              { k: "99.99%", v: "Uptime SLA" },
              { k: "<120ms", v: "Edge routing" },
              { k: "1", v: "Unified bill" },
            ].map((s) => (
              <div key={s.v}>
                <div className="text-2xl md:text-3xl font-semibold tracking-tight">{s.k}</div>
                <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ PROVIDER MARQUEE ============ */}
      {providers.length > 0 && (
        <section className="border-y border-border/60 bg-white/60 backdrop-blur overflow-hidden">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <div className="text-center text-xs uppercase tracking-[0.2em] text-muted-foreground mb-5">
              Powered by the labs you trust
            </div>
            <div className="relative overflow-hidden" style={{ maskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, #000 10%, #000 90%, transparent)" }}>
              <div className="flex w-max gap-10 animate-marquee">
                {[...providers, ...providers].map((p, i) => (
                  <span key={i} className="text-lg md:text-xl font-semibold text-foreground/70 whitespace-nowrap">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============ SAVINGS COMPARISON (moved up — lead with price) ============ */}
      {(() => {
        const ranked = [...models]
          .map((m) => ({ m, save: maxSavings(m) }))
          .filter((x) => x.save != null) as { m: ModelRow; save: number }[];
        ranked.sort((a, b) => b.save - a.save);
        const featuredFlagged = ranked.filter((x) => x.m.is_featured);
        const featured = (featuredFlagged.length > 0 ? featuredFlagged : ranked).slice(0, 6);
        const all = models.map(maxSavings).filter((x): x is number => x != null);
        const avg = all.length ? Math.round(all.reduce((a, b) => a + b, 0) / all.length) : 0;
        const top = all.length ? Math.max(...all) : 0;
        return (
          <section className="relative border-b border-border/60 bg-gradient-to-b from-secondary/30 to-transparent">
            <div className="mx-auto max-w-6xl px-6 py-24">
              <div className="text-center max-w-2xl mx-auto mb-12">
                <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/5 px-3 py-1 text-xs font-medium text-success">
                  Official vs {settings.branding?.name ?? "us"} · transparent pricing
                </div>
                <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mt-4">
                  Same models. <span className="text-success">Up to {top}% off.</span>
                </h2>
                <p className="text-muted-foreground mt-3 text-lg">
                  We negotiate volume rates with every major lab and pass the savings to you. Average <span className="font-semibold text-success">{avg}% cheaper</span> than going direct — same weights, same outputs, lower bill.
                </p>
              </div>

              {featured.length > 0 && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map(({ m, save }) => (
                    <div key={m.id} className="glass-card p-6 hover:-translate-y-1 transition-all duration-300">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{m.provider}</div>
                          <div className="font-semibold text-base mt-1 truncate">{m.display_name}</div>
                        </div>
                        <div className="shrink-0 rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-success-foreground shadow-sm">
                          −{save}%
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Input / 1M</div>
                          <div className="mt-1.5 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground line-through">{fmt(m.vendor_input_price_per_1k) ?? "—"}</span>
                            <span className="font-mono text-sm font-semibold">{fmt(m.input_price_per_1k) ?? "—"}</span>
                          </div>
                        </div>
                        <div className="rounded-xl border border-border/60 bg-card/40 p-3">
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Output / 1M</div>
                          <div className="mt-1.5 flex items-baseline justify-between gap-2">
                            <span className="font-mono text-[11px] text-muted-foreground line-through">{fmt(m.vendor_output_price_per_1k) ?? "—"}</span>
                            <span className="font-mono text-sm font-semibold">{fmt(m.output_price_per_1k) ?? "—"}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center mt-10">
                <Link to="/models" className="btn-pill border border-border bg-white/70 backdrop-blur hover:bg-white inline-flex items-center gap-2">
                  Compare all {models.length}+ models <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
        );
      })()}

      {/* ============ FEATURES ============ */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">Built for production</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mt-3">Lower bill. Higher uptime.</h2>
          <p className="text-muted-foreground mt-4 text-lg">Swap one base URL — keep your SDK, keep your code, cut the cost.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: Code2, title: "Up to 50% cheaper", body: "Volume rates with every major lab, passed straight to you. Transparent per-token pricing — no surprise invoices." },
            { icon: Shield, title: "99.99% uptime SLA", body: "Multi-region failover and automatic provider rerouting. If one lab is degraded, your requests still complete." },
            { icon: Globe, title: "Every major model", body: "GPT-5, Claude, Gemini, DeepSeek, Llama, Mistral — added the day they launch. One unified API, one bill." },
          ].map((f) => (
            <div key={f.title} className="glass-card p-7 hover:-translate-y-1 transition-transform duration-300">
              <div className="h-12 w-12 grid place-items-center rounded-2xl mb-5"
                   style={{ background: "var(--gradient-primary)", color: "#fff", boxShadow: "var(--shadow-glow)" }}>
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>


      {/* ============ PRICING ============ */}
      <section className="mx-auto max-w-6xl px-6 py-28">
        <div className="text-center mb-14">
          <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">Pricing</div>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mt-3">Pay as you go.</h2>
          <p className="text-muted-foreground mt-3 text-lg">Top up credits. They never expire.</p>
        </div>
        <div className="grid gap-5 md:grid-cols-4">
          {plans.map((p) => (
            <div key={p.id}
                 className={`relative glass-card p-7 transition-all duration-300 hover:-translate-y-1 ${p.is_popular ? "ring-2 ring-primary/60 shadow-[var(--shadow-glow)]" : ""}`}>
              {p.is_popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider px-3 py-1 rounded-full text-white"
                     style={{ background: "var(--gradient-primary)" }}>Most popular</div>
              )}
              <div className="font-medium text-foreground/80">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">${Number(p.price_usd)}</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {Number(p.credits)} credits {Number(p.bonus_credits) > 0 && `+ ${Number(p.bonus_credits)} bonus`}
              </div>
              <p className="text-sm text-muted-foreground mt-4 min-h-[42px]">{p.description}</p>
              <Link to="/register"
                    className={`mt-6 inline-flex w-full items-center justify-center rounded-full px-3 py-2.5 text-sm font-medium transition ${p.is_popular ? "text-white" : "bg-foreground text-background hover:opacity-90"}`}
                    style={p.is_popular ? { background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" } : undefined}>
                Start with {p.name}
              </Link>
            </div>
          ))}
        </div>
        <div className="text-center mt-10">
          <Link to="/pricing" className="text-sm text-primary hover:underline">See full pricing details →</Link>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      {(() => {
        const faqItems = (settings.faq?.items ?? []).filter((it) => it?.question && it?.answer);
        if (faqItems.length === 0) return null;
        return (
          <section className="mx-auto max-w-3xl px-6 py-20">
            <div className="text-center mb-12">
              <div className="text-xs uppercase tracking-[0.2em] text-primary font-medium">FAQ</div>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mt-3">Questions, answered.</h2>
            </div>
            <div className="space-y-3">
              {faqItems.map((it, i) => (
                <details key={i} className="group glass-card p-6 [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex items-center justify-between cursor-pointer list-none gap-4">
                    <span className="font-medium text-base">{it.question}</span>
                    <span className="text-muted-foreground text-2xl leading-none transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-4 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{it.answer}</p>
                </details>
              ))}
            </div>
          </section>
        );
      })()}


      {/* ============ CTA ============ */}
      <section className="mx-auto max-w-5xl px-6 pb-28">
        <div className="relative overflow-hidden rounded-[28px] p-12 md:p-16 text-center"
             style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
          <div className="absolute inset-0 opacity-30"
               style={{ background: "radial-gradient(ellipse at top, rgba(255,255,255,0.5), transparent 60%)" }} />
          <div className="relative">
            <div className="inline-grid place-items-center h-14 w-14 rounded-2xl bg-white/20 backdrop-blur ring-1 ring-white/40 mb-6">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <h3 className="text-4xl md:text-5xl font-semibold tracking-tight text-white">Ship today.</h3>
            <p className="text-white/85 mt-3 text-lg">Create an account and get an API key in 30 seconds.</p>
            <Link to="/register" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-medium text-foreground hover:bg-white/95 shadow-lg">
              Get started <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
