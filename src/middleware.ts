import { NextResponse, type NextRequest } from "next/server";

// Route protection is a lightweight cookie-presence check here (fast, runs
// on the Edge). The actual role check (which module a role may open) runs
// in lib/auth/rbac.ts on the server component itself, since that needs a DB
// round trip that doesn't belong in middleware.
const PUBLIC_PATHS = ["/login", "/unauthorized", "/clock", "/reserve"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has("alimah_session");
  if (!hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
