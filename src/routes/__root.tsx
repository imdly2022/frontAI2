import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, HeadContent, Scripts, useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { SiteHeader, SiteFooter } from "@/components/site/SiteChrome";
import { CustomScripts } from "@/components/site/CustomScripts";
import { getSiteSettings, getCustomScriptsForRoute } from "@/lib/cms.functions";
import { me } from "@/lib/auth.functions";
import { trackClick } from "@/lib/affiliate.functions";


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: ({ loaderData }) => {
    const settings = (loaderData as { settings?: { branding?: { name?: string; tagline?: string } } } | undefined)?.settings ?? {};
    const brand = settings.branding?.name ?? "Nova AI Relay";
    const tagline = settings.branding?.tagline ?? "One API. Every AI model.";
    const title = `${brand} — ${tagline}`;
    const desc = "Unified OpenAI-compatible gateway to GPT, Claude, Gemini and 100+ models. Pay-as-you-go credits, instant signup.";
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title },
        { name: "description", content: desc },
        { property: "og:site_name", content: brand },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/79523b82-2c83-47d5-9d31-533727505e35/id-preview-cdbe734d--6638ef2a-6945-42ee-b5dc-c74f0ba71abb.lovable.app-1780046906948.png" },
        { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/79523b82-2c83-47d5-9d31-533727505e35/id-preview-cdbe734d--6638ef2a-6945-42ee-b5dc-c74f0ba71abb.lovable.app-1780046906948.png" },
      ],
      links: [{ rel: "stylesheet", href: appCss }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: brand,
            description: "Unified AI gateway providing OpenAI-compatible access to leading LLMs.",
            url: "/",
          }),
        },
      ],
    };
  },
  loader: async () => {
    const [settings, scripts, user] = await Promise.all([
      getSiteSettings().catch(() => ({})),
      getCustomScriptsForRoute({ data: { scope: "global" } }).catch(() => []),
      me().catch(() => null),
    ]);
    return { settings, scripts, user };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: ({ error }) => {
    console.error(error);
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div>
          <h1 className="text-2xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground mt-2">{error.message}</p>
          <a href="/" className="mt-6 inline-block text-primary underline">Go home</a>
        </div>
      </div>
    );
  },
});

function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6 text-center">
      <div>
        <h1 className="text-6xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Page not found.</p>
        <a href="/" className="mt-6 inline-block text-primary underline">Back home</a>
      </div>
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { settings, scripts, user } = Route.useLoaderData();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAppRoute = pathname.startsWith("/app") || pathname.startsWith("/admin");

  // Capture attribution (ref + utm + ad-platform click ids) on every page load.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const get = (k: string) => url.searchParams.get(k) ?? undefined;
    const payload = {
      ref: get("ref"),
      sub1: get("sub1"), sub2: get("sub2"), sub3: get("sub3"),
      sub4: get("sub4"), sub5: get("sub5"),
      utm_source: get("utm_source"), utm_medium: get("utm_medium"),
      utm_campaign: get("utm_campaign"), utm_content: get("utm_content"),
      utm_term: get("utm_term"),
      fbclid: get("fbclid"), gclid: get("gclid"), ttclid: get("ttclid"),
      landing: url.pathname,
    };
    const hasAny = Object.entries(payload).some(([k, v]) => k !== "landing" && typeof v === "string" && v.length > 0);
    if (!hasAny) return;
    trackClick({ data: payload }).catch(() => {});
  }, [pathname]);

  return (
    <QueryClientProvider client={queryClient}>
      <CustomScripts scripts={scripts} placement="head" />
      {!isAppRoute && <SiteHeader branding={settings.branding} isAuthed={!!user} />}
      <Outlet />
      {!isAppRoute && <SiteFooter branding={settings.branding} contact={settings.contact} company={settings.company} />}
      <CustomScripts scripts={scripts} placement="body_end" />
    </QueryClientProvider>
  );
}

