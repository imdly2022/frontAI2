import { createFileRoute, Link } from "@tanstack/react-router";
import { getDocsIndex, getDocsGroups, getSiteSettings } from "@/lib/cms.functions";

type DocEntry = {
  slug: string;
  title: string;
  description: string | null;
  category: string | null;
  sort_order: number;
};
type Group = { id: string; slug: string; name: string; description: string | null; sort_order: number };

export const Route = createFileRoute("/docs/")({
  head: ({ loaderData }) => {
    const brand = (loaderData as { brand?: string } | undefined)?.brand ?? "Nova AI Relay";
    return {
      meta: [
        { title: `Docs — ${brand}` },
        { name: "description", content: "API documentation, quickstarts and guides." },
        { property: "og:title", content: `Documentation — ${brand}` },
        { property: "og:description", content: "API reference, quickstarts and guides." },
        { property: "og:url", content: "/docs" },
      ],
      links: [{ rel: "canonical", href: "/docs" }],
    };
  },
  loader: async () => {
    const [docs, groups, settings] = await Promise.all([
      getDocsIndex(),
      getDocsGroups(),
      getSiteSettings().catch(() => ({} as { branding?: { name?: string } })),
    ]);
    return {
      docs: docs as DocEntry[],
      groups: groups as Group[],
      brand: settings.branding?.name ?? "Nova AI Relay",
    };
  },
  component: DocsOverview,
});

function DocsOverview() {
  const data = Route.useLoaderData() as {
    docs: DocEntry[];
    groups: Group[];
  };
  const { docs, groups } = data;
  const groupBySlug = new Map<string, Group>(groups.map((g) => [g.slug, g]));
  const buckets = new Map<string, { group: Group | null; items: DocEntry[] }>();
  for (const g of groups) buckets.set(g.slug, { group: g, items: [] });
  for (const d of docs) {
    const key = d.category && groupBySlug.has(d.category) ? d.category : "__other";
    if (!buckets.has(key)) {
      buckets.set(key, { group: key === "__other" ? null : (groupBySlug.get(key) ?? null), items: [] });
    }
    buckets.get(key)!.items.push(d);
  }
  const sections = Array.from(buckets.values()).filter((b) => b.items.length > 0);

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-semibold tracking-tight">Documentation</h1>
      <p className="text-muted-foreground mt-3 text-lg">
        Browse guides, references and quickstarts. Pick a topic from the menu on the left.
      </p>

      <div className="mt-12 space-y-10">
        {sections.map((s, i) => (
          <section key={s.group?.slug ?? `__other-${i}`}>
            <h2 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
              {s.group?.name ?? "Other"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {s.items.map((d) => (
                <Link
                  key={d.slug}
                  to="/docs/$slug"
                  params={{ slug: d.slug }}
                  className="surface-card p-5 hover:border-primary/40 hover:-translate-y-0.5 transition-all"
                >
                  <div className="font-semibold">{d.title}</div>
                  {d.description && (
                    <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                  )}
                </Link>
              ))}
            </div>
          </section>
        ))}
        {sections.length === 0 && (
          <p className="text-muted-foreground">No documentation pages have been published yet.</p>
        )}
      </div>
    </div>
  );
}
