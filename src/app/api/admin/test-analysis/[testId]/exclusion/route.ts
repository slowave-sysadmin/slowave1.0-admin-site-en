export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ testId: string }> };

export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await getSession();
  if (!session || session.role !== "system_admin") {
    return NextResponse.json({ error: "시스템관리자만 분석 제외를 변경할 수 있습니다." }, { status: 403 });
  }

  try {
    const { testId } = await ctx.params;
    const body = await req.json();
    const excluded = body.excluded ? 1 : 0;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 200) || null : null;

    const rows = await query<{ test_id: string }[]>(
      "SELECT test_id FROM test_analysis WHERE test_id = ?",
      [testId]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "분석 데이터가 없습니다." }, { status: 404 });
    }

    if (excluded) {
      await query(
        `UPDATE test_analysis
         SET excluded = 1, exclude_reason = ?, excluded_by = ?, excluded_at = NOW()
         WHERE test_id = ?`,
        [reason, session.adminId, testId]
      );
    } else {
      await query(
        `UPDATE test_analysis
         SET excluded = 0, exclude_reason = NULL, excluded_by = NULL, excluded_at = NULL
         WHERE test_id = ?`,
        [testId]
      );
    }

    return NextResponse.json({ ok: true, excluded });
  } catch (error) {
    console.error("PUT /api/admin/test-analysis/[testId]/exclusion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
