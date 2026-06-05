// Admin-only server functions for the email system:
// settings, templates, campaigns, send log, test-send, bulk send.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAdmin } from "./admin.middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendEmail, renderTemplate } from "./email.server";

// ─── Settings (stored in site_settings.key='email') ─────────────────────

const emailSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  from_email: z.string().trim().email().max(255),
  from_name: z.string().trim().min(1).max(120),
  reply_to: z.string().trim().email().max(255).nullish().or(z.literal("").transform(() => null)),
  api_url: z.string().trim().url().max(500).nullish().or(z.literal("").transform(() => null)),
  // empty string means "keep existing value"; null means "clear it"
  api_key: z.string().max(500).nullish(),
});
export type EmailSettingsInput = z.input<typeof emailSettingsSchema>;

function maskKey(k: string | null | undefined): string {
  if (!k) return "";
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 4)}••••${k.slice(-4)}`;
}

export const adminGetEmailSettings = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data } = await supabaseAdmin
    .from("site_settings")
    .select("value")
    .eq("key", "email")
    .maybeSingle();
  const v = (data?.value ?? {}) as Partial<z.infer<typeof emailSettingsSchema>> & { api_key?: string | null };
  return {
    enabled: v.enabled ?? true,
    from_email: v.from_email ?? "noreply@novarelay.io",
    from_name: v.from_name ?? "NovaRelay",
    reply_to: v.reply_to ?? null,
    api_url: v.api_url ?? "https://api.zeptomail.com/v1.1/email",
    api_key_masked: maskKey(v.api_key),
    api_key_set: Boolean(v.api_key),
    env_key_set: Boolean(process.env.ZEPTOMAIL_API_KEY),
  };
});

export const adminSaveEmailSettings = createServerFn({ method: "POST" })
  .inputValidator((input) => emailSettingsSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    // Fetch existing so we can preserve api_key when input is empty string
    const { data: existing } = await supabaseAdmin
      .from("site_settings").select("value").eq("key", "email").maybeSingle();
    const prev = (existing?.value ?? {}) as { api_key?: string | null };

    const next: Record<string, unknown> = {
      enabled: data.enabled,
      from_email: data.from_email,
      from_name: data.from_name,
      reply_to: data.reply_to ?? null,
      api_url: data.api_url ?? null,
      // "" (empty) → keep prev; null → clear; non-empty → overwrite
      api_key: data.api_key === undefined || data.api_key === ""
        ? (prev.api_key ?? null)
        : data.api_key,
    };
    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert({ key: "email", value: next as never, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSendTestEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    to: z.string().trim().email(),
    template_key: z.string().trim().min(1).max(80).optional(),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const ok = data.template_key
      ? await sendEmail({
          to: data.to,
          template_key: data.template_key,
          vars: {
            first_name: "Test",
            last_name: "User",
            username: "testuser",
            email: data.to,
            code: "123456",
            balance: "5.00",
          },
        })
      : await sendEmail({
          to: data.to,
          subject: "Test email from {{site_name}}",
          html: "<p>This is a test email from your admin panel. If you got this, your email setup works.</p>",
          text: "Test email from your admin panel.",
        });
    return { ok };
  });

// ─── Templates ───────────────────────────────────────────────────────────

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_-]+$/i),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(255),
  html: z.string().max(200_000).default(""),
  text: z.string().max(50_000).nullish(),
  description: z.string().max(500).nullish(),
  is_enabled: z.boolean().default(true),
  variables: z.array(z.string().max(60)).max(40).default([]),
});

export const adminListEmailTemplates = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .order("is_system", { ascending: false })
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminUpsertEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => templateSchema.parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const row = { ...data, updated_at: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("email_templates")
      .upsert(row, { onConflict: "key" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: tpl } = await supabaseAdmin
      .from("email_templates").select("is_system").eq("id", data.id).maybeSingle();
    if (tpl?.is_system) throw new Error("System templates cannot be deleted (you can disable them instead).");
    const { error } = await supabaseAdmin.from("email_templates").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminPreviewEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    subject: z.string().max(255),
    html: z.string().max(200_000),
    vars: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    return {
      subject: renderTemplate(data.subject, data.vars),
      html: renderTemplate(data.html, data.vars),
    };
  });

// ─── Recipient picker (for campaigns) ────────────────────────────────────

export const adminSearchUsersForEmail = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    search: z.string().trim().max(120).optional(),
    country: z.string().trim().length(2).optional(),
    limit: z.number().int().min(1).max(500).default(100),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("users")
      .select("id, newapi_user_id, username, email, first_name, last_name, country")
      .not("email", "is", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`email.ilike.${s},username.ilike.${s},first_name.ilike.${s},last_name.ilike.${s}`);
    }
    if (data.country) q = q.eq("country", data.country.toUpperCase());
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

// ─── Campaigns ──────────────────────────────────────────────────────────

export const adminListEmailCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("email_campaigns")
    .select("*, email_templates:template_id(key, name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const adminCreateEmailCampaign = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    name: z.string().trim().min(1).max(160),
    template_id: z.string().uuid(),
    subject_override: z.string().trim().max(255).nullish(),
    recipient_ids: z.array(z.number().int()).min(1).max(5000),
  }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: created, error } = await supabaseAdmin
      .from("email_campaigns")
      .insert({
        name: data.name,
        template_id: data.template_id,
        subject_override: data.subject_override || null,
        recipient_ids: data.recipient_ids,
        recipient_count: data.recipient_ids.length,
        status: "draft",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: created.id };
  });

/**
 * Send a campaign. Synchronous: sends sequentially in this request.
 * Workers max execution time can be ~30s — recipient_count is capped at 5000
 * but sending stops if we run long. Status is updated as we go so re-running
 * resumes by sending only un-sent recipients (idempotent via send log).
 */
export const adminSendEmailCampaign = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: camp, error } = await supabaseAdmin
      .from("email_campaigns")
      .select("*, email_templates:template_id(key)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!camp) throw new Error("Campaign not found");
    if (camp.status === "sending") throw new Error("Campaign is already sending");
    const tplKey = (camp as { email_templates?: { key?: string } | null }).email_templates?.key;
    if (!tplKey) throw new Error("Template missing");

    await supabaseAdmin.from("email_campaigns").update({
      status: "sending",
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", camp.id);

    // Find recipients already successfully sent for this campaign — skip them
    const { data: alreadySent } = await supabaseAdmin
      .from("email_send_log")
      .select("newapi_user_id")
      .eq("campaign_id", camp.id)
      .eq("status", "sent");
    const sentSet = new Set((alreadySent ?? []).map((r) => Number(r.newapi_user_id)));

    const recipientIds = (camp.recipient_ids as number[]).filter((id) => !sentSet.has(Number(id)));
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("newapi_user_id, email, first_name, last_name, username, country")
      .in("newapi_user_id", recipientIds);
    const userById = new Map<number, {
      newapi_user_id: number; email: string;
      first_name: string | null; last_name: string | null; username: string; country: string | null;
    }>();
    for (const u of users ?? []) userById.set(Number(u.newapi_user_id), u);

    let sent = sentSet.size;
    let failed = camp.failed_count ?? 0;
    const BUDGET_MS = 22_000;
    const start = Date.now();

    for (const uid of recipientIds) {
      if (Date.now() - start > BUDGET_MS) break;
      const u = userById.get(Number(uid));
      if (!u || !u.email) { failed++; continue; }
      const ok = await sendEmail({
        to: u.email,
        to_name: [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username,
        template_key: tplKey,
        subject: camp.subject_override || undefined,
        vars: {
          first_name: u.first_name ?? u.username,
          last_name: u.last_name ?? "",
          username: u.username,
          email: u.email,
          country: u.country ?? "",
        },
        campaign_id: camp.id,
        newapi_user_id: u.newapi_user_id,
      });
      if (ok) sent++; else failed++;
      // small breathing room — ZeptoMail handles ~10/s on free tier
      await new Promise((r) => setTimeout(r, 80));
    }

    const totalDone = sent + failed;
    const status = totalDone >= (camp.recipient_count ?? recipientIds.length)
      ? "completed" : "sending";

    await supabaseAdmin.from("email_campaigns").update({
      sent_count: sent,
      failed_count: failed,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq("id", camp.id);

    return { ok: true, sent, failed, status };
  });

export const adminDeleteEmailCampaign = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin.from("email_campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Send log ───────────────────────────────────────────────────────────

export const adminListEmailLog = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({
    status: z.enum(["sent", "failed"]).optional(),
    template_key: z.string().trim().max(80).optional(),
    search: z.string().trim().max(255).optional(),
    limit: z.number().int().min(1).max(200).default(100),
    offset: z.number().int().min(0).default(0),
  }).parse(input ?? {}))
  .handler(async ({ data }) => {
    await requireAdmin();
    let q = supabaseAdmin
      .from("email_send_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);
    if (data.status) q = q.eq("status", data.status);
    if (data.template_key) q = q.eq("template_key", data.template_key);
    if (data.search) q = q.ilike("to_email", `%${data.search}%`);
    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], total: count ?? 0 };
  });
