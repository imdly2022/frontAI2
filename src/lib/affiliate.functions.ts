// Attribution capture. Runs on every page load via the root component.
//
// Two cookies are maintained:
//   - aff_click: uuid of the affiliate_clicks row (only when ?ref=SLUG matched
//     a real affiliate). Used to attribute signups + payments back.
//   - tt_attrib: JSON {utm_*, fbclid, gclid, ttclid, ts} captured for all
//     traffic so we can fire Facebook/Google/TikTok S2S conversions on
//     register & payment events even without an affiliate.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { setCookie, getRequestHeader, getRequestIP } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const attribInput = z.object({
  ref: z.string().trim().min(1).max(64).optional(),
  sub1: z.string().trim().max(128).optional(),
  sub2: z.string().trim().max(128).optional(),
  sub3: z.string().trim().max(128).optional(),
  sub4: z.string().trim().max(128).optional(),
  sub5: z.string().trim().max(128).optional(),
  landing: z.string().trim().max(512).optional(),
  utm_source: z.string().trim().max(128).optional(),
  utm_medium: z.string().trim().max(128).optional(),
  utm_campaign: z.string().trim().max(128).optional(),
  utm_content: z.string().trim().max(128).optional(),
  utm_term: z.string().trim().max(128).optional(),
  fbclid: z.string().trim().max(256).optional(),
  gclid: z.string().trim().max(256).optional(),
  ttclid: z.string().trim().max(256).optional(),
});

export const trackClick = createServerFn({ method: "POST" })
  .inputValidator((input) => attribInput.parse(input))
  .handler(async ({ data }) => {
    const ua = getRequestHeader("user-agent") ?? null;
    const referrer = getRequestHeader("referer") ?? null;
    const ip = getRequestIP({ xForwardedFor: true }) ?? null;

    // Always persist UTM + click IDs in a cookie so we can fire S2S later
    // even for non-affiliate traffic.
    const attrib = {
      utm_source: data.utm_source,
      utm_medium: data.utm_medium,
      utm_campaign: data.utm_campaign,
      utm_content: data.utm_content,
      utm_term: data.utm_term,
      fbclid: data.fbclid,
      gclid: data.gclid,
      ttclid: data.ttclid,
      ts: Date.now(),
    };
    const hasAny = Object.values(attrib).some((v) => typeof v === "string" && v.length > 0);
    if (hasAny) {
      setCookie("tt_attrib", JSON.stringify(attrib), {
        httpOnly: true, sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/", maxAge: 60 * 60 * 24 * 60,
      });
    }

    if (!data.ref) return { tracked: false, attrib: hasAny };

    const { data: aff } = await supabaseAdmin
      .from("affiliates")
      .select("id, status")
      .eq("slug", data.ref)
      .eq("status", "active")
      .maybeSingle();
    if (!aff) return { tracked: false, attrib: hasAny };

    const { data: row, error } = await supabaseAdmin
      .from("affiliate_clicks")
      .insert({
        affiliate_id: aff.id,
        sub1: data.sub1, sub2: data.sub2, sub3: data.sub3,
        sub4: data.sub4, sub5: data.sub5,
        user_agent: ua, referrer, ip,
        landing_path: data.landing,
        utm_source: data.utm_source, utm_medium: data.utm_medium,
        utm_campaign: data.utm_campaign, utm_content: data.utm_content,
        utm_term: data.utm_term,
        fbclid: data.fbclid, gclid: data.gclid, ttclid: data.ttclid,
      })
      .select("click_id")
      .single();
    if (error) throw new Error(error.message);

    setCookie("aff_click", row.click_id, {
      httpOnly: true, sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: 60 * 60 * 24 * 60,
    });
    return { tracked: true, attrib: hasAny };
  });
