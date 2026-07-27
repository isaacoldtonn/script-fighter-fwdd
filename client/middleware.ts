import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// /join is always public. /login and /register are "auth only" — an already
// authenticated browser gets bounced to /home instead of seeing the form
// again. Everything else (including /home) requires the sf_authed marker.
const AUTH_ONLY_PATHS = ["/login", "/register"];
const PUBLIC_PATHS = ["/join"];

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
  const isAuthed = !!request.cookies.get("sf_authed");

  const isAuthOnly = AUTH_ONLY_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  );

  if (isAuthOnly) {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/home", request.url));
    }
    return NextResponse.next();
  }

  // Everything else is protected.
  if (!isAuthed) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Excludes Next.js internals AND any request for a static file (by
  // extension) — e.g. /scriptfighter-logo.png, /sprites/ryu-idle.png.
  // Without the extension exclusion, public assets referenced from
  // pre-auth pages (/login, /register) were being 307-redirected to
  // /login by this same middleware, rendering as broken images.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|map)$).*)"],
};
