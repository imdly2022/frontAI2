import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// llms.txt — machine-readable site index for AI crawlers (LLM GEO).
// https://llmstxt.org/

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const base = `${url.protocol}//${url.host}`;

        const [{ data: settings }, { data: plans }, { data: models }, { data: docs }] = await Promise.all([
          supabaseAdmin.from("site_settings").select("key, value"),
          supabaseAdmin.from("pricing_plans").select("name, price_usd, credits, bonus_credits, description").eq("is_active", true).order("sort_order"),
          supabaseAdmin.from("models_catalog").select("display_name, provider, slug, context_length, input_price_per_1k, output_price_per_1k, description").eq("is_visible", true).order("sort_order"),
          supabaseAdmin.from("docs_pages").select("slug, title, description").eq("is_published", true).order("sort_order"),
        ]);

        const sMap: Record<string, any> = {};
        for (const r of settings ?? []) sMap[r.key] = r.value;
        const brand = sMap.branding?.name ?? "Nova AI Relay";
        const tagline = sMap.branding?.tagline ?? "One API. Every AI model.";

        const lines: string[] = [];
        lines.push(`# ${brand}`);
        lines.push("");
        lines.push(`> ${tagline}`);
        lines.push("");
        lines.push(`${brand} is a unified AI gateway providing OpenAI-compatible access to leading LLMs from OpenAI, Anthropic, Google, and more, with credit-based pay-as-you-go pricing.`);
        lines.push("");

        lines.push("## Key pages");
        lines.push(`- [Home](${base}/): Product overview`);
        lines.push(`- [Pricing](${base}/pricing): Credit packs and rates`);
        lines.push(`- [Models](${base}/models): Supported model catalog`);
        lines.push(`- [Docs](${base}/docs): Developer documentation`);
        lines.push(`- [Full docs corpus](${base}/llms-full.txt): All documentation in a single file`);
        lines.push("");

        if (plans?.length) {
          lines.push("## Pricing plans");
          for (const p of plans) {
            lines.push(`- **${p.name}** — $${p.price_usd} → ${p.credits} credits${Number(p.bonus_credits) > 0 ? ` + ${p.bonus_credits} bonus` : ""}${p.description ? `. ${p.description}` : ""}`);
          }
          lines.push("");
        }

        if (models?.length) {
          lines.push("## Supported models");
          for (const m of models.slice(0, 50)) {
            const ctx = m.context_length ? ` (${m.context_length} ctx)` : "";
            const price = m.input_price_per_1k != null ? ` — in $${(Number(m.input_price_per_1k) * 1000).toFixed(2)}/1M, out $${(Number(m.output_price_per_1k) * 1000).toFixed(2)}/1M` : "";
            lines.push(`- **${m.display_name}** \`${m.slug}\` by ${m.provider}${ctx}${price}`);
          }
          lines.push("");
        }

        if (docs?.length) {
          lines.push("## Documentation");
          for (const d of docs) {
            lines.push(`- [${d.title}](${base}/docs/${d.slug})${d.description ? `: ${d.description}` : ""}`);
          }
          lines.push("");
        }

        return new Response(lines.join("\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
