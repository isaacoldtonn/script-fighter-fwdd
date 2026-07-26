import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /join and /login (and /register) are intentionally public — a player may
// scan the QR code or land on auth pages before ever having a session cookie.
const PUBLIC_PATHS = ["/login", "/register", "/join"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isPublic) {
    return NextResponse.next();
  }

  const token = request.cookies.get("sf_token");

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
