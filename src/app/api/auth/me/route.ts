export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    adminId: session.adminId,
    username: session.username,
    name: session.name,
    role: session.role,
    pagePermissions: session.pagePermissions,
  });
}
