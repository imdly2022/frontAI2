// User profile + password reset server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomInt } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSession } from "./session.server";
import { getClientCountryFromRequest, getClientIp } from "./geo.server";
import { isBlockedCountry } from "./countries";
import { sendEmail } from "./email.server";
import { newapiAdminSearchUsers, newapiAdminUpdatePassword, type NewApiUser } from "./newapi.server";

// ─── Geo: detect IP country (used by register UI) ────────────────────────

export const detectCountry = createServerFn({ method: "GET" }).handler(async () => {
  const country = getClientCountryFromRequest();
  return {
    country,
    blocked: isBlockedCountry(country),
    ip: getClientIp(),
  };
});

// ─── Self profile ────────────────────────────────────────────────────────

export const getMyProfile = createServerFn({ method: "GET" }).handler(async () => {
  const { auth } = await requireSession();
  const { data, error } = await supabaseAdmin
    .from("users")
    .select(
      "id, newapi_user_id, username, email, display_name, first_name, last_name, country, phone, register_ip, register_country, terms_accepted_at, privacy_accepted_at, created_at",
    )
    .eq("newapi_user_id", auth.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

const profileUpdateSchema = z.object({
  first_name: z.string().trim().max(80).nullish(),
  last_name: z.string().trim().max(80).nullish(),
  country: z.string().trim().length(2).nullish(),
  phone: z.string().trim().max(40).regex(/^[+\d\s\-()]*$/).nullish(),
  display_name: z.string().trim().max(80).nullish(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .inputValidator((input) => profileUpdateSchema.parse(input))
  .handler(async ({ data }) => {
    const { auth } = await requireSession();
    const patch: {
      first_name?: string | null;
      last_name?: string | null;
      country?: string | null;
      phone?: string | null;
      display_name?: string | null;
      updated_at: string;
    } = { updated_at: new Date().toISOString() };
    if (data.first_name !== undefined) patch.first_name = data.first_name || null;
    if (data.last_name !== undefined) patch.last_name = data.last_name || null;
    if (data.country !== undefined) patch.country = (data.country || null)?.toUpperCase() ?? null;
    if (data.phone !== undefined) patch.phone = data.phone || null;
    if (data.display_name !== undefined) patch.display_name = data.display_name || null;
    const { error } = await supabaseAdmin
      .from("users")
      .update(patch)
      .eq("newapi_user_id", auth.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Password reset (email code) ─────────────────────────────────────────

function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ email: z.string().trim().email().max(255) }).parse(input),
  )
  .handler(async ({ data }) => {
    // Lookup user (silently no-op if not found to avoid leaking emails).
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("newapi_user_id, email, first_name, username")
      .ilike("email", data.email)
      .maybeSingle();

    // Rate limit: max 3 requests / 15 min per email
    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id", { count: "exact", head: true })
      .ilike("email", data.email)
      .gte("created_at", since);
    if ((count ?? 0) >= 3) {
      throw new Error("Too many requests. Please try again in 15 minutes.");
    }

    if (user) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const expires_at = new Date(Date.now() + 15 * 60_000).toISOString();
      await supabaseAdmin.from("password_reset_tokens").insert({
        email: data.email,
        newapi_user_id: user.newapi_user_id,
        code_hash: hashCode(code),
        expires_at,
        ip: getClientIp(),
      });
      await sendEmail({
        to: data.email,
        to_name: user.first_name || user.username,
        template_key: "password_reset",
        newapi_user_id: user.newapi_user_id ?? null,
        vars: {
          first_name: user.first_name || user.username || "there",
          username: user.username ?? "",
          email: data.email,
          code,
        },
      });
    }
    // Always return ok to avoid email enumeration.
    return { ok: true };
  });

export const verifyPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        code: z.string().trim().regex(/^\d{6}$/),
        new_password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: token } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, code_hash, expires_at, used_at, attempts, newapi_user_id")
      .ilike("email", data.email)
      .is("used_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!token) throw new Error("Invalid or expired code");
    if (new Date(token.expires_at).getTime() < Date.now())
      throw new Error("Code expired. Please request a new one.");
    if ((token.attempts ?? 0) >= 5) throw new Error("Too many attempts");

    if (token.code_hash !== hashCode(data.code)) {
      await supabaseAdmin
        .from("password_reset_tokens")
        .update({ attempts: (token.attempts ?? 0) + 1 })
        .eq("id", token.id);
      throw new Error("Invalid code");
    }

    // Resolve NewAPI user id (fallback to admin search by email)
    let userId = token.newapi_user_id;
    if (!userId) {
      const s = await newapiAdminSearchUsers(data.email);
      const match = (s.data ?? []).find((u: NewApiUser) => u.email === data.email);
      userId = match?.id ?? null;
    }
    if (!userId) throw new Error("Account not found");

    await newapiAdminUpdatePassword({ user_id: userId, password: data.new_password });

    await supabaseAdmin
      .from("password_reset_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", token.id);

    // Lookup user for personalised email
    const { data: u } = await supabaseAdmin
      .from("users").select("first_name, username")
      .ilike("email", data.email).maybeSingle();
    await sendEmail({
      to: data.email,
      to_name: u?.first_name || u?.username,
      template_key: "password_changed",
      newapi_user_id: userId,
      vars: {
        first_name: u?.first_name || u?.username || "there",
        username: u?.username ?? "",
        email: data.email,
      },
    });
    return { ok: true };
  });
