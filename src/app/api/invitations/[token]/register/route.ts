export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { hashUserPassword } from "@/lib/password";

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;

    // Validate token
    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM invitation_tokens WHERE token = ?",
      [token]
    );

    if (!rows.length) {
      return NextResponse.json({ error: "유효하지 않은 링크입니다." }, { status: 404 });
    }

    const invitation = rows[0];

    if (invitation.used_at) {
      return NextResponse.json({ error: "이미 사용된 링크입니다." }, { status: 410 });
    }

    if (new Date(invitation.expires_at as string) < new Date()) {
      return NextResponse.json({ error: "만료된 링크입니다." }, { status: 410 });
    }

    const body = await req.json();
    const { username, password, full_name, email, phone } = body;

    if (!username || !password) {
      return NextResponse.json({ error: "사용자명과 비밀번호는 필수입니다." }, { status: 400 });
    }

    // Check duplicate username
    const existing = await query<Record<string, unknown>[]>(
      "SELECT user_id FROM users WHERE username = ?",
      [username]
    );
    if (existing.length) {
      return NextResponse.json({ error: "이미 존재하는 사용자명입니다." }, { status: 409 });
    }

    const passwordHash = await hashUserPassword(password);
    const userId = await insertAndGetId(
      `INSERT INTO users (organization_id, username, password_hash, full_name, email, phone, role, status)
       VALUES (?, ?, ?, ?, ?, ?, 'user', 'active')`,
      [
        invitation.organization_id,
        username,
        passwordHash,
        full_name || null,
        email || null,
        phone || null,
      ]
    );

    // Mark token as used
    await query(
      "UPDATE invitation_tokens SET used_at = NOW() WHERE token = ?",
      [token]
    );

    await logAudit({
      entityType: "user",
      entityId: userId,
      action: "create",
      changes: { username: { old: null, new: username } },
      performedBy: "invitation",
    });

    return NextResponse.json({ user_id: userId, message: "가입이 완료되었습니다." }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invitations/[token]/register error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
