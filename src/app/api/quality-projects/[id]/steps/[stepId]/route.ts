export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { gateWrite } from "@/lib/quality-projects-auth";

type RouteContext = { params: Promise<{ id: string; stepId: string }> };

const EDITABLE = [
  "parent_step_id", "kind", "title", "body", "result_status",
  "expected_result", "actual_result", "position_x", "position_y",
] as const;

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id, stepId } = await ctx.params;
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
    values.push(stepId, id);
    await query(
      `UPDATE problem_steps SET ${sets.join(", ")} WHERE step_id = ? AND problem_id = ?`,
      values
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT step error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id, stepId } = await ctx.params;
    // 자식 노드도 함께 soft-delete (재귀적으로)
    await query(
      `UPDATE problem_steps SET parent_step_id = NULL WHERE parent_step_id = ? AND problem_id = ?`,
      [stepId, id]
    );
    await query(
      `UPDATE problem_steps SET status = 'deleted' WHERE step_id = ? AND problem_id = ?`,
      [stepId, id]
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE step error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
