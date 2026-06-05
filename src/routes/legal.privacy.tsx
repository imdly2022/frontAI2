import { createFileRoute } from "@tanstack/react-router";
import { getSiteSettings } from "@/lib/cms.functions";
import { LegalLayout } from "./legal.terms";

type LegalDoc = { title?: string; updated?: string; body_md?: string };

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy" },
      { name: "description", content: "Privacy Policy." },
    ],
    links: [{ rel: "canonical", href: "/legal/privacy" }],
  }),
  loader: async () => {
    const s = await getSiteSettings().catch(() => ({} as Record<string, unknown>));
    return ((s as Record<string, unknown>).legal_privacy ?? {}) as LegalDoc;
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  const doc = Route.useLoaderData();
  return <LegalLayout doc={doc} fallbackTitle="Privacy Policy" />;
}
