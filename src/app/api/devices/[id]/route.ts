export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findDuplicateConflict } from "@/lib/device-validation";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const rows = await query<Record<string, unknown>[]>(
      "SELECT * FROM devices WHERE device_id = ?",
      [id]
    );
    if (!rows.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("GET /api/devices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM devices WHERE device_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const old = existing[0];

    const required = ["product_serial_number", "mac_address", "usb_serial_number"];
    for (const f of required) {
      if (body[f] !== undefined && !body[f]) {
        return NextResponse.json(
          { error: "제품 시리얼, MAC 주소, USB 시리얼은 비울 수 없습니다." },
          { status: 400 }
        );
      }
    }

    const toCheck: Parameters<typeof findDuplicateConflict>[0] = {};
    for (const f of ["product_serial_number", "mac_address", "usb_serial_number"] as const) {
      if (body[f] !== undefined && body[f] !== old[f]) toCheck[f] = body[f];
    }
    const conflict = await findDuplicateConflict(toCheck, Number(id));
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const fields = [
      "organization_id", "product_serial_number", "mac_address",
      "usb_serial_number", "status", "memo",
    ];
    const updates: string[] = [];
    const params: unknown[] = [];
    const changes: Record<string, { old: unknown; new: unknown }> = {};

    for (const field of fields) {
      if (body[field] !== undefined && body[field] !== old[field]) {
        updates.push(`${field} = ?`);
        params.push(body[field]);
        changes[field] = { old: old[field], new: body[field] };
      }
    }

    if (updates.length === 0) {
      return NextResponse.json({ message: "No changes" });
    }

    updates.push("updated_at = NOW()");
    params.push(id);

    await query(
      `UPDATE devices SET ${updates.join(", ")} WHERE device_id = ?`,
      params
    );

    await logAudit({
      entityType: "device",
      entityId: Number(id),
      action: "update",
      changes,
    });

    return NextResponse.json({ message: "Updated" });
  } catch (error) {
    console.error("PUT /api/devices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const { id } = await ctx.params;

    const existing = await query<Record<string, unknown>[]>(
      "SELECT * FROM devices WHERE device_id = ?",
      [id]
    );
    if (!existing.length) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const oldStatus = existing[0].status;
    await query(
      "UPDATE devices SET status = 'retired', updated_at = NOW() WHERE device_id = ?",
      [id]
    );

    await logAudit({
      entityType: "device",
      entityId: Number(id),
      action: "delete",
      changes: { status: { old: oldStatus, new: "retired" } },
    });

    return NextResponse.json({ message: "Deleted (soft)" });
  } catch (error) {
    console.error("DELETE /api/devices/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
