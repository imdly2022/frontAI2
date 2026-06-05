import { useState } from "react";
import { Copy, Check } from "lucide-react";

export type DocVarEntry = {
  key: "site_name" | "site_url" | "api_base_url";
  label: string;
  description: string;
  aliases: string[];
  value: string;
};

function CopyChip({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard blocked — ignore */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1 text-[12px] font-mono text-foreground/90 hover:border-primary/50 hover:bg-secondary transition-colors"
      title="Copy"
    >
      <span className="truncate max-w-[220px]">{label ?? text}</span>
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

export function DocVarReference({ catalog, compact = false }: { catalog: DocVarEntry[]; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-3" : "space-y-5"}>
      {catalog.map((entry) => (
        <div key={entry.key} className="rounded-lg border border-border/60 bg-card/40 p-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm font-semibold">{entry.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{entry.description}</div>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Resolves to <span className="font-mono text-foreground/80">{entry.value}</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {entry.aliases.map((a) => (
              <CopyChip key={a} text={`{{${a}}}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocVarExamples({ catalog }: { catalog: DocVarEntry[] }) {
  const get = (k: DocVarEntry["key"]) => catalog.find((c) => c.key === k);
  const name = get("site_name")?.value ?? "Site";
  const url = get("site_url")?.value ?? "https://example.com";
  const api = get("api_base_url")?.value ?? "https://api.example.com/v1";

  const examples: Array<{ where: string; template: string; rendered: string }> = [
    {
      where: "Page title",
      template: "Getting started — {{site_name}}",
      rendered: `Getting started — ${name}`,
    },
    {
      where: "Meta description",
      template: "Use {{api_base_url}} as a drop-in OpenAI replacement on {{site_name}}.",
      rendered: `Use ${api} as a drop-in OpenAI replacement on ${name}.`,
    },
    {
      where: "Body — link",
      template: "Visit [{{site_name}}]({{site_url}}) for the latest docs.",
      rendered: `Visit [${name}](${url}) for the latest docs.`,
    },
    {
      where: "Body — curl snippet",
      template:
        "curl {{api_base_url}}/chat/completions \\\n  -H \"Authorization: Bearer $YOUR_KEY\"",
      rendered: `curl ${api}/chat/completions \\\n  -H "Authorization: Bearer $YOUR_KEY"`,
    },
  ];

  return (
    <div className="space-y-3">
      {examples.map((ex, i) => (
        <div key={i} className="rounded-lg border border-border/60 bg-card/40">
          <div className="px-4 py-2 border-b border-border/60 flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{ex.where}</div>
            <CopyChip text={ex.template} label="Copy template" />
          </div>
          <div className="p-4 grid gap-3 md:grid-cols-2">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">You write</div>
              <pre className="text-xs font-mono whitespace-pre-wrap rounded-md bg-secondary/60 p-3">{ex.template}</pre>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">Readers see</div>
              <pre className="text-xs font-mono whitespace-pre-wrap rounded-md bg-secondary/30 p-3">{ex.rendered}</pre>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
