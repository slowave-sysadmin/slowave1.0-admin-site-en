export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { gateWrite } from "@/lib/quality-projects-auth";

type RouteContext = { params: Promise<{ id: string }> };

// Replace the full set of linked issues for a project
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    const body = await req.json();
    const issueIds: number[] = Array.isArray(body.issue_ids) ? body.issue_ids.map(Number).filter(Boolean) : [];

    await query(`DELETE FROM problem_issues WHERE problem_id = ?`, [id]);

    if (issueIds.length > 0) {
      const values = issueIds.map(() => "(?, ?, ?)").join(", ");
      const params: unknown[] = [];
      for (const iid of issueIds) {
        params.push(Number(id), iid, gate.session.username || null);
      }
      await query(
        `INSERT INTO problem_issues (problem_id, issue_id, linked_by) VALUES ${values}`,
        params
      );
    }

    return NextResponse.json({ ok: true, count: issueIds.length });
  } catch (error) {
    console.error("PUT /api/quality-projects/[id]/issues error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
