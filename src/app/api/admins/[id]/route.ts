export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import bcrypt from "bcryptjs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM admin_users WHERE id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const target = existing[0];

    // Only system_admin can modify system_admin accounts
    if (target.role === "system_admin" && session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자 계정은 시스템관리자만 수정할 수 있습니다." }, { status: 403 });
    }

    // Only system_admin can change roles to system_admin
    if (body.role === "system_admin" && session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자 역할은 시스템관리자만 부여할 수 있습니다." }, { status: 403 });
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (body.name !== undefined) {
      updates.push("name = ?");
      params.push(body.name);
    }
    if (body.role !== undefined) {
      updates.push("role = ?");
      params.push(body.role);
    }
    if (body.status !== undefined) {
      updates.push("status = ?");
      params.push(body.status);
    }
    if (body.page_permissions !== undefined) {
      updates.push("page_permissions = ?");
      params.push(body.page_permissions ? JSON.stringify(body.page_permissions) : null);
    }
    if (body.password) {
      const hash = await bcrypt.hash(body.password, 10);
      updates.push("password_hash = ?");
      params.push(hash);
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes" });
    }

    params.push(id);
    await query(
      `UPDATE admin_users SET ${updates.join(", ")} WHERE id = ?`,
      params
    );

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/admins/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

