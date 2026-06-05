// Server-only session helpers (encrypted cookie).
import { useSession } from "@tanstack/react-start/server";
import type { UserAuth } from "./newapi.server";

export type AppSession = {
  /** Optional long-lived New API access token (Bearer). */
  newApiToken?: string;
  /** Session cookie captured from New API /api/user/login. */
  newApiCookie?: string;
  userId?: number;
  username?: string;
  email?: string;
  displayName?: string;
};

const SESSION_NAME = "novagate_session";

function getSessionPassword(): string {
  const p = process.env.SESSION_SECRET ?? process.env.SESSION_PASSWORD;
  if (p && p.length >= 32) return p;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be set to a value of at least 32 characters in production.",
    );
  }
  // Development-only fallback. Never used when NODE_ENV === 'production'.
  return "dev-only-change-me-please-this-is-long-enough-32chars";
}

export async function getAppSession() {
  return useSession<AppSession>({
    password: getSessionPassword(),
    name: SESSION_NAME,
    maxAge: 60 * 60 * 24 * 30,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
  });
}

export type SessionContext = {
  auth: UserAuth;
  username: string;
  email?: string;
};

export async function requireSession(): Promise<SessionContext> {
  const s = await getAppSession();
  const userId = s.data.userId;
  const cookie = s.data.newApiCookie;
  const token = s.data.newApiToken;
  if (!userId || (!cookie && !token)) {
    throw new Error("Unauthorized");
  }
  return {
    auth: { userId, cookie, token },
    username: s.data.username ?? "",
    email: s.data.email,
  };
}
