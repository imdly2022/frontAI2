import { createFileRoute, notFound } from "@tanstack/react-router";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import DOMPurify from "isomorphic-dompurify";
import { getDocPage, getSiteSettings } from "@/lib/cms.functions";

export const Route = createFileRoute("/docs/$slug")({
  head: ({ loaderData, params }) => {
    const data = loaderData as
      | { page: { title?: string; description?: string; updated_at?: string; created_at?: string }; brand: string; siteUrl?: string }
      | undefined;
    const brand = data?.brand ?? "Nova AI Relay";
    const title = `${data?.page?.title ?? "Docs"} — ${brand}`;
    const desc = data?.page?.description ?? "Documentation";
    const canonical = `/docs/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
      ],
      links: [{ rel: "canonical", href: canonical }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: data?.page?.title ?? "Docs",
          description: desc,
          inLanguage: "en",
          author: { "@type": "Organization", name: brand },
          publisher: { "@type": "Organization", name: brand },
          ...(data?.page?.created_at ? { datePublished: data.page.created_at } : {}),
          ...(data?.page?.updated_at ? { dateModified: data.page.updated_at } : {}),
          mainEntityOfPage: canonical,
        }),
      }],
    };
  },
  loader: async ({ params }) => {
    const [page, settings] = await Promise.all([
      getDocPage({ data: { slug: params.slug } }),
      getSiteSettings().catch(() => ({} as { branding?: { name?: string } })),
    ]);
    if (!page) throw notFound();
    return { page, brand: settings.branding?.name ?? "Nova AI Relay" };
  },
  component: DocPage,
});

function DocPage() {
  const { page } = Route.useLoaderData();
  const body = page.body_md ?? "";
  const isHtml = /^\s*<(h[1-6]|p|ul|ol|img|figure|blockquote|pre|div)\b/i.test(body);
  return (
    <article className="max-w-3xl">
      <header className="mb-8">
        <h1 className="text-4xl font-semibold tracking-tight">{page.title}</h1>
        {page.description && <p className="mt-3 text-lg text-muted-foreground">{page.description}</p>}
      </header>
      <div className="prose-docs">
        {isHtml ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(body) }} />
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
            {body}
          </ReactMarkdown>
        )}
      </div>
    </article>
  );
}
