export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import { getSession } from "@/lib/session";

interface IssueRow {
  issue_id: number;
  issue_no: number;
  reporter: string | null;
  received_at: string | null;
  problem_type: string | null;
  voc: string | null;
  response_stage: string | null;
  assignee: string | null;
  customer_org: string | null;
  product_type: string | null;
  product_used: string | null;
  firmware_ver: string | null;
  occurred_at: string | null;
  end_user: string | null;
  test_id: string | null;
  recovered_at: string | null;
  problem_check: string | null;
  root_cause: string | null;
  action_date: string | null;
  customer_response: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  attachment_count?: number;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 30));
    const offset = (page - 1) * limit;

    const problemType = searchParams.get("problem_type") || "";
    const stage = searchParams.get("response_stage") || "";
    const assignee = searchParams.get("assignee") || "";
    const customerOrg = searchParams.get("customer_org") || "";
    const search = searchParams.get("q") || "";
    const dateFrom = searchParams.get("date_from") || "";
    const dateTo = searchParams.get("date_to") || "";
    const includeDeleted = searchParams.get("include_deleted") === "1";

    const whereClauses: string[] = [];
    const params: unknown[] = [];

    if (!includeDeleted) whereClauses.push("i.status = 'active'");

    if (problemType) { whereClauses.push("i.problem_type = ?"); params.push(problemType); }
    if (stage) { whereClauses.push("i.response_stage = ?"); params.push(stage); }
    if (assignee) { whereClauses.push("i.assignee LIKE ?"); params.push(`%${assignee}%`); }
    if (customerOrg) { whereClauses.push("i.customer_org LIKE ?"); params.push(`%${customerOrg}%`); }
    if (dateFrom) { whereClauses.push("i.received_at >= ?"); params.push(dateFrom); }
    if (dateTo) { whereClauses.push("i.received_at <= ?"); params.push(dateTo); }
    if (search) {
      whereClauses.push("(i.voc LIKE ? OR i.root_cause LIKE ? OR i.problem_check LIKE ? OR i.end_user LIKE ? OR i.test_id LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s, s);
    }

    const where = whereClauses.length ? `WHERE ${whereClauses.join(" AND ")}` : "";

    const countResult = await query<{ total: number }[]>(
      `SELECT COUNT(*) AS total FROM issues i ${where}`,
      params
    );

    const data = await query<IssueRow[]>(
      `SELECT i.*,
              (SELECT COUNT(*) FROM issue_attachments a WHERE a.issue_id = i.issue_id AND a.status = 'active') AS attachment_count
       FROM issues i
       ${where}
       ORDER BY i.received_at IS NULL, i.received_at DESC, i.issue_no DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`,
      params
    );

    return NextResponse.json({ data, total: countResult[0].total, page, limit });
  } catch (error) {
    console.error("GET /api/issues error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "권한이 없습니다." }, { status: 401 });
    if (session.role !== "system_admin") {
      const perm = session.pagePermissions?.["/issues"];
      if (perm && perm !== "edit") return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await req.json();

    if (body.test_id) {
      const exists = await query<{ test_id: string }[]>(
        `SELECT test_id FROM tests WHERE test_id = ? LIMIT 1`,
        [body.test_id]
      );
      if (exists.length === 0) {
        return NextResponse.json({ error: `검사 ID '${body.test_id}'를 찾을 수 없습니다.` }, { status: 409 });
      }
    }

    const maxResult = await query<{ next_no: number }[]>(
      `SELECT COALESCE(MAX(issue_no), 0) + 1 AS next_no FROM issues`,
      []
    );
    const issueNo = body.issue_no || maxResult[0].next_no;

    const id = await insertAndGetId(
      `INSERT INTO issues (
        issue_no, reporter, received_at, problem_type, voc, response_stage,
        assignee, customer_org, product_type, product_used, firmware_ver,
        occurred_at, end_user, test_id, recovered_at,
        problem_check, root_cause, action_date, customer_response
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        issueNo,
        body.reporter || session.name || session.username,
        body.received_at || null,
        body.problem_type || null,
        body.voc || null,
        body.response_stage || null,
        body.assignee || null,
        body.customer_org || null,
        body.product_type || null,
        body.product_used || null,
        body.firmware_ver || null,
        body.occurred_at || null,
        body.end_user || null,
        body.test_id || null,
        body.recovered_at || null,
        body.problem_check || null,
        body.root_cause || null,
        body.action_date || null,
        body.customer_response || null,
      ]
    );

    return NextResponse.json({ issue_id: id, issue_no: issueNo });
  } catch (error) {
    console.error("POST /api/issues error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
