export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { gateWrite } from "@/lib/quality-projects-auth";

interface ProjectRow {
  problem_id: number;
  title: string;
  background: string | null;
  state: string;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  issue_count: number;
  step_count: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const stateFilter = searchParams.get("state") || "";
    const where: string[] = ["p.status = 'active'"];
    const params: unknown[] = [];
    if (stateFilter) { where.push("p.state = ?"); params.push(stateFilter); }

    const data = await query<ProjectRow[]>(
      `SELECT p.*,
              (SELECT COUNT(*) FROM problem_issues pi WHERE pi.problem_id = p.problem_id) AS issue_count,
              (SELECT COUNT(*) FROM problem_steps ps WHERE ps.problem_id = p.problem_id AND ps.status = 'active') AS step_count
       FROM problems p
       WHERE ${where.join(" AND ")}
       ORDER BY p.problem_id ASC`,
      params
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/quality-projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const gate = await gateWrite();
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const body = await req.json();
    if (!body.title) return NextResponse.json({ error: "제목은 필수입니다." }, { status: 400 });

    const id = await insertAndGetId(
      `INSERT INTO problems (title, background, created_by) VALUES (?, ?, ?)`,
      [body.title, body.background || null, gate.session.username || null]
    );
    return NextResponse.json({ problem_id: id });
  } catch (error) {
    console.error("POST /api/quality-projects error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
