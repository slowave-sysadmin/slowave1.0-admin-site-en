export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

interface Row {
  test_id: string;
  serial_number: string;
  patient_name: string;
  status: string;
  organization_id: number;
  organization_name: string | null;
  created_at: string;
  cradle_on_time: string;
  cradle_on_battery: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const organizationId = searchParams.get("organization_id") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";

    const where: string[] = [
      "a.has_log = 1",
      "a.cradle_on_time IS NOT NULL",
      "a.cradle_on_battery IS NOT NULL",
      "a.excluded = 0",
    ];
    const params: unknown[] = [];
    if (organizationId) {
      where.push("t.organization_id = ?");
      params.push(organizationId);
    }
    if (dateFrom) {
      where.push("t.created_at >= ?");
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push("t.created_at < ?");
      params.push(dateTo + " 23:59:59");
    }

    const data = await query<Row[]>(
      `SELECT t.test_id, t.serial_number, t.patient_name, t.status,
              t.organization_id, o.organization_name,
              t.created_at, a.cradle_on_time, a.cradle_on_battery
       FROM tests t
       JOIN test_analysis a ON t.test_id = a.test_id
       LEFT JOIN organizations o ON t.organization_id = o.organization_id
       WHERE ${where.join(" AND ")}
       ORDER BY t.created_at DESC`,
      params
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/test-analysis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
