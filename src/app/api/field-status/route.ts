export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const data = await query<Record<string, unknown>[]>(
      `SELECT
         o.organization_id,
         o.organization_name,
         o.status,
         COALESCE(oc.category, 'none') as category,
         oc.description as category_description,
         COUNT(DISTINCT d.device_id) as sensor_total,
         SUM(CASE WHEN d.status = 'available' THEN 1 ELSE 0 END) as sensor_active,
         COALESCE(ts.test_count, 0) as test_count,
         COALESCE(ts.failure_count, 0) as failure_count,
         ts.last_test_at,
         ul.last_login_at
       FROM organizations o
       LEFT JOIN organization_categories oc ON oc.organization_id = o.organization_id
       LEFT JOIN devices d ON d.organization_id = o.organization_id
       LEFT JOIN (
         SELECT organization_id,
                COUNT(*) as test_count,
                SUM(CASE WHEN status_analysis IN ('analyze_failed', 'report_failed') THEN 1 ELSE 0 END) as failure_count,
                MAX(created_at) as last_test_at
         FROM tests
         GROUP BY organization_id
       ) ts ON ts.organization_id = o.organization_id
       LEFT JOIN (
         SELECT u.organization_id, MAX(u.last_login_at) as last_login_at
         FROM users u
         WHERE u.status = 'active'
         GROUP BY u.organization_id
       ) ul ON ul.organization_id = o.organization_id
       WHERE o.status = 'active' AND o.organization_id != 0
       GROUP BY o.organization_id, o.organization_name, o.status, oc.category, ts.test_count, ts.failure_count, ts.last_test_at, ul.last_login_at
       ORDER BY oc.category ASC, o.organization_name ASC`
    );

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/field-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
