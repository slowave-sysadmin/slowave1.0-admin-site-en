export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await ctx.params;
    const body = await req.json();

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.status !== undefined) {
      updates.push("status = ?");
      params.push(body.status);
    }
    if (body.reply !== undefined) {
      updates.push("reply = ?, replied_by = ?, replied_at = NOW()");
      params.push(body.reply, session.username);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes" });
    }

    params.push(id);
    await query(
      `UPDATE support_requests SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/support-requests/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
