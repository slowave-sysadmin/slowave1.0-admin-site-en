export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    let whereClauses: string[] = [];
    let params: unknown[] = [];

    if (search) {
      whereClauses.push("(organization_name LIKE ? OR organization_phone LIKE ? OR organization_address LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    const status = searchParams.get("status") || "";
    if (status) {
      whereClauses.push("status = ?");
      params.push(status);
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total FROM organizations ${where}`,
      params
    );
    const total = countResult[0].total;

    const data = await query<Record<string, unknown>[]>(
      `SELECT * FROM organizations ${where} ORDER BY created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    const orgIds = data.map((o) => o.organization_id);
    let featureMap: Record<number, string[]> = {};
    if (orgIds.length > 0) {
      const ph = orgIds.map(() => "?").join(",");
      const features = await query<{ organization_id: number; name: string }[]>(
        `SELECT oft.organization_id, f.name FROM organization_features oft JOIN features f ON f.id = oft.feature_id WHERE oft.enabled = 1 AND oft.organization_id IN (${ph})`,
        orgIds
      );
      for (const f of features) {
        if (!featureMap[f.organization_id]) featureMap[f.organization_id] = [];
        featureMap[f.organization_id].push(f.name);
      }
    }

    const enriched = data.map((o) => ({
      ...o,
      enabled_features: featureMap[o.organization_id as number] || [],
    }));

    return NextResponse.json({ data: enriched, total, page, limit });
  } catch (error) {
    console.error("GET /api/organizations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organization_name, organization_phone, organization_address, status } = body;

    const id = await insertAndGetId(
      `INSERT INTO organizations (organization_name, organization_phone, organization_address, status) VALUES (?, ?, ?, ?)`,
      [organization_name, organization_phone || null, organization_address || null, status || "active"]
    );

    await logAudit({
      entityType: "organization",
      entityId: id,
      action: "create",
      changes: { organization_name: { old: null, new: organization_name } },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/organizations error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
