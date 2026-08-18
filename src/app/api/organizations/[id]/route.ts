export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM organizations WHERE organization_id = ?",
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET /api/organizations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM organizations WHERE organization_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const old = existing[0];

    const fields = ["organization_name", "organization_phone", "organization_address", "status"];
    const updates: string[] = [];
    const params: unknown[] = [];
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const field of fields) {
      if (body[field] !== undefined && body[field] !== old[field]) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
        changes[field] = { old: old[field], new: body[field] };
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes" });
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    await query(
      `UPDATE organizations SET ${updates.join(", ")} WHERE organization_id = ?`,
      params
    );

    await logAudit({
      entityType: "organization",
      entityId: Number(id),
      action: "update",
      changes,
    });

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/organizations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM organizations WHERE organization_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oldStatus = existing[0].status;
    await query(
      "UPDATE organizations SET status = 'inactive', updated_at = NOW() WHERE organization_id = ?",
      [id]
    );

    await logAudit({
      entityType: "organization",
      entityId: Number(id),
      action: "delete",
      changes: { status: { old: oldStatus, new: "inactive" } },
    });

    return NextResponse.json({ message: "Deleted (soft)" });
  } catch (error) {
    console.error("DELETE /api/organizations/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
