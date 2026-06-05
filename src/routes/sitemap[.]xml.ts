import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Base URL is resolved at request time from the incoming request, so it stays
// correct across preview / production / custom-domain deployments.

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;

        const staticPaths = [
          { path: "/", priority: "1.0", changefreq: "weekly" },
          { path: "/pricing", priority: "0.9", changefreq: "weekly" },
          { path: "/models", priority: "0.9", changefreq: "weekly" },
          { path: "/docs", priority: "0.8", changefreq: "weekly" },
          { path: "/login", priority: "0.3", changefreq: "yearly" },
          { path: "/register", priority: "0.5", changefreq: "yearly" },
        ];

        const { data: docs } = await supabaseAdmin
          .from("docs_pages")
          .select("slug, updated_at")
          .eq("is_published", true);

        const entries: Array<{ loc: string; lastmod?: string; changefreq?: string; priority?: string }> = [
          ...staticPaths.map((e) => ({ loc: base + e.path, changefreq: e.changefreq, priority: e.priority })),
          ...(docs ?? []).map((d) => ({
            loc: `${base}/docs/${d.slug}`,
            lastmod: d.updated_at ? new Date(d.updated_at).toISOString() : undefined,
            changefreq: "monthly",
            priority: "0.7",
          })),
        ];

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...entries.map((e) =>
            [
              `  <url>`,
              `    <loc>${e.loc}</loc>`,
              e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
              e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
              e.priority ? `    <priority>${e.priority}</priority>` : null,
              `  </url>`,
            ].filter(Boolean).join("\n")
          ),
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
