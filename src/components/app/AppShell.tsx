import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  LayoutDashboard, KeyRound, BarChart3, ScrollText, Wallet,
  Gift, Users, Settings as SettingsIcon, LogOut, Sparkles, BookOpen,
} from "lucide-react";
import { logout } from "@/lib/auth.functions";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV_MAIN: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/keys", label: "API Keys", icon: KeyRound },
  { to: "/app/usage", label: "Usage", icon: BarChart3 },
  { to: "/app/logs", label: "Logs", icon: ScrollText },
];
const NAV_ACCOUNT: NavItem[] = [
  { to: "/app/billing", label: "Billing", icon: Wallet },
  { to: "/app/redeem", label: "Redeem", icon: Gift },
  { to: "/app/referrals", label: "Referrals", icon: Users },
  { to: "/app/settings", label: "Settings", icon: SettingsIcon },
];

function initials(s?: string | null) {
  if (!s) return "U";
  const parts = s.replace(/[^a-zA-Z0-9 @._-]/g, "").split(/[ @._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "U") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function AppShell({ children, user, brand }: { children: React.ReactNode; user: { username: string; email?: string | null } | null; brand?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const doLogout = useServerFn(logout);
  const display = user?.email ?? user?.username ?? "";
  const brandName = brand ?? "Console";
  const brandInitial = (brandName.trim()[0] ?? "C").toUpperCase();

  const renderGroup = (items: NavItem[]) => items.map((n) => {
    const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
    return (
      <Link
        key={n.to}
        to={n.to}
        className={`group flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-colors ${
          active
            ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-medium shadow-[inset_2px_0_0_0_var(--primary)]"
            : "text-foreground/70 hover:bg-secondary hover:text-foreground"
        }`}
      >
        <n.icon className={`h-4 w-4 ${active ? "text-primary" : "text-foreground/50 group-hover:text-foreground/80"}`} />
        {n.label}
      </Link>
    );
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_-10%_-20%,color-mix(in_oklab,var(--primary)_8%,transparent),transparent),radial-gradient(900px_500px_at_110%_-10%,color-mix(in_oklab,var(--primary)_5%,transparent),transparent)] bg-secondary/30 flex">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border/60 bg-background/80 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 px-6 h-14 font-semibold text-[15px] tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-[11px] font-bold shadow-sm">{brandInitial}</span>
          <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent truncate">{brandName}</span>
        </Link>


        <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
          <div className="space-y-0.5">
            <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">Workspace</div>
            {renderGroup(NAV_MAIN)}
          </div>
          <div className="space-y-0.5">
            <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">Account</div>
            {renderGroup(NAV_ACCOUNT)}
          </div>
          <div className="space-y-0.5">
            <div className="px-3 pb-1.5 text-[10px] uppercase tracking-wider text-muted-foreground/70">Resources</div>
            <Link to="/docs" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-foreground/70 hover:bg-secondary hover:text-foreground">
              <BookOpen className="h-4 w-4 text-foreground/50" /> Documentation
            </Link>
            <Link to="/models" className="flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] text-foreground/70 hover:bg-secondary hover:text-foreground">
              <Sparkles className="h-4 w-4 text-foreground/50" /> Models
            </Link>
          </div>
        </nav>

        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-[12px] font-semibold shadow-sm">
              {initials(display)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">{user?.username}</div>
              <div className="text-[11px] text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <button
            onClick={() => doLogout({}).then(() => { window.location.href = "/"; })}
            className="mt-2 w-full flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
