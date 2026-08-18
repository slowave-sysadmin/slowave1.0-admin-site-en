export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { insertAndGetId } from "@/lib/db";
import { gateWrite } from "@/lib/quality-projects-auth";

type RouteContext = { params: Promise<{ id: string }> };

const VALID_KINDS = ["hypothesis", "experiment", "observation", "decision"];

export async function POST(req: NextRequest, ctx: RouteContext) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    const body = await req.json();
    if (!VALID_KINDS.includes(body.kind)) {
      return NextResponse.json({ error: "노드 종류가 올바르지 않습니다." }, { status: 400 });
    }
    if (!body.title) return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });

    const stepId = await insertAndGetId(
      `INSERT INTO problem_steps
       (problem_id, parent_step_id, kind, title, body, result_status, expected_result, actual_result, position_x, position_y)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        body.parent_step_id || null,
        body.kind,
        body.title,
        body.body || null,
        body.result_status || "planned",
        body.expected_result || null,
        body.actual_result || null,
        body.position_x ?? null,
        body.position_y ?? null,
      ]
    );

    return NextResponse.json({ step_id: stepId });
  } catch (error) {
    console.error("POST /api/quality-projects/[id]/steps error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
