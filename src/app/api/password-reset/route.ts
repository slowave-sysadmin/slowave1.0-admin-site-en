export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { query, insertAndGetId } from "@/lib/db";
import crypto from "crypto";

// POST: create password reset link for a user
export async function POST(req: NextRequest) {
  try {
    const { user_id, expires_hours = 24 } = await req.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const users = await query<Record<string, unknown>[]>(
      "SELECT user_id, username FROM users WHERE user_id = ?",
      [user_id]
    );
    if (!users.length) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + expires_hours * 60 * 60 * 1000);

    await insertAndGetId(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
      [token, user_id, expiresAt.toISOString().slice(0, 19).replace("T", " ")]
    );

    return NextResponse.json({ token }, { status: 201 });
  } catch (error) {
    console.error("POST /api/password-reset error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
