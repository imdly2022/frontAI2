import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, Settings as SettingsIcon, FileText, Boxes, DollarSign,
  Code2, Users, Wallet, LogOut, ArrowLeftRight, Megaphone, Receipt, Webhook,
  Building2, Mail, MailCheck, Send, ScrollText, Database,
} from "lucide-react";
import { logout } from "@/lib/auth.functions";

const NAV = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/site", label: "Site & SEO", icon: SettingsIcon },
  { to: "/admin/company", label: "Company", icon: Building2 },
  { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { to: "/admin/pricing", label: "Pricing Plans", icon: DollarSign },
  { to: "/admin/models", label: "Models Catalog", icon: Boxes },
  { to: "/admin/docs", label: "Docs", icon: FileText },
  { to: "/admin/scripts", label: "Custom Scripts", icon: Code2 },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/affiliates", label: "Affiliates", icon: Users },
  { to: "/admin/orders", label: "Orders", icon: Receipt },
  { to: "/admin/payments", label: "Payments", icon: Wallet },
  { to: "/admin/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/admin/email", label: "Email Settings", icon: Mail },
  { to: "/admin/email-templates", label: "Email Templates", icon: MailCheck },
  { to: "/admin/email-campaigns", label: "Email Campaigns", icon: Send },
  { to: "/admin/email-logs", label: "Email Log", icon: ScrollText },
  { to: "/admin/webhooks", label: "Webhook Health", icon: Webhook },
  { to: "/admin/webhook-logs", label: "Webhook Log", icon: ScrollText },
  { to: "/admin/newapi", label: "New API", icon: ArrowLeftRight },
  { to: "/admin/migration", label: "DB Migration", icon: Database },
];

export function AdminShell({ children, user, brand }: { children: React.ReactNode; user: { username: string; email?: string | null }; brand?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const doLogout = useServerFn(logout);
  const brandName = brand ?? "Admin";
  const brandInitial = (brandName.trim()[0] ?? "A").toUpperCase();
  return (
    <div className="min-h-screen bg-secondary/40 flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 bg-background">
        <Link to="/" className="flex items-center gap-2 px-6 h-14 font-semibold text-[15px] tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">{brandInitial}</span>
          <span className="truncate">{brandName} · Admin</span>
        </Link>
        <nav className="flex-1 px-3 py-2 space-y-0.5">
          {NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  active ? "bg-primary/10 text-primary font-medium" : "text-foreground/70 hover:bg-secondary hover:text-foreground"
                }`}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
          <Link
            to="/app"
            className="mt-4 flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LayoutDashboard className="h-4 w-4" />
            User console →
          </Link>
        </nav>
        <div className="border-t border-border/60 p-4">
          <div className="text-xs text-muted-foreground mb-2 truncate">{user.email ?? user.username}</div>
          <button
            onClick={() => doLogout({}).then(() => { window.location.href = "/"; })}
            className="flex items-center gap-2 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}

export function AdminHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="px-8 py-6 bg-background border-b border-border/60">
      <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </header>
  );
}
