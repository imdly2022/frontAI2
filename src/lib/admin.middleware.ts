// Admin gate. Checks that the current New API session corresponds to a row
// in public.admin_users. Throws Unauthorized / Forbidden so server fns
// stop before doing anything privileged.
import { requireSession } from "./session.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AdminContext = Awaited<ReturnType<typeof requireSession>> & {
  isAdmin: true;
  adminId: string;
};

export async function requireAdmin(): Promise<AdminContext> {
  const session = await requireSession();
  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id, newapi_user_id")
    .eq("newapi_user_id", session.auth.userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin access required");
  return { ...session, isAdmin: true, adminId: data.id };
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    await requireAdmin();
    return true;
  } catch {
    return false;
  }
}
