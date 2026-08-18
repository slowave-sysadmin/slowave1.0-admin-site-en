export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createSession } from "@/lib/session";
import { ensureAdminTable } from "@/lib/admin-seed";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    await ensureAdminTable();

    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: "아이디와 비밀번호를 입력해주세요." }, { status: 400 });
    }

    const rows = await query<{
      id: number;
      username: string;
      password_hash: string;
      name: string;
      role: "system_admin" | "admin";
      page_permissions: string | null;
      status: string;
    }[]>(
      "SELECT * FROM admin_users WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    const admin = rows[0];
    if (admin.status !== "active") {
      return NextResponse.json({ error: "비활성화된 계정입니다." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return NextResponse.json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    let pagePermissions: Record<string, string> | null = null;
    if (admin.page_permissions) {
      try {
        pagePermissions = typeof admin.page_permissions === "string"
          ? JSON.parse(admin.page_permissions)
          : admin.page_permissions;
      } catch {
        pagePermissions = null;
      }
    }

    await createSession({
      adminId: admin.id,
      username: admin.username,
      name: admin.name || admin.username,
      role: admin.role as "system_admin" | "admin",
      pagePermissions,
    });

    return NextResponse.json({
      username: admin.username,
      name: admin.name || admin.username,
      role: admin.role,
    });
  } catch (error) {
    console.error("POST /api/auth/login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
