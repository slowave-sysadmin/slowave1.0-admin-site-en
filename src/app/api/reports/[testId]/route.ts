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
        fileName: `${testId}_result.pdf`,
      }),
    });

    if (!presignRes.ok) {
      const text = await presignRes.text();
      return NextResponse.json(
        { error: "Presign failed", detail: text },
        { status: presignRes.status }
      );
    }

    const { url } = await presignRes.json();

    const pdfRes = await fetch(url);
    if (!pdfRes.ok) {
      return NextResponse.json(
        { error: "PDF download failed" },
        { status: pdfRes.status }
      );
    }

    const pdfBuffer = await pdfRes.arrayBuffer();

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${testId}_result.pdf"`,
      },
    });
  } catch (error) {
    console.error("GET /api/reports/[testId] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
