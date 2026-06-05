// Geo + IP helpers. Detect country from Cloudflare/Vercel/edge headers.
// Falls back to null when no header is present — caller must handle.
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

export function getClientCountryFromRequest(): string | null {
  const candidates = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-country-code",
    "fly-client-ip-country",
  ];
  for (const h of candidates) {
    const v = getRequestHeader(h);
    if (v && v !== "XX" && v !== "T1") return v.toUpperCase();
  }
  return null;
}

export function getClientIp(): string | null {
  return getRequestIP({ xForwardedFor: true }) ?? null;
}
