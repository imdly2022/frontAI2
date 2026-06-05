import { createFileRoute } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSiteSettings } from "@/lib/cms.functions";

type LegalDoc = { title?: string; updated?: string; body_md?: string };

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service" },
      { name: "description", content: "Terms of Service." },
    ],
    links: [{ rel: "canonical", href: "/legal/terms" }],
  }),
  loader: async () => {
    const s = await getSiteSettings().catch(() => ({} as Record<string, unknown>));
    return ((s as Record<string, unknown>).legal_terms ?? {}) as LegalDoc;
  },
  component: TermsPage,
});

function TermsPage() {
  const doc = Route.useLoaderData();
  return <LegalLayout doc={doc} fallbackTitle="Terms of Service" />;
}

export function LegalLayout({ doc, fallbackTitle }: { doc: LegalDoc; fallbackTitle: string }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-3xl font-bold">{doc.title ?? fallbackTitle}</h1>
      {doc.updated && <p className="mt-2 text-xs text-muted-foreground">Last updated: {doc.updated}</p>}
      <article className="prose prose-invert mt-8 max-w-none text-[15px] leading-7 text-foreground/90 prose-headings:text-foreground prose-a:text-primary prose-strong:text-foreground prose-code:text-foreground">
        {doc.body_md ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.body_md}</ReactMarkdown>
        ) : (
          "Coming soon."
        )}
      </article>
    </main>
  );
}
