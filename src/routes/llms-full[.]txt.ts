import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// llms-full.txt — full concatenated docs corpus for LLM ingestion.
// Extension to the llms.txt protocol: https://llmstxt.org/

type DocVars = { site_name: string; site_url: string; api_base_url: string };

const ALIASES: Record<string, keyof DocVars> = {
  site_name: "site_name", sitename: "site_name", brand: "site_name", brand_name: "site_name", brandname: "site_name", name: "site_name",
  site_url: "site_url", siteurl: "site_url", website_url: "site_url", website: "site_url", base_url: "site_url", baseurl: "site_url", host: "site_url", domain: "site_url", url: "site_url",
  api_base_url: "api_base_url", apibaseurl: "api_base_url", api_url: "api_base_url", apiurl: "api_base_url", api_endpoint: "api_base_url", apiendpoint: "api_base_url", endpoint: "api_base_url", apibase: "api_base_url", api_base: "api_base_url",
};

function substitute(text: string | null | undefined, vars: DocVars): string {
  if (!text) return text ?? "";
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (full, key: string) => {
    const mapped = ALIASES[key.toLowerCase()];
    return mapped ? vars[mapped] : full;
  });
}

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;

        const [{ data: settings }, { data: docs }] = await Promise.all([
          supabaseAdmin.from("site_settings").select("key, value").in("key", ["branding", "endpoints", "faq"]),
          supabaseAdmin
            .from("docs_pages")
            .select("slug, title, description, body_md, updated_at")
            .eq("is_published", true)
            .order("sort_order"),
        ]);

        const sMap: Record<string, any> = {};
        for (const r of settings ?? []) sMap[r.key] = r.value;
        const brand = sMap.branding?.name ?? "Nova AI Relay";
        const tagline = sMap.branding?.tagline ?? "One API. Every AI model.";
        const faqItems: Array<{ question?: string; answer?: string }> = sMap.faq?.items ?? [];

        const vars: DocVars = {
          site_name: brand,
          site_url: base,
          api_base_url: sMap.endpoints?.baseUrl ?? "https://api.novarelay.io/v1",
        };

        const lines: string[] = [];
        lines.push(`# ${brand} — full documentation`);
        lines.push("");
        lines.push(`> ${tagline}`);
        lines.push("");
        lines.push(`Source: ${base}/llms-full.txt`);
        lines.push(`Generated: ${new Date().toISOString()}`);
        lines.push("");

        if (faqItems.length > 0) {
          lines.push("## FAQ");
          lines.push("");
          for (const it of faqItems) {
            const q = substitute(it.question ?? "", vars).trim();
            const a = substitute(it.answer ?? "", vars).trim();
            if (!q || !a) continue;
            lines.push(`### ${q}`);
            lines.push("");
            lines.push(a);
            lines.push("");
          }
        }

        for (const d of docs ?? []) {
          const title = substitute(d.title, vars);
          const desc = d.description ? substitute(d.description, vars) : "";
          const body = substitute(d.body_md ?? "", vars);
          lines.push(`# ${title}`);
          lines.push("");
          lines.push(`Source: ${base}/docs/${d.slug}`);
          if (d.updated_at) lines.push(`Updated: ${d.updated_at}`);
          lines.push("");
          if (desc) {
            lines.push(`> ${desc}`);
            lines.push("");
          }
          lines.push(body);
          lines.push("");
          lines.push("---");
          lines.push("");
        }

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=1800",
          },
        });
      },
    },
  },
});
