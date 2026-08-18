export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const data = await query(
      "SELECT * FROM support_requests ORDER BY created_at DESC"
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/support-requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { category, title, description } = await req.json();
    if (!title?.trim()) {
      return NextResponse.json({ error: "제목을 입력해주세요." }, { status: 400 });
    }

    const id = await insertAndGetId(
      "INSERT INTO support_requests (admin_user_id, admin_username, category, title, description) VALUES (?, ?, ?, ?, ?)",
      [session.adminId, session.username, category || "bug", title, description || null]
    );

    return NextResponse.json({ id, message: "Created" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/support-requests error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
