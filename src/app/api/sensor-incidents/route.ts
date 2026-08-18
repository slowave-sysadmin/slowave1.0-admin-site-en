export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const serial = req.nextUrl.searchParams.get("serial_number") || "";
    if (!serial) {
      return NextResponse.json({ error: "serial_number is required" }, { status: 400 });
    }
    const data = await query(
      "SELECT * FROM sensor_incidents WHERE serial_number = ? ORDER BY created_at DESC",
      [serial]
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/sensor-incidents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { serial_number, test_id, incident_type, description } = await req.json();
    if (!serial_number || !incident_type) {
      return NextResponse.json({ error: "센서 시리얼과 이슈 유형은 필수입니다." }, { status: 400 });
    }

    const id = await insertAndGetId(
      "INSERT INTO sensor_incidents (serial_number, test_id, incident_type, description, source, noted_by) VALUES (?, ?, ?, ?, 'manual', ?)",
      [serial_number, test_id || null, incident_type, description || null, session.username]
    );

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sensor-incidents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
