export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ token: string }> };

// GET: validate token and return org info
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { token } = await ctx.params;

    const rows = await query<Record<string, unknown>[]>(
      `SELECT i.*, o.organization_name
       FROM invitation_tokens i
       LEFT JOIN organizations o ON i.organization_id = o.organization_id
       WHERE i.token = ?`,
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

    return NextResponse.json({
      organization_id: invitation.organization_id,
      organization_name: invitation.organization_name,
      expires_at: invitation.expires_at,
    });
  } catch (error) {
    console.error("GET /api/invitations/[token] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
