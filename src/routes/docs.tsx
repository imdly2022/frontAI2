import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, X, BookOpen } from "lucide-react";
import { getDocsIndex, getDocsGroups } from "@/lib/cms.functions";

type Group = { id: string; slug: string; name: string; description: string | null; sort_order: number };
type DocEntry = { slug: string; title: string; description: string | null; category: string | null; sort_order: number };

export const Route = createFileRoute("/docs")({
  loader: async () => {
    const [groups, docs] = await Promise.all([getDocsGroups(), getDocsIndex()]);
    return { groups: groups as Group[], docs: docs as DocEntry[] };
  },
  component: DocsLayout,
});

function DocsLayout() {
  const data = Route.useLoaderData() as { groups: Group[]; docs: DocEntry[] };
  const { groups, docs } = data;
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);

  // Group docs by category slug. Unmatched go under "Other".
  const groupBySlug = new Map<string, Group>(groups.map((g) => [g.slug, g]));
  const buckets = new Map<string, { group: Group | null; items: DocEntry[] }>();
  for (const g of groups) buckets.set(g.slug, { group: g, items: [] });
  for (const d of docs) {
    const key = d.category && groupBySlug.has(d.category) ? d.category : "__other";
    if (!buckets.has(key)) {
      buckets.set(key, {
        group: key === "__other" ? null : (groupBySlug.get(key) ?? null),
        items: [],
      });
    }
    buckets.get(key)!.items.push(d);
  }
  // Drop empty groups
  const sections = Array.from(buckets.values()).filter((b) => b.items.length > 0);

  const Sidebar = (
    <nav className="space-y-7">
      <div>
        <Link
          to="/docs"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2 text-sm font-medium px-2 py-1.5 rounded-md ${
            pathname === "/docs" ? "bg-primary/10 text-primary" : "text-foreground/80 hover:bg-muted/60"
          }`}
        >
          <BookOpen className="h-4 w-4" /> Overview
        </Link>
      </div>
      {sections.map((s, i) => (
        <div key={s.group?.slug ?? `__other-${i}`}>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground px-2 mb-2">
            {s.group?.name ?? "Other"}
          </div>
          <ul className="space-y-0.5">
            {s.items.map((d) => {
              const active = pathname === `/docs/${d.slug}`;
              return (
                <li key={d.slug}>
                  <Link
                    to="/docs/$slug"
                    params={{ slug: d.slug }}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-2 py-1.5 rounded-md text-sm ${
                      active
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/75 hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    {d.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground px-2">No documentation yet.</p>
      )}
    </nav>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      {/* Mobile toggle */}
      <div className="lg:hidden flex items-center justify-between py-4 border-b border-border/60">
        <span className="font-semibold">Documentation</span>
        <button
          onClick={() => setMobileOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border border-border"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          {mobileOpen ? "Close" : "Menu"}
        </button>
      </div>

      <div className="flex gap-10 py-8 lg:py-12">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2">
            {Sidebar}
          </div>
        </aside>

        {/* Mobile drawer */}
        {mobileOpen && (
          <aside className="lg:hidden w-full mb-6 border-b border-border/60 pb-6">
            {Sidebar}
          </aside>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
