import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Building2 } from "lucide-react";
import { adminListSettings, adminUpsertSetting } from "@/lib/admin.functions";
import { AdminHeader } from "@/components/admin/AdminShell";

export const Route = createFileRoute("/admin/company")({
  head: () => ({ meta: [{ title: "Company Info — Admin" }, { name: "robots", content: "noindex" }] }),
  component: CompanyPage,
});

type CompanyData = {
  name: string;
  address: string;
  registrationNo: string;
  vatNo: string;
};

const DEFAULTS: CompanyData = {
  name: "LUSHCART TRADE LTD",
  address: "SUITE 35329, 61 BRIDGE STREET, KINGTON, UNITED KINGDOM, HR5 3DJ",
  registrationNo: "",
  vatNo: "",
};

function CompanyPage() {
  const listFn = useServerFn(adminListSettings);
  const upsertFn = useServerFn(adminUpsertSetting);
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => listFn() });

  const raw = (data ?? []).find((r: { key: string; value: unknown }) => r.key === "company")?.value;
  const existing = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};

  const merged: CompanyData = {
    name: String(existing?.name ?? DEFAULTS.name),
    address: String(existing?.address ?? DEFAULTS.address),
    registrationNo: String(existing?.registrationNo ?? DEFAULTS.registrationNo),
    vatNo: String(existing?.vatNo ?? DEFAULTS.vatNo),
  };

  const [state, setState] = useState<CompanyData>(merged);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setState(merged);
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      await upsertFn({ data: { key: "company", value: state } });
      toast.success("Company information saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const fields: { key: keyof CompanyData; label: string; rows?: number; placeholder?: string }[] = [
    { key: "name", label: "Company name (full legal)", placeholder: "LUSHCART TRADE LTD" },
    { key: "address", label: "Office address", rows: 3, placeholder: "SUITE 35329, 61 BRIDGE STREET…" },
    { key: "registrationNo", label: "Company registration no.", placeholder: "" },
    { key: "vatNo", label: "VAT number", placeholder: "" },
  ];

  return (
    <>
      <AdminHeader
        title="Company Information"
        description="Legal entity details shown in the site footer and used for payment compliance."
      />
      <div className="p-8 max-w-3xl">
        <div className="rounded-lg border border-border/60 bg-card/40 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Legal Entity Details</h2>
              <p className="text-xs text-muted-foreground">This information appears in the footer and on compliance pages.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fields.map((f) => (
              <div key={f.key} className={f.rows ? "md:col-span-2" : ""}>
                <label className="block text-sm font-medium mb-1.5">{f.label}</label>
                {f.rows ? (
                  <textarea
                    value={state[f.key]}
                    onChange={(e) => setState((s) => ({ ...s, [f.key]: e.target.value }))}
                    rows={f.rows}
                    placeholder={f.placeholder}
                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    type="text"
                    value={state[f.key]}
                    onChange={(e) => setState((s) => ({ ...s, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setState(DEFAULTS)}
              className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-accent"
            >
              Reset to defaults
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
