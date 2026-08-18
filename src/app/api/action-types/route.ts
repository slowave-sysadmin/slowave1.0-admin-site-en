export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const data = await query("SELECT * FROM action_types ORDER BY sort_order ASC, id ASC");
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/action-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자만 추가할 수 있습니다." }, { status: 403 });
    }
    const { code, name, sort_order } = await req.json();
    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "코드와 이름은 필수입니다." }, { status: 400 });
    }
    const id = await insertAndGetId(
      "INSERT INTO action_types (code, name, sort_order) VALUES (?, ?, ?)",
      [code, name, sort_order ?? 0]
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/action-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자만 수정할 수 있습니다." }, { status: 403 });
    }
    const { id, name, is_enabled, sort_order } = await req.json();
    if (!id) return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    await query(
      "UPDATE action_types SET name = ?, is_enabled = ?, sort_order = ? WHERE id = ?",
      [name, is_enabled ?? 1, sort_order ?? 0, id]
    );
    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/action-types error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
