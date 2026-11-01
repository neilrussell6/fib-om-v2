import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isPublicPath } from "@/lib/auth/public-paths";

// Every route needs a session except the login page, Auth.js endpoints, static
// assets and the notcher feed. Signed-in requests also roll the JWT session forward.
export default auth((req) => {
  const { pathname, search } = req.nextUrl;
  if (isPublicPath(pathname) || req.auth) return;
  const login = new URL("/login", req.nextUrl.origin);
  login.searchParams.set("callbackUrl", `${pathname}${search}`);
  return NextResponse.redirect(login);
});

export const config = {
  matcher: [
    // Auth must never run on the notcher feed (spec 04) or Auth.js's own endpoints; isPublicPath covers the rest.
    "/((?!api/auth|vw-notcher-api$|_next/static|_next/image|favicon\\.ico$).*)",
  ],
};
