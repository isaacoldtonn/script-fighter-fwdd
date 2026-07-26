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

  // sf_token is the real session cookie, but it's set by the Railway backend
  // (a different origin) via a cross-site Set-Cookie header — middleware runs
  // on this app's own origin and can never see it. sf_authed is a same-origin
  // marker the client sets right after a successful login purely so this
  // middleware has something to check; actual auth is still enforced by the
  // server's verifyToken on every API call.
  const authedMarker = request.cookies.get("sf_authed");

  if (!authedMarker) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
