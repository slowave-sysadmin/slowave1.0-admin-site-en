export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { organization_id, category, description } = await req.json();
    if (!organization_id || !category) {
      return NextResponse.json({ error: "기관과 카테고리는 필수입니다." }, { status: 400 });
    }

    const existing = await query<{ id: number }[]>(
      "SELECT id FROM organization_categories WHERE organization_id = ?",
      [organization_id]
    );

    if (existing.length > 0) {
      await query(
        "UPDATE organization_categories SET category = ?, description = ? WHERE organization_id = ?",
        [category, description || null, organization_id]
      );
    } else {
      await query(
        "INSERT INTO organization_categories (organization_id, category, description) VALUES (?, ?, ?)",
        [organization_id, category, description || null]
      );
    }

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/organization-categories error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
