export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));

    const [
      orgCount,
      userCount,
      devicesByStatus,
      testsByStatus,
      recentTests,
      testsByDate,
      testsByOrg,
    ] = await Promise.all([
      query<{ total: number }[]>("SELECT COUNT(*) as total FROM organizations WHERE status = 'active'"),
      query<{ total: number }[]>("SELECT COUNT(*) as total FROM users WHERE status = 'active'"),
      query<{ status: string; count: number }[]>(
        "SELECT status, COUNT(*) as count FROM devices GROUP BY status"
      ),
      query<{ status: string; count: number }[]>(
        "SELECT status, COUNT(*) as count FROM tests GROUP BY status"
      ),
      query(
        `SELECT t.*, o.organization_name
         FROM tests t
         LEFT JOIN organizations o ON t.organization_id = o.organization_id
         ORDER BY t.created_at DESC
         LIMIT 10`
      ),
      query<{ date: string; count: number }[]>(
        `SELECT DATE(created_at) as date, COUNT(*) as count
         FROM tests
         WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY date ASC`,
        [days]
      ),
      query<{ organization_id: number; organization_name: string; total: number; report_success: number; report_failed: number; not_returned: number; other: number; prev_total: number }[]>(
        `SELECT
           cur.organization_id,
           cur.organization_name,
           cur.total,
           cur.report_success,
           cur.report_failed,
           cur.not_returned,
           cur.other,
           COALESCE(prev.total, 0) as prev_total
         FROM (
           SELECT
             t.organization_id,
             COALESCE(o.organization_name, '미지정') as organization_name,
             COUNT(*) as total,
             SUM(t.is_reported = 1) as report_success,
             SUM(t.is_reported = 0 AND t.status IN ('completed', 'returned', 'download_failed', 'upload_failed', 'delete_failed', 'init_failed')) as report_failed,
             SUM(t.status = 'rented') as not_returned,
             SUM(t.is_reported = 0 AND t.status NOT IN ('completed', 'returned', 'download_failed', 'upload_failed', 'delete_failed', 'init_failed', 'rented')) as other
           FROM tests t
           LEFT JOIN organizations o ON t.organization_id = o.organization_id
           WHERE t.created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY t.organization_id, o.organization_name
         ) cur
         LEFT JOIN (
           SELECT organization_id, COUNT(*) as total
           FROM tests
           WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
             AND created_at < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
           GROUP BY organization_id
         ) prev ON cur.organization_id = prev.organization_id
         ORDER BY cur.total DESC`
      ),
    ]);

    return NextResponse.json({
      totalOrganizations: orgCount[0].total,
      totalUsers: userCount[0].total,
      devicesByStatus,
      testsByStatus,
      recentTests,
      testsByDate,
      testsByOrg,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
