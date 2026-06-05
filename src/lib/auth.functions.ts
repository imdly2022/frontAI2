// Auth proxy: forwards login/register to New API and stores the returned
// session cookie (+ optional access token) in our encrypted cookie session.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAppSession } from "./session.server";
import {
  newapiAdminSearchUsers,
  newapiAdminTopUp,
  newapiGetSelf,
  newapiLogin,
  newapiRegister,
  usdToQuota,
  type NewApiUser,
} from "./newapi.server";
import { getCookie, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fireS2S, readAttribFromCookie } from "./tracking/s2s.server";
import { firePostbacks } from "./payments/postback.server";
import { randomUUID } from "crypto";
import { isBlockedCountry } from "./countries";
import { getClientCountryFromRequest } from "./geo.server";
import { sendEmail } from "./email.server";




const credSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(6).max(128),
});

export const login = createServerFn({ method: "POST" })
  .inputValidator((input) => credSchema.parse(input))
  .handler(async ({ data }) => {
    const { user, cookie } = await newapiLogin(data.username, data.password);
    if (!cookie && !user.access_token) {
      throw new Error("Login succeeded but New API returned no session cookie or access token");
    }
    const session = await getAppSession();
    await session.update({
      newApiCookie: cookie,
      newApiToken: user.access_token,
      userId: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
    });
    // Lazy-backfill local users table for accounts predating it. Also
    // recover affiliate attribution from any signup conversion if the
    // register flow couldn't resolve the NewAPI id at that time.
    try {
      const { data: conv } = await supabaseAdmin
        .from("affiliate_conversions")
        .select("affiliate_id, click_id")
        .eq("newapi_user_id", user.id)
        .eq("event", "signup")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const { data: existing } = await supabaseAdmin
        .from("users")
        .select("affiliate_id, click_id")
        .eq("newapi_user_id", user.id)
        .maybeSingle();
      const row: {
        newapi_user_id: number;
        username: string;
        email: string;
        display_name: string | null;
        last_login_at: string;
        affiliate_id?: string;
        click_id?: string;
      } = {
        newapi_user_id: user.id,
        username: user.username,
        email: user.email ?? `${user.username}@unknown.local`,
        display_name: user.display_name ?? null,
        last_login_at: new Date().toISOString(),
      };
      if (!existing?.affiliate_id && conv?.affiliate_id) row.affiliate_id = conv.affiliate_id;
      const convClickId = (conv as { click_id?: string | null } | null)?.click_id;
      if (!existing?.click_id && convClickId) row.click_id = convClickId;
      await supabaseAdmin.from("users").upsert(row, { onConflict: "newapi_user_id" });
    } catch (e) { console.error("users login upsert failed", e); }
    return { id: user.id, username: user.username, email: user.email };
  });

