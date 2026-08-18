export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM users WHERE user_id = ?",
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM users WHERE user_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const old = existing[0];

    // password는 이 엔드포인트에서 변경 불가 — 비밀번호 재설정 링크(/api/password-reset)를 통해서만 변경.
    const fields = [
      "organization_id", "username", "full_name",
      "email", "phone", "role", "status", "memo",
    ];
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

    params.push(id);

    await query(
      `UPDATE users SET ${updates.join(", ")} WHERE user_id = ?`,
      params
    );

    await logAudit({
      entityType: "user",
      entityId: Number(id),
      action: "update",
      changes,
    });

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM users WHERE user_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oldStatus = existing[0].status;
    await query(
      "UPDATE users SET status = 'deleted' WHERE user_id = ?",
      [id]
    );

    await logAudit({
      entityType: "user",
      entityId: Number(id),
      action: "delete",
      changes: { status: { old: oldStatus, new: "deleted" } },
    });

    return NextResponse.json({ message: "Deleted (soft)" });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
