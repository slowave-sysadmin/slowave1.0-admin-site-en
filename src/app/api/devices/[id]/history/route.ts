export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    // Get device info to find serial_number
    const deviceRows = await query<{ product_serial_number: string; organization_id: number }[]>(
      "SELECT product_serial_number, organization_id FROM devices WHERE device_id = ?",
      [id]
    );
    if (!deviceRows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const serial = deviceRows[0].product_serial_number;

    // Tests for this sensor
    const tests = await query(
      `SELECT t.test_id, t.patient_name, t.status, t.status_analysis, t.created_at,
              t.organization_id, o.organization_name
       FROM tests t
       LEFT JOIN organizations o ON o.organization_id = t.organization_id
       WHERE t.serial_number = ?
       ORDER BY t.created_at DESC`,
      [serial]
    );

    // Org transfer history from audit_logs
    const orgTransfers = await query(
      `SELECT id, changes, performed_by, created_at
       FROM audit_logs
       WHERE entity_type = 'device' AND entity_id = ? AND changes LIKE '%organization_id%'
       ORDER BY created_at DESC`,
      [id]
    );

    // Org name map for transfers
    const allOrgs = await query<{ organization_id: number; organization_name: string }[]>(
      "SELECT organization_id, organization_name FROM organizations"
    );
    const orgNameMap: Record<number, string> = {};
    for (const o of allOrgs) orgNameMap[o.organization_id] = o.organization_name;

    // Manual sensor incidents
    const incidents = await query(
      `SELECT * FROM sensor_incidents WHERE serial_number = ? AND source = 'manual' ORDER BY created_at DESC`,
      [serial]
    );

    // Summary
    const totalTests = (tests as any[]).length;
    const failedTests = (tests as any[]).filter(
      (t: any) => t.status_analysis === "analyze_failed" || t.status_analysis === "report_failed"
    ).length;

    return NextResponse.json({
      serial,
      tests,
      orgTransfers,
      orgNameMap,
      incidents,
      summary: {
        totalTests,
        failedTests,
        failureRate: totalTests > 0 ? Math.round((failedTests / totalTests) * 100 * 10) / 10 : 0,
        incidentCount: (incidents as any[]).length,
      },
    });
  } catch (error) {
    console.error("GET /api/devices/[id]/history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
