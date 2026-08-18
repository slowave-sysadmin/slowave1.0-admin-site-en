export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const data = await query("SELECT * FROM features ORDER BY id ASC");
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자만 기능을 추가할 수 있습니다." }, { status: 403 });
    }

    const { code, name, description, is_enabled } = await req.json();
    if (!code?.trim() || !name?.trim()) {
      return NextResponse.json({ error: "코드와 이름은 필수입니다." }, { status: 400 });
    }

    const id = await insertAndGetId(
      "INSERT INTO features (code, name, description, is_enabled) VALUES (?, ?, ?, ?)",
      [code, name, description || null, is_enabled ?? 1]
    );

    return NextResponse.json({ id, message: "Created" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "system_admin") {
      return NextResponse.json({ error: "시스템관리자만 기능을 수정할 수 있습니다." }, { status: 403 });
    }

    const { id, code, name, description, is_enabled } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    await query(
      "UPDATE features SET code = ?, name = ?, description = ?, is_enabled = ? WHERE id = ?",
      [code, name, description || null, is_enabled ?? 1, id]
    );

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
