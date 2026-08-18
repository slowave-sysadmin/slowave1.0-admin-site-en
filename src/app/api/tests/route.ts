export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const search = searchParams.get("search") || "";
    const organizationId = searchParams.get("organization_id") || "";
    const status = searchParams.get("status") || "";
    const statusAnalysis = searchParams.get("status_analysis") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereClauses.push("(t.patient_name LIKE ? OR t.test_id LIKE ? OR t.serial_number LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (organizationId) {
      whereClauses.push("t.organization_id = ?");
      params.push(organizationId);
    }
    if (status) {
      whereClauses.push("t.status = ?");
      params.push(status);
    }
    if (statusAnalysis) {
      whereClauses.push("t.status_analysis = ?");
      params.push(statusAnalysis);
    }
    if (dateFrom) {
      whereClauses.push("t.created_at >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push("t.created_at < ?");
      params.push(dateTo + " 23:59:59");
    }
    const isReported = searchParams.get("is_reported");
    if (isReported !== null) {
      whereClauses.push("t.is_reported = ?");
      params.push(Number(isReported));
    }
    const reportFailed = searchParams.get("report_failed");
    if (reportFailed === "1") {
      whereClauses.push("t.is_reported = 0 AND t.status IN ('completed', 'returned', 'download_failed', 'upload_failed', 'delete_failed', 'init_failed')");
    }
    const notReturned = searchParams.get("not_returned");
    if (notReturned === "1") {
      whereClauses.push("t.status = 'rented'");
    }
    const other = searchParams.get("other");
    if (other === "1") {
      whereClauses.push("t.is_reported = 0 AND t.status NOT IN ('completed', 'returned', 'download_failed', 'upload_failed', 'delete_failed', 'init_failed', 'rented')");
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM tests t LEFT JOIN organizations o ON t.organization_id = o.organization_id ${where}`,
      params
    );
    const total = countResult[0].total;

    const data = await query(
      `SELECT t.*, o.organization_name,
              a.has_log, a.cradle_on_time, a.cradle_on_battery,
              a.impedance_time, a.impedance_ch1, a.impedance_ch2,
              a.analyzed_at, a.excluded, a.exclude_reason
       FROM tests t
       LEFT JOIN organizations o ON t.organization_id = o.organization_id
       LEFT JOIN test_analysis a ON t.test_id = a.test_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/tests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
