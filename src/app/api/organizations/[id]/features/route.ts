export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { logAudit } from "@/lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const data = await query(
      `SELECT f.id as feature_id, f.code, f.name, f.description,
              COALESCE(oft.enabled, 0) as enabled
       FROM features f
       LEFT JOIN organization_features oft ON oft.feature_id = f.id AND oft.organization_id = ?
       WHERE f.is_enabled = 1
       ORDER BY f.id ASC`,
      [id]
    );
    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/organizations/[id]/features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const session = await getSession();
    if (!session || !["system_admin", "admin"].includes(session.role)) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id } = await ctx.params;
    const { features } = await req.json() as { features: { feature_id: number; enabled: boolean }[] };

    // Get current state and feature names
    const currentState = await query<{ feature_id: number; enabled: number; name: string }[]>(
      `SELECT oft.feature_id, oft.enabled, f.name
       FROM organization_features oft
       JOIN features f ON f.id = oft.feature_id
       WHERE oft.organization_id = ?`,
      [id]
    );
    const currentMap = new Map(currentState.map((c) => [c.feature_id, c]));

    // Get all feature names for new entries
    const allFeatures = await query<{ id: number; name: string }[]>("SELECT id, name FROM features");
    const nameMap = new Map(allFeatures.map((f) => [f.id, f.name]));

    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const f of features) {
      const current = currentMap.get(f.feature_id);
      const oldEnabled = current ? !!current.enabled : false;
      const newEnabled = f.enabled;

      if (oldEnabled !== newEnabled) {
        const featureName = nameMap.get(f.feature_id) || `feature_${f.feature_id}`;
        changes[featureName] = { old: oldEnabled ? "ON" : "OFF", new: newEnabled ? "ON" : "OFF" };
      }

      if (current) {
        await query(
          "UPDATE organization_features SET enabled = ?, updated_at = NOW() WHERE organization_id = ? AND feature_id = ?",
          [f.enabled ? 1 : 0, id, f.feature_id]
        );
      } else {
        await query(
          "INSERT INTO organization_features (organization_id, feature_id, enabled, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())",
          [id, f.feature_id, f.enabled ? 1 : 0]
        );
      }
    }

    if (Object.keys(changes).length > 0) {
      await logAudit({
        entityType: "organization",
        entityId: Number(id),
        action: "update",
        changes,
      });
    }

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/organizations/[id]/features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
