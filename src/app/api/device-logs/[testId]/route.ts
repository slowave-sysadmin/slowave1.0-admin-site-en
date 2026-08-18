export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

const PRESIGN_URL =
  "https://eku2fbvobb.execute-api.ap-northeast-2.amazonaws.com/prod/files/presign-get";

type RouteContext = { params: Promise<{ testId: string }> };

export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const { testId } = await ctx.params;

    const presignRes = await fetch(PRESIGN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId,
        fileName: `${testId}_device_log.json`,
      }),
    });

    if (!presignRes.ok) {
      return NextResponse.json({ error: "로그 파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const { url } = await presignRes.json();

    const logRes = await fetch(url);
    if (!logRes.ok) {
      return NextResponse.json({ error: "로그 파일을 다운로드할 수 없습니다." }, { status: 404 });
    }

    const data = await logRes.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/device-logs/[testId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
