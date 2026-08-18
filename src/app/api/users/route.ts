export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashUserPassword } from "@/lib/password";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const search = searchParams.get("search") || "";
    const organizationId = searchParams.get("organization_id") || "";
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereClauses.push("(u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (organizationId) {
      whereClauses.push("u.organization_id = ?");
      params.push(organizationId);
    }
    const status = searchParams.get("status") || "";
    if (status) {
      whereClauses.push("u.status = ?");
      params.push(status);
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM users u ${where}`,
      params
    );
    const total = countResult[0].total;

    const data = await query(
      `SELECT u.*, o.organization_name
       FROM users u
       LEFT JOIN organizations o ON o.organization_id = u.organization_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organization_id, username, password, full_name,
      email, phone, role, status, memo,
    } = body;

    if (!password) {
      return NextResponse.json({ error: "비밀번호는 필수입니다." }, { status: 400 });
    }

    const passwordHash = await hashUserPassword(password);
    const id = await insertAndGetId(
      `INSERT INTO users (organization_id, username, password_hash, full_name, email, phone, role, status, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        organization_id, username, passwordHash, full_name || null,
        email || null, phone || null, role || "user", status || "active", memo || null,
      ]
    );

    await logAudit({
      entityType: "user",
      entityId: id,
      action: "create",
      changes: { username: { old: null, new: username } },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
