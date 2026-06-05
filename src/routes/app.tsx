import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";
import { getSiteSettings } from "@/lib/cms.functions";
import { AppShell } from "@/components/app/AppShell";

export const Route = createFileRoute("/app")({
  head: ({ loaderData }) => {
    const brand = (loaderData as { brand?: string } | undefined)?.brand ?? "Console";
    return { meta: [{ title: `Console — ${brand}` }, { name: "robots", content: "noindex" }] };
  },
  beforeLoad: async ({ location }) => {
    const user = await me();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user };
  },
  loader: async ({ context }) => {
    const settings = await getSiteSettings().catch(() => ({} as { branding?: { name?: string } }));
    return {
      user: (context as unknown as { user: { id: number; username: string; email?: string } }).user,
      brand: settings.branding?.name ?? "Console",
    };
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, brand } = Route.useLoaderData();
  return (
    <AppShell user={{ username: user.username, email: user.email }} brand={brand}>
      <Outlet />
    </AppShell>
  );
}
