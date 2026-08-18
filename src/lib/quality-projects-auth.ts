import { getSession } from "@/lib/session";

export async function gateWrite() {
  const session = await getSession();
  if (!session) return { ok: false as const, status: 401 as const, session: null };
  if (session.role !== "system_admin") {
    const perm = session.pagePermissions?.["/quality-projects"];
    if (perm && perm !== "edit") return { ok: false as const, status: 403 as const, session };
  }
  return { ok: true as const, session };
}
