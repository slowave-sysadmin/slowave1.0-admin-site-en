export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const orgId = searchParams.get("organization_id") || "";
    const noted = searchParams.get("noted"); // "0" = uncommented only
    const offset = (page - 1) * limit;

    const statusFilter = searchParams.get("status_filter"); // "failed" = 미해결만, "resolved" = 해결됨만
    const whereClauses = ["(t.status_analysis IN ('analyze_failed', 'report_failed') OR afn.id IS NOT NULL)"];
    const params: unknown[] = [];

    if (orgId) {
      whereClauses.push("t.organization_id = ?");
      params.push(orgId);
    }
    if (noted === "0") {
      whereClauses.push("afn.id IS NULL");
    } else if (noted === "1") {
      whereClauses.push("afn.id IS NOT NULL");
    }
    if (statusFilter === "failed") {
      whereClauses.push("t.status_analysis IN ('analyze_failed', 'report_failed')");
    } else if (statusFilter === "resolved") {
      whereClauses.push("t.status_analysis = 'report_generated'");
      whereClauses.push("afn.id IS NOT NULL");
    }

    const where = `WHERE ${whereClauses.join(" AND ")}`;

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM tests t LEFT JOIN analysis_failure_notes afn ON afn.test_id = t.test_id ${where}`,
      params
    );

    const data = await query(
      `SELECT t.test_id, t.serial_number, t.organization_id, t.patient_name, t.status, t.status_analysis, t.created_at,
              o.organization_name,
              afn.id as note_id, afn.failure_reason_id, afn.note, afn.action_taken, afn.action_comment, afn.noted_by, afn.updated_at as note_updated_at,
              fr.name as failure_reason_name
       FROM tests t
       LEFT JOIN organizations o ON o.organization_id = t.organization_id
       LEFT JOIN analysis_failure_notes afn ON afn.test_id = t.test_id
       LEFT JOIN failure_reasons fr ON fr.id = afn.failure_reason_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return NextResponse.json({ data, total: countResult[0].total, page, limit });
  } catch (error) {
    console.error("GET /api/analysis-failures error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
