import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { me } from "@/lib/auth.functions";
import { adminCheck } from "@/lib/admin.functions";
import { getSiteSettings } from "@/lib/cms.functions";
import { AdminShell } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin")({
  head: ({ loaderData }) => {
    const brand = (loaderData as { brand?: string } | undefined)?.brand ?? "Admin";
    return {
      meta: [
        { title: `Admin — ${brand}` },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  beforeLoad: async ({ location }) => {
    const user = await me();
    if (!user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const { isAdmin } = await adminCheck();
    if (!isAdmin) {
      throw redirect({ to: "/app" });
    }
    return { user };
  },
  loader: async ({ context }) => {
    const settings = await getSiteSettings().catch(() => ({} as { branding?: { name?: string } }));
    return {
      user: (context as unknown as { user: { id: number; username: string; email?: string } }).user,
      brand: settings.branding?.name ?? "Admin",
    };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { user, brand } = Route.useLoaderData();
  return (
    <AdminShell user={{ username: user.username, email: user.email }} brand={brand}>
      <Outlet />
    </AdminShell>
  );
}
