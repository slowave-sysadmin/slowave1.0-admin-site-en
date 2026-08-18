export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import crypto from "crypto";

// POST: create invitation link
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organization_id, expires_hours = 72 } = body;

    if (!organization_id && organization_id !== 0) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 });
    }

    // Verify org exists
    const orgs = await query<{ organization_id: number }[]>(
      "SELECT organization_id FROM organizations WHERE organization_id = ?",
      [organization_id]
    );
    if (!orgs.length) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000);

    await insertAndGetId(
      "INSERT INTO invitation_tokens (token, organization_id, expires_at) VALUES (?, ?, ?)",
      [token, organization_id, expiresAt.toISOString().slice(0, 19).replace("T", " ")]
    );

    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invitations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: list invitations
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(searchParams.get("limit")) || 20);
    const offset = (page - 1) * limit;

    const countResult = await query<{ total: number }[]>(
      "SELECT COUNT(*) as total FROM invitation_tokens"
    );
    const total = countResult[0].total;

    const data = await query(
      `SELECT i.*, o.organization_name
       FROM invitation_tokens i
       LEFT JOIN organizations o ON i.organization_id = o.organization_id
       ORDER BY i.created_at DESC
       LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
    );

    return NextResponse.json({ data, total, page, limit });
  } catch (error) {
    console.error("GET /api/invitations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
