export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { findDuplicateConflict } from "@/lib/device-validation";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const search = searchParams.get("search") || "";
    const organizationId = searchParams.get("organization_id") || "";
    const status = searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereClauses.push("(d.product_serial_number LIKE ? OR d.mac_address LIKE ? OR d.usb_serial_number LIKE ? OR d.memo LIKE ? OR o.organization_name LIKE ?)");
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (organizationId) {
      whereClauses.push("d.organization_id = ?");
      params.push(organizationId);
    }
    if (status) {
      whereClauses.push("d.status = ?");
      params.push(status);
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    const from = `FROM devices d LEFT JOIN organizations o ON d.organization_id = o.organization_id`;

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) as total ${from} ${where}`,
      params
    );
    const total = countResult[0].total;

    const data = await query<Record<string, unknown>[]>(
      `SELECT d.*, o.organization_name ${from} ${where} ORDER BY d.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    // Attach failure counts
    const serials = data.map((d) => d.product_serial_number).filter(Boolean);
    let failureMap: Record<string, number> = {};
    if (serials.length > 0) {
      const ph = serials.map(() => "?").join(",");
      const failures = await query<{ serial_number: string; cnt: number }[]>(
        `SELECT serial_number, COUNT(*) as cnt FROM tests WHERE serial_number IN (${ph}) AND status_analysis IN ('analyze_failed', 'report_failed') GROUP BY serial_number`,
        serials
      );
      for (const f of failures) failureMap[f.serial_number] = f.cnt;
    }
    const enriched = data.map((d) => ({
      ...d,
      failure_count: failureMap[d.product_serial_number as string] || 0,
    }));

    return NextResponse.json({ data: enriched, total, page, limit });
  } catch (error) {
    console.error("GET /api/devices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      organization_id, product_serial_number, mac_address,
      usb_serial_number, status, memo,
    } = body;

    if (!product_serial_number || !mac_address || !usb_serial_number) {
      return NextResponse.json(
        { error: "제품 시리얼, MAC 주소, USB 시리얼은 필수입니다." },
        { status: 400 }
      );
    }

    const conflict = await findDuplicateConflict({
      product_serial_number,
      mac_address,
      usb_serial_number,
    });
    if (conflict) {
      return NextResponse.json({ error: conflict }, { status: 409 });
    }

    const id = await insertAndGetId(
      `INSERT INTO devices (organization_id, product_serial_number, mac_address, usb_serial_number, status, memo)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        Number(organization_id) || 0, product_serial_number, mac_address,
        usb_serial_number, status || "available", memo || null,
      ]
    );

    await logAudit({
      entityType: "device",
      entityId: id,
      action: "create",
      changes: { product_serial_number: { old: null, new: product_serial_number } },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/devices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
