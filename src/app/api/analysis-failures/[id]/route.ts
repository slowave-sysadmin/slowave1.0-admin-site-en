export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

// id here is test_id (string)
export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id: testId } = await ctx.params;
    const {
      failure_reason_id, note, action_taken, action_comment,
      serial_number, organization_id, status_analysis,
      new_status_analysis,
    } = await req.json();

    // If changing status to report_generated, require failure_reason and action_taken
    if (new_status_analysis === "report_generated") {
      if (!failure_reason_id) {
        return NextResponse.json({ error: "실패 원인을 선택해주세요." }, { status: 400 });
      }
      if (!action_taken) {
        return NextResponse.json({ error: "조치를 선택해주세요." }, { status: 400 });
      }
    }

    // Check existing note
    const existing = await query<{ id: number }[]>(
      "SELECT id FROM analysis_failure_notes WHERE test_id = ?",
      [testId]
    );

    if (existing.length > 0) {
      await query(
        "UPDATE analysis_failure_notes SET failure_reason_id = ?, note = ?, action_taken = ?, action_comment = ?, noted_by = ? WHERE test_id = ?",
        [failure_reason_id || null, note || null, action_taken || null, action_comment || null, session.username, testId]
      );
    } else {
      await insertAndGetId(
        "INSERT INTO analysis_failure_notes (test_id, serial_number, organization_id, status_analysis, failure_reason_id, note, action_taken, action_comment, noted_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [testId, serial_number || null, organization_id || null, status_analysis || null, failure_reason_id || null, note || null, action_taken || null, action_comment || null, session.username]
      );

    }

    // Update tests.status_analysis if requested
    if (new_status_analysis && new_status_analysis !== status_analysis) {
      // Get test internal id for audit
      const testRows = await query<{ id: number; organization_id: number }[]>(
        "SELECT id, organization_id FROM tests WHERE test_id = ?",
        [testId]
      );

      await query(
        "UPDATE tests SET status_analysis = ? WHERE test_id = ?",
        [new_status_analysis, testId]
      );

      // Update the note's status_analysis too
      await query(
        "UPDATE analysis_failure_notes SET status_analysis = ? WHERE test_id = ?",
        [new_status_analysis, testId]
      );

      // Audit log
      if (testRows.length > 0) {
        await logAudit({
          entityType: "device",
          entityId: testRows[0].id,
          action: "update",
          changes: {
            test_id: { old: testId, new: testId },
            status_analysis: { old: status_analysis, new: new_status_analysis },
          },
        });
      }
    }

    return NextResponse.json({ message: "Saved" });
  } catch (error) {
    console.error("PUT /api/analysis-failures/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
