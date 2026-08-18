export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type") || "app";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 100));
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const entityType = searchParams.get("entity_type") || "";
    const offset = (page - 1) * limit;

    let table: string;
    switch (type) {
      case "app":
        table = "app_logs";
        break;
      case "system":
        table = "system_logs";
        break;
      case "session":
        table = "user_session_logs";
        break;
      case "audit":
        table = "audit_logs";
        break;
      default:
        return NextResponse.json({ error: "Invalid log type. Use: app, system, session, audit" }, { status: 400 });
    }

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    const colPrefix = type === "session" ? "s." : type === "audit" ? "a." : "";
    if (dateFrom) {
      whereClauses.push(`${colPrefix}created_at >= ?`);
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClauses.push(`${colPrefix}created_at < ?`);
      params.push(dateTo + " 23:59:59");
    }
    if (type === "audit" && entityType) {
      whereClauses.push("a.entity_type = ?");
      params.push(entityType);
    }
    const testId = searchParams.get("test_id") || "";
    if (type === "system" && testId) {
      whereClauses.push("test_id LIKE ?");
      params.push(`%${testId}%`);
    }
    const search = searchParams.get("search") || "";
    if (type === "session" && search) {
      whereClauses.push("(u.username LIKE ? OR s.reason LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (type === "audit" && search) {
      const conditions = [
        "CAST(a.entity_id AS CHAR) LIKE ?",
        "JSON_UNQUOTE(a.changes) LIKE ?",
        `(CASE a.entity_type
          WHEN 'device' THEN (SELECT product_serial_number FROM devices WHERE device_id = a.entity_id)
          WHEN 'user' THEN (SELECT username FROM users WHERE user_id = a.entity_id)
          WHEN 'organization' THEN (SELECT organization_name FROM organizations WHERE organization_id = a.entity_id)
        END) LIKE ?`,
      ];
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);

      const matchingOrgs = await query<{ organization_id: number }[]>(
        "SELECT organization_id FROM organizations WHERE organization_name LIKE ?",
        [`%${search}%`]
      );
      if (matchingOrgs.length > 0) {
        const ids = matchingOrgs.map((o) => o.organization_id);
        const ph = ids.map(() => "?").join(",");
        conditions.push(
          `(JSON_EXTRACT(a.changes, '$.organization_id.old') IN (${ph}) OR JSON_EXTRACT(a.changes, '$.organization_id.new') IN (${ph}))`
        );
        params.push(...ids, ...ids);
      }

      whereClauses.push(`(${conditions.join(" OR ")})`);
    }

    const where = whereClauses.length
      ? `WHERE ${whereClauses.join(" AND ")}`
      : "";

    let selectFrom: string;
    let countFrom: string;

    if (type === "session") {
      selectFrom = `SELECT s.*, u.username FROM ${table} s LEFT JOIN users u ON s.user_id = u.user_id`;
      countFrom = `SELECT COUNT(*) as total FROM ${table} s LEFT JOIN users u ON s.user_id = u.user_id`;
    } else if (type === "audit") {
      selectFrom = `SELECT a.*, CASE a.entity_type WHEN 'device' THEN (SELECT product_serial_number FROM devices WHERE device_id = a.entity_id) WHEN 'user' THEN (SELECT username FROM users WHERE user_id = a.entity_id) WHEN 'organization' THEN (SELECT organization_name FROM organizations WHERE organization_id = a.entity_id) END as entity_name FROM ${table} a`;
      countFrom = `SELECT COUNT(*) as total FROM ${table} a`;
    } else {
      selectFrom = `SELECT * FROM ${table}`;
      countFrom = `SELECT COUNT(*) as total FROM ${table}`;
    }

    const countResult = await query<{ total: number }[]>(
      `${countFrom} ${where}`,
      params
    );
    const total = countResult[0].total;

    const data = await query(
      `${selectFrom} ${where} ORDER BY ${colPrefix}created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    if (type === "audit") {
      const orgs = await query<{ organization_id: number; organization_name: string }[]>(
        "SELECT organization_id, organization_name FROM organizations"
      );
      const orgMap: Record<number, string> = {};
      for (const o of orgs) orgMap[o.organization_id] = o.organization_name;
      return NextResponse.json({ data, total, page, limit, orgMap });
    }

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
