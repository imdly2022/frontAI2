import { createFileRoute } from "@tanstack/react-router";
import { getModelsCatalog, getSiteSettings } from "@/lib/cms.functions";

type ModelRow = {
  id: string;
  slug: string;
  display_name: string;
  provider: string;
  category: string | null;
  context_length: number | null;
  input_price_per_1k: number | null;
  output_price_per_1k: number | null;
  cached_input_price_per_1k: number | null;
  vendor_input_price_per_1k: number | null;
  vendor_output_price_per_1k: number | null;
  vendor_cached_input_price_per_1k: number | null;
};

type LoaderData = { models: ModelRow[]; siteName: string };

export const Route = createFileRoute("/models")({
  head: () => ({
    meta: [
      { title: "Models — Official vs Our Price" },
      { name: "description", content: "Compare official vendor pricing vs ours. Save up to 80% on GPT, Claude, Gemini and 100+ models with one unified API key." },
      { property: "og:title", content: "Supported Models" },
      { property: "og:description", content: "Official vs our pricing — see the savings on every model." },
      { property: "og:url", content: "/models" },
    ],
    links: [{ rel: "canonical", href: "/models" }],
  }),
  loader: async (): Promise<LoaderData> => {
    const [models, settings] = await Promise.all([getModelsCatalog(), getSiteSettings()]);
    const siteName = (settings as { branding?: { name?: string } } | null)?.branding?.name ?? "Us";
    return { models: models as unknown as ModelRow[], siteName };
  },
  component: ModelsPage,
});

function fmt(p: number | null | undefined) {
  if (p == null) return null;
  const n = Number(p) * 1000; // stored per-1K, display per-1M
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function discountPct(ours: number | null, vendor: number | null) {
  if (ours == null || vendor == null || vendor <= 0 || ours >= vendor) return null;
  return Math.round(((vendor - ours) / vendor) * 100);
}

function PriceCompare({ label, ours, vendor, siteName }: { label: string; ours: number | null; vendor: number | null; siteName: string }) {
  const pct = discountPct(ours, vendor);
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-[11px] text-muted-foreground">Official</div>
          <div className={`font-mono text-sm ${pct ? "text-muted-foreground line-through" : ""}`}>
            {fmt(vendor) ?? "—"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-primary">{siteName}</div>
          <div className="font-mono text-base font-semibold text-foreground">{fmt(ours) ?? "—"}</div>
        </div>
      </div>
      {pct != null && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
          ↓ Save {pct}%
        </div>
      )}
    </div>
  );
}

function maxSavings(m: ModelRow) {
  const pcts = [
    discountPct(m.input_price_per_1k, m.vendor_input_price_per_1k),
    discountPct(m.output_price_per_1k, m.vendor_output_price_per_1k),
    discountPct(m.cached_input_price_per_1k, m.vendor_cached_input_price_per_1k),
  ].filter((x): x is number => x != null);
  return pcts.length ? Math.max(...pcts) : null;
}

function ModelsPage() {
  const { models, siteName } = Route.useLoaderData() as LoaderData;

  // Aggregate stats for hero
  const allPcts = models.map(maxSavings).filter((x): x is number => x != null);
  const avgSavings = allPcts.length ? Math.round(allPcts.reduce((a, b) => a + b, 0) / allPcts.length) : 0;
  const maxSave = allPcts.length ? Math.max(...allPcts) : 0;

  const byCategory: Record<string, ModelRow[]> = {};
  for (const m of models) {
    const k = (m.category ?? "Other").trim() || "Other";
    (byCategory[k] ||= []).push(m);
  }
  for (const k of Object.keys(byCategory)) {
    byCategory[k].sort((a, b) => (maxSavings(b) ?? -1) - (maxSavings(a) ?? -1));
  }
  const groups = Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b));

  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-success/20 bg-gradient-to-br from-success/10 via-card/40 to-card/20 px-8 py-14 text-center">
        <div className="absolute -top-20 -left-10 h-60 w-60 rounded-full bg-success/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-16 -right-10 h-60 w-60 rounded-full bg-primary/15 blur-3xl" aria-hidden />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
            Transparent pricing · Official vs {siteName}
          </div>
          <h1 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight">
            Same models. <span className="text-success">Up to {maxSave}% off</span>.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
            One key, every model. We negotiate volume rates with OpenAI, Anthropic, Google and more — and pass the savings to you.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 max-w-2xl mx-auto">
            <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur p-4">
              <div className="text-2xl md:text-3xl font-bold">{models.length}+</div>
              <div className="text-xs text-muted-foreground mt-1">Models supported</div>
            </div>
            <div className="rounded-2xl border border-success/30 bg-success/10 backdrop-blur p-4">
              <div className="text-2xl md:text-3xl font-bold text-success">{avgSavings}%</div>
              <div className="text-xs text-muted-foreground mt-1">Average savings</div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 backdrop-blur p-4">
              <div className="text-2xl md:text-3xl font-bold">{maxSave}%</div>
              <div className="text-xs text-muted-foreground mt-1">Biggest discount</div>
            </div>
          </div>
        </div>
      </section>

      {/* Group pills nav */}
      {groups.length > 1 && (
        <nav className="mt-10 flex flex-wrap gap-2 justify-center">
          {groups.map(([cat, list]) => (
            <a key={cat} href={`#group-${encodeURIComponent(cat)}`}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-4 py-1.5 text-sm font-medium hover:border-primary/40 hover:bg-primary/5 transition">
              {cat}
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </a>
          ))}
        </nav>
      )}

      {/* Categories */}
      <div className="mt-12 space-y-16">
        {groups.map(([cat, list]) => (
          <section key={cat} id={`group-${encodeURIComponent(cat)}`} className="scroll-mt-24">
            <div className="flex items-end justify-between mb-6 border-b border-border/40 pb-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium">Group</div>
                <h2 className="mt-1 text-2xl md:text-3xl font-semibold tracking-tight">{cat}</h2>
              </div>
              <span className="text-xs text-muted-foreground">{list.length} {list.length === 1 ? "model" : "models"}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {list.map((m) => {
                const save = maxSavings(m);
                return (
                  <div key={m.id} className="group rounded-3xl border border-border/60 bg-background p-5 transition hover:border-primary/40 hover:shadow-premium">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-lg truncate">{m.display_name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{m.provider}</span>
                          {m.context_length && <span>· {(m.context_length / 1000).toFixed(0)}K ctx</span>}
                        </div>
                        <div className="mt-1 font-mono text-[11px] text-muted-foreground/70 truncate">{m.slug}</div>
                      </div>
                      {save != null && (
                        <div className="shrink-0 rounded-full bg-success px-2.5 py-1 text-[11px] font-bold text-success-foreground shadow-sm">
                          −{save}%
                        </div>
                      )}
                    </div>
                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <PriceCompare label="Input / 1M" ours={m.input_price_per_1k} vendor={m.vendor_input_price_per_1k} siteName={siteName} />
                      <PriceCompare label="Output / 1M" ours={m.output_price_per_1k} vendor={m.vendor_output_price_per_1k} siteName={siteName} />
                      <PriceCompare label="Cached / 1M" ours={m.cached_input_price_per_1k} vendor={m.vendor_cached_input_price_per_1k} siteName={siteName} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-12 text-center">
        Prices in USD per 1,000 tokens. Official rates sourced from each vendor's public pricing page and updated regularly.
      </p>
    </main>
  );
}
