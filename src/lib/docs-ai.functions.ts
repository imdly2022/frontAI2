// Docs AI question-answer server fn. Uses Lovable AI Gateway, no API key required.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({ question: z.string().trim().min(2).max(500) });

export const askDocs = createServerFn({ method: "POST" })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      return { answer: "AI assistant is not configured.", citations: [] as { slug: string; title: string }[] };
    }
    const { data: docs } = await supabaseAdmin
      .from("docs_pages")
      .select("slug, title, description, body_md")
      .eq("is_published", true)
      .order("sort_order");

    const corpus = (docs ?? [])
      .map((d) => `### ${d.title} (slug:${d.slug})\n${(d.body_md ?? "").slice(0, 4000)}`)
      .join("\n\n---\n\n")
      .slice(0, 80_000);

    const messages = [
      {
        role: "system",
        content:
          "You are the docs assistant for an AI gateway service. Answer ONLY from the provided documentation. " +
          "Be concise (max 6 sentences). When you reference a doc, cite it inline as [slug]. " +
          "If the answer is not in the docs, say you don't know and suggest the closest topic.",
      },
      { role: "user", content: `DOCUMENTATION:\n${corpus}\n\nQUESTION: ${data.question}` },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages, temperature: 0.2 }),
    });
    if (!res.ok) {
      return { answer: `AI request failed (${res.status}). Please try again.`, citations: [] };
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const answer = json.choices?.[0]?.message?.content ?? "No answer.";
    const cited = new Set<string>();
    for (const m of answer.matchAll(/\[([a-z0-9-]{2,80})\]/gi)) cited.add(m[1]);
    const citations = (docs ?? [])
      .filter((d) => cited.has(d.slug))
      .map((d) => ({ slug: d.slug, title: d.title }));
    return { answer, citations };
  });
