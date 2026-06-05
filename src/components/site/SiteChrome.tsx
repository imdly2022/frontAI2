import { Link } from "@tanstack/react-router";
import { Mail, Send, MessageCircle, Users } from "lucide-react";

type Branding = { name: string; tagline: string; logoEmoji?: string };
type Contact = {
  email?: string;
  telegram?: string;
  teams?: string;
  wechat?: string;
};
type Company = {
  name?: string;
  address?: string;
  registrationNo?: string;
  vatNo?: string;
};


export function SiteHeader({ branding, isAuthed }: { branding?: Branding; isAuthed: boolean }) {
  const name = branding?.name ?? "Nova AI Relay";
  return (
    <header className="sticky top-0 z-40 w-full glass-nav border-b border-border/60">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 text-[15px] font-medium tracking-tight">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background text-[11px] font-bold">{(name.trim()[0] ?? "N").toUpperCase()}</span>
          {name}
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-foreground/80 md:flex">
          <Link to="/models" className="hover:text-foreground transition-colors">Models</Link>
          <Link to="/pricing" className="hover:text-foreground transition-colors">Pay as you go</Link>
          <Link to="/docs" className="hover:text-foreground transition-colors">Docs</Link>
        </nav>
        <div className="flex items-center gap-3 text-[13px]">
          {isAuthed ? (
            <Link to="/app" className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90">Dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline text-foreground/80 hover:text-foreground">Sign in</Link>
              <Link to="/register" className="btn-pill bg-primary text-primary-foreground hover:bg-primary/90">Get started</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ branding, contact, company }: { branding?: Branding; contact?: Contact; company?: Company }) {
  const name = branding?.name ?? "Nova AI Relay";
  const channels = buildChannels(contact);
  const email = contact?.email?.trim();
  const hasCompany = Boolean(company?.name?.trim() || company?.address?.trim() || company?.registrationNo?.trim() || company?.vatNo?.trim());
  return (
    <footer className="border-t border-border/60 mt-32 bg-secondary/40">
      <div className="mx-auto max-w-6xl px-6 py-14 grid gap-10 md:grid-cols-4 text-[13px]">
        <div>
          <div className="font-semibold mb-2 text-foreground">{name}</div>
          <p className="text-muted-foreground leading-relaxed">{branding?.tagline ?? "One API. Every Model."}</p>
          {email && (
            <div className="mt-4 flex items-center gap-1.5 text-sm">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
              <a href={`mailto:${email}`} className="text-foreground hover:underline break-all">{email}</a>
            </div>
          )}
          {channels.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {channels.map((c) => (
                <a key={c.label} href={c.href} target={c.external ? "_blank" : undefined} rel={c.external ? "noopener noreferrer" : undefined}
                  title={c.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/50 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                  <c.icon className="h-3.5 w-3.5" /> <span>{c.label}</span>
                </a>
              ))}
            </div>
          )}
        </div>
        <FooterCol title="Product" links={[
          { href: "/models", label: "Models" },
          { href: "/pricing", label: "Pay as you go" },
          { href: "/docs", label: "Documentation" },
        ]} />
        <FooterCol title="Account" links={[
          { href: "/login", label: "Sign in" },
          { href: "/register", label: "Create account" },
          { href: "/app/keys", label: "API keys" },
        ]} />
        <FooterCol title="Legal" links={[
          { href: "/legal/terms", label: "Terms" },
          { href: "/legal/privacy", label: "Privacy" },
        ]} />
      </div>
      {hasCompany && (
        <div className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground space-y-1">
            {company?.name?.trim() && <div className="font-medium text-foreground">{company.name.trim()}</div>}
            {company?.address?.trim() && <div className="whitespace-pre-line">{company.address.trim()}</div>}
            {(company?.registrationNo?.trim() || company?.vatNo?.trim()) && (
              <div className="flex flex-wrap gap-x-4">
                {company?.registrationNo?.trim() && <span>Company No: {company.registrationNo.trim()}</span>}
                {company?.vatNo?.trim() && <span>VAT No: {company.vatNo.trim()}</span>}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="border-t border-border/60 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {company?.name?.trim() || name}. All rights reserved.
      </div>
    </footer>
  );
}

function buildChannels(c?: Contact) {
  if (!c) return [];
  const out: Array<{ label: string; href: string; icon: typeof Mail; external?: boolean }> = [];

  // Email is shown above as plain text; skip the chip.
  if (c.telegram?.trim()) {
    const t = c.telegram.trim().replace(/^@/, "");
    const href = t.startsWith("http") ? t : `https://t.me/${t}`;
    out.push({ label: "Telegram", href, icon: Send, external: true });
  }
  if (c.teams?.trim()) out.push({ label: "Teams", href: c.teams.trim(), icon: Users, external: true });
  if (c.wechat?.trim()) out.push({ label: `WeChat: ${c.wechat.trim()}`, href: "#", icon: MessageCircle });
  return out;
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <div className="font-medium mb-3 text-foreground">{title}</div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <a href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
