export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ensureAdminTable } from "@/lib/admin-seed";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    await ensureAdminTable();
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data = await query(
      "SELECT id, username, name, role, page_permissions, status, created_at FROM admin_users ORDER BY id ASC"
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/admins error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureAdminTable();
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { username, password, name, role, page_permissions } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호는 필수입니다." }, { status: 400 });
    }

    // Only system_admin can create system_admin
    if (role === "system_admin" && session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자만 시스템관리자를 생성할 수 있습니다." }, { status: 403 });
    }

    const existing = await query<{ id: number }[]>(
      "SELECT id FROM admin_users WHERE username = ?",
      [username]
    );
    if (existing.length > 0) {
      return NextResponse.json({ error: "이미 사용 중인 아이디입니다." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 10);
    const id = await insertAndGetId(
      "INSERT INTO admin_users (username, password_hash, name, role, page_permissions) VALUES (?, ?, ?, ?, ?)",
      [username, hash, name || "", role || "admin", page_permissions ? JSON.stringify(page_permissions) : null]
    );

    return NextResponse.json({ id, message: "Created" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admins error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
