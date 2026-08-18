export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { hashUserPassword } from "@/lib/password";

type RouteContext = { params: Promise<{ token: string }> };

// GET: validate token, return username
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;

    const rows = await query<Record<string, unknown>[]>(
      `SELECT p.*, u.username, u.full_name
       FROM password_reset_tokens p
       LEFT JOIN users u ON p.user_id = u.user_id
       WHERE p.token = ?`,
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
    }

    const row = rows[0];

    if (row.used_at) {
      return NextResponse.json({ error: "이미 사용된 링크입니다." }, { status: 410 });
    }
    if (new Date(row.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "만료된 링크입니다." }, { status: 410 });
    }

    return NextResponse.json({
      username: row.username,
      full_name: row.full_name,
    });
  } catch (error) {
    console.error("GET /api/password-reset/[token] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: change password
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;
    const { password } = await req.json();

    if (!password || password.length < 4) {
      return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다." }, { status: 400 });
    }

    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM password_reset_tokens WHERE token = ?",
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
    }

    const row = rows[0];

    if (row.used_at) {
      return NextResponse.json({ error: "이미 사용된 링크입니다." }, { status: 410 });
    }
    if (new Date(row.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "만료된 링크입니다." }, { status: 410 });
    }

    const passwordHash = await hashUserPassword(password);
    await query(
      "UPDATE users SET password_hash = ? WHERE user_id = ?",
      [passwordHash, row.user_id]
    );

    // Mark token as used
    await query(
      "UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?",
      [token]
    );

    return NextResponse.json({ message: "비밀번호가 변경되었습니다." });
  } catch (error) {
    console.error("PUT /api/password-reset/[token] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