export const register = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
        password: z.string().min(8).max(128),
        email: z.string().trim().email().max(255),
        verification_code: z.string().trim().max(32).optional(),
        first_name: z.string().trim().min(1).max(80),
        last_name: z.string().trim().min(1).max(80),
        country: z.string().trim().length(2).toUpperCase(),
        phone: z.string().trim().max(40).regex(/^[+\d\s\-()]*$/).optional().or(z.literal("")),
        accept_terms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Privacy Policy" }) }),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Country gate — block sanctioned / restricted jurisdictions
    if (isBlockedCountry(data.country)) {
      throw new Error("Registration is not available in your country.");
    }
    // Also block based on IP country if available — defence in depth
    const ipCountry = getClientCountryFromRequest();
    if (isBlockedCountry(ipCountry)) {
      throw new Error("Registration is not available from your location.");
    }

    // Local users table is the source of truth for email uniqueness — NewAPI
    // does NOT enforce it. Fast lookup, no NewAPI roundtrip.
    const { data: existingEmail } = await supabaseAdmin
      .from("users")
      .select("id")
      .ilike("email", data.email)
      .maybeSingle();
    if (existingEmail) throw new Error("An account with this email already exists");

    const { data: existingName } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existingName) throw new Error("This username is already taken");

    let affCode: string | undefined;
    let affiliateId: string | undefined;
    const clickId = getCookie("aff_click");
    if (clickId) {
      const { data: click } = await supabaseAdmin
        .from("affiliate_clicks")
        .select("affiliate_id, affiliates(slug)")
        .eq("click_id", clickId)
        .maybeSingle();
      const slug = (click as { affiliates?: { slug?: string } } | null)?.affiliates?.slug;
      affiliateId = (click as { affiliate_id?: string } | null)?.affiliate_id;
      if (slug) affCode = slug;
    }
    const res = await newapiRegister({
      username: data.username,
      password: data.password,
      email: data.email,
      verification_code: data.verification_code,
      aff_code: affCode,
    });

    // NewAPI /register often returns { success: true, data: null } without a
    // user object. Resolve the id via admin search so we always mirror it.
    let newapiUserId: number | undefined = res.data?.id;
    const displayName: string | null = res.data?.display_name ?? `${data.first_name} ${data.last_name}`.trim();
    if (!newapiUserId) {
      try {
        const search = await newapiAdminSearchUsers(data.username);
        const match = (search.data ?? []).find((u: NewApiUser) => u.username === data.username);
        if (match) {
          newapiUserId = match.id;
        }
      } catch (e) {
        console.error("users post-register lookup failed", e);
      }
    }

    const ip = getRequestIP({ xForwardedFor: true }) ?? null;
    const now = new Date().toISOString();

    // Mirror into local users table.
    if (newapiUserId) {
      try {
        await supabaseAdmin.from("users").upsert(
          {
            newapi_user_id: newapiUserId,
            username: data.username,
            email: data.email,
            display_name: displayName,
            first_name: data.first_name,
            last_name: data.last_name,
            country: data.country,
            phone: data.phone || null,
            register_ip: ip,
            register_country: ipCountry,
            terms_accepted_at: now,
            privacy_accepted_at: now,
            affiliate_id: affiliateId ?? null,
            click_id: clickId ?? null,
            last_login_at: now,
          },
          { onConflict: "newapi_user_id" },
        );
      } catch (e) {
        console.error("users mirror insert failed", e);
      }
    } else {
      console.error("users mirror skipped: could not resolve newapi_user_id for", data.username);
    }

    // Signup bonus (best-effort): grant configured welcome credits and
    // record the grant as a paid payment_intents row so it appears in the
    // user's billing/transactions history.
    if (newapiUserId) {
      try {
        const { data: bonusRow } = await supabaseAdmin
          .from("site_settings").select("value").eq("key", "signup_bonus").maybeSingle();
        const cfg = (bonusRow?.value ?? null) as { enabled?: boolean; amount_usd?: number; note?: string } | null;
        const amount = Number(cfg?.amount_usd ?? 0);
        if (cfg?.enabled && amount > 0) {
          await newapiAdminTopUp({
            user_id: newapiUserId,
            quota: usdToQuota(amount),
            remark: cfg.note ?? "Welcome bonus",
          });
          await supabaseAdmin.from("payment_intents").insert({
            newapi_user_id: newapiUserId,
            amount_usd: amount,
            credits: amount,
            bonus_credits: 0,
            provider: "signup_bonus",
            status: "paid",
            paid_at: new Date().toISOString(),
            meta: { note: cfg.note ?? "Welcome bonus", source: "signup_bonus" },
          });
        }
      } catch (e) { console.error("signup bonus grant failed", e); }
    }



    // Welcome email (best-effort, uses 'welcome' template)
    try {
      await sendEmail({
        to: data.email,
        to_name: `${data.first_name} ${data.last_name}`.trim(),
        template_key: "welcome",
        newapi_user_id: newapiUserId ?? null,
        vars: {
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          email: data.email,
        },
      });
    } catch (e) { console.error("welcome email failed", e); }


    if (affiliateId) {
      try {
        const { data: conv } = await supabaseAdmin
          .from("affiliate_conversions")
          .insert({
            affiliate_id: affiliateId,
            click_id: clickId ?? null,
            newapi_user_id: newapiUserId ?? res.data?.id ?? null,
            event: "signup",
            amount_usd: 0,
            commission_usd: 0,
            currency: "USD",
            status: "approved",
          })
          .select("id")
          .single();
        await firePostbacks({
          affiliate_id: affiliateId,
          click_id: clickId ?? null,
          event: "signup",
          amount_usd: 0,
          commission_usd: 0,
          currency: "USD",
          transaction_id: conv?.id ?? `signup-${res.data?.id ?? randomUUID()}`,
          newapi_user_id: res.data?.id ?? null,
        });
      } catch (e) { console.error("signup postback failed", e); }
    }

    try {
      const attrib = readAttribFromCookie(getCookie("tt_attrib"));
      await fireS2S({
        event: "Lead",
        event_id: `signup-${res.data?.id ?? randomUUID()}`,
        email: data.email,
        ip: getRequestIP({ xForwardedFor: true }) ?? undefined,
        user_agent: getRequestHeader("user-agent") ?? undefined,
        attrib,
      });
    } catch (e) { console.error("S2S signup failed", e); }

    return { id: res.data?.id ?? null };
  });


export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAppSession();
  await session.clear();
  return { ok: true };
});

export const me = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAppSession();
  const userId = session.data.userId;
  if (!userId || (!session.data.newApiCookie && !session.data.newApiToken)) return null;
  try {
    const res = await newapiGetSelf({
      userId,
      cookie: session.data.newApiCookie,
      token: session.data.newApiToken,
    });
    return res.data ?? null;
  } catch {
    return {
      id: userId,
      username: session.data.username ?? "",
      email: session.data.email,
      display_name: session.data.displayName,
    };
  }
});
