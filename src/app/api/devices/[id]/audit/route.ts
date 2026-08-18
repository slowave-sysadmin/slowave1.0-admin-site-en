export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const offset = (page - 1) * limit;

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM audit_logs WHERE entity_type = 'device' AND entity_id = ?`,
      [id]
    );
    const total = countResult[0].total;

    const data = await query(
      `SELECT * FROM audit_logs WHERE entity_type = 'device' AND entity_id = ? ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      [id]
    );

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/devices/[id]/audit error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
