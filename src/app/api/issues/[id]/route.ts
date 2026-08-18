export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

type RouteContext = { params: Promise<{ id: string }> };

const EDITABLE_FIELDS = [
  "reporter", "received_at", "problem_type", "voc", "response_stage",
  "assignee", "customer_org", "product_type", "product_used", "firmware_ver",
  "occurred_at", "end_user", "test_id", "recovered_at",
  "problem_check", "root_cause", "action_date", "customer_response", "status",
] as const;

function gateWrite(session: { role: string; pagePermissions: Record<string, string> | null } | null) {
  if (!session) return { ok: false, status: 401 as const };
  if (session.role !== "system_admin") {
    const perm = session.pagePermissions?.["/issues"];
    if (perm && perm !== "edit") return { ok: false, status: 403 as const };
  }
  return { ok: true as const };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const rows = await query<Record<string, unknown>[]>(
      `SELECT * FROM issues WHERE issue_id = ? LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const attachments = await query(
      `SELECT attachment_id, file_name, s3_key, mime_type, size_bytes, uploaded_by, uploaded_at
       FROM issue_attachments WHERE issue_id = ? AND status = 'active' ORDER BY uploaded_at ASC`,
      [id]
    );
    return NextResponse.json({ issue: rows[0], attachments });
  } catch (error) {
    console.error("GET /api/issues/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    const gate = gateWrite(session);
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    const body = await req.json();

    if (body.test_id) {
      const exists = await query<{ test_id: string }[]>(
        `SELECT test_id FROM tests WHERE test_id = ? LIMIT 1`,
        [body.test_id]
      );
      if (exists.length === 0) {
        return NextResponse.json({ error: `검사 ID '${body.test_id}'를 찾을 수 없습니다.` }, { status: 409 });
      }
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    for (const f of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(body, f)) {
        sets.push(`${f} = ?`);
        values.push(body[f] === "" ? null : body[f]);
      }
    }
    if (sets.length === 0) return NextResponse.json({ error: "변경 사항이 없습니다." }, { status: 400 });

    values.push(id);
    await query(`UPDATE issues SET ${sets.join(", ")} WHERE issue_id = ?`, values);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("PUT /api/issues/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    const gate = gateWrite(session);
    if (!gate.ok) return NextResponse.json({ error: "권한이 없습니다." }, { status: gate.status });

    const { id } = await ctx.params;
    await query(`UPDATE issues SET status = 'deleted' WHERE issue_id = ?`, [id]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE /api/issues/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
