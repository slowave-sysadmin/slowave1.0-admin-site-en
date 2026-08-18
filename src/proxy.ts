import { NextRequest, NextResponse } from "next/server";
import { decrypt } from "@/lib/session";
import { cookies } from "next/headers";

const publicPaths = ["/login", "/register", "/reset-password"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Skip public paths
  if (publicPaths.some((p) => path.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip API auth routes
  if (path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Skip invitation APIs (token lookup + register)
  if (path.startsWith("/api/invitations/")) {
    return NextResponse.next();
  }

  // Skip password reset API
  if (path.startsWith("/api/password-reset")) {
    return NextResponse.next();
  }

  const cookie = (await cookies()).get("session")?.value;
  const session = await decrypt(cookie);

  if (!session?.adminId) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Check page permissions for admin role
  if (session.role === "admin" && session.pagePermissions && !path.startsWith("/api/")) {
    const page = "/" + (path.split("/")[1] || "");
    if (page !== "/") {
      const perm = (session.pagePermissions as Record<string, string>)[page];
      if (perm === "none") {
        return NextResponse.redirect(new URL("/", req.nextUrl));
      }
    }
  }

  // If logged in and visiting /login, redirect to home
  if (path === "/login") {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
