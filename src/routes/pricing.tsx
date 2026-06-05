import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { getPricingPlans, getSiteSettings } from "@/lib/cms.functions";
import type { PlanRow } from "@/lib/cms-types";

export const Route = createFileRoute("/pricing")({
  head: ({ loaderData }) => {
    const data = loaderData as { plans: PlanRow[]; brand: string } | undefined;
    const brand = data?.brand ?? "Nova AI Relay";
    const title = `Pay as you go — ${brand}`;
    return {
      meta: [
        { title },
        { name: "description", content: "Pay-as-you-go credits for every AI model. Buy in bulk, never expire." },
        { property: "og:title", content: title },
        { property: "og:description", content: "Credit packs for GPT, Claude, Gemini and 100+ models." },
        { property: "og:url", content: "/pricing" },
      ],
      links: [{ rel: "canonical", href: "/pricing" }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${brand} credit packs`,
          itemListElement: (data?.plans ?? []).map((p, i) => ({
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
      }],
    };
  },
  loader: async (): Promise<{ plans: PlanRow[]; brand: string }> => {
    const [plans, settings] = await Promise.all([
      getPricingPlans(),
      getSiteSettings().catch(() => ({} as { branding?: { name?: string } })),
    ]);
    return { plans: plans as PlanRow[], brand: settings.branding?.name ?? "Nova AI Relay" };
  },
  component: PricingPage,
});

function PricingPage() {
  const { plans } = Route.useLoaderData() as { plans: PlanRow[]; brand: string };
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Pay as you go</h1>
        <p className="text-muted-foreground mt-3 max-w-xl mx-auto">Top up credits. Spend them on any model. Never expires.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-4 mt-14">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-xl border p-6 flex flex-col ${p.is_popular ? "border-primary bg-accent/30" : "border-border/60 bg-card/40"}`}>
            {p.is_popular && <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">Most popular</div>}
            <div className="font-semibold text-lg">{p.name}</div>
            <div className="mt-4 text-4xl font-bold">${Number(p.price_usd)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              {Number(p.credits)} credits {Number(p.bonus_credits) > 0 && <span className="text-success">+ {Number(p.bonus_credits)} bonus</span>}
            </div>
            <p className="text-sm text-muted-foreground mt-4 flex-1">{p.description}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {["All models", "Per-key limits", "Usage analytics", p.is_popular ? "Priority routing" : "Email support"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-muted-foreground"><Check className="h-4 w-4 text-success" />{f}</li>
              ))}
            </ul>
            <Link to="/register" className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              Get {p.name}
            </Link>
          </div>
        ))}
      </div>
    </main>
  );
}
