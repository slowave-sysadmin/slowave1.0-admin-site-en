export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  try {
    const [features, organizations, assignments] = await Promise.all([
      query("SELECT id, code, name FROM features WHERE is_enabled = 1 ORDER BY id ASC"),
      query(
        "SELECT organization_id, organization_name, status FROM organizations WHERE status != 'deleted' AND organization_id != 0 ORDER BY organization_name ASC"
      ),
      query(
        `SELECT oft.organization_id, oft.feature_id
         FROM organization_features oft
         JOIN features f ON f.id = oft.feature_id AND f.is_enabled = 1
         WHERE oft.enabled = 1`
      ),
    ]);

    return NextResponse.json({ features, organizations, assignments });
  } catch (error) {
    console.error("GET /api/features/status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
