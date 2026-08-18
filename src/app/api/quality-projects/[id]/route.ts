export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { gateWrite } from "@/lib/quality-projects-auth";

type RouteContext = { params: Promise<{ id: string }> };

const EDITABLE = ["title", "background", "state"] as const;

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const rows = await query<Record<string, unknown>[]>(
      `SELECT * FROM problems WHERE problem_id = ? AND status = 'active' LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const steps = await query(
      `SELECT step_id, parent_step_id, kind, title, body, result_status,
              expected_result, actual_result, position_x, position_y, created_at, updated_at
       FROM problem_steps
       WHERE problem_id = ? AND status = 'active'
       ORDER BY created_at ASC`,
      [id]
    );

    const issues = await query(
      `SELECT i.issue_id, i.issue_no, i.received_at, i.problem_type, i.voc, i.response_stage,
              i.assignee, i.customer_org, i.test_id, pi.linked_at
       FROM problem_issues pi
       INNER JOIN issues i ON i.issue_id = pi.issue_id AND i.status = 'active'
       WHERE pi.problem_id = ?
       ORDER BY pi.linked_at DESC`,
      [id]
    );

    return NextResponse.json({ project: rows[0], steps, issues });
  } catch (error) {
    console.error("GET /api/quality-projects/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    const body = await req.json();
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of EDITABLE) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        sets.push(`${f} = ?`);
        values.push(body[f] === "" ? null : body[f]);
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: "변경 사항이 없습니다." }, { status: 400 });
    values.push(id);
    await query(`UPDATE problems SET ${sets.join(", ")} WHERE problem_id = ?`, values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/quality-projects/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    await query(`UPDATE problems SET status = 'deleted' WHERE problem_id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/quality-projects/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
