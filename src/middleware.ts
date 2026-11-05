import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canUpload } from "@/app/lib/roles";

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  if (!path.startsWith("/dashboard")) {
    return NextResponse.next();
  }

  // Not authenticated → send to the login page (which redirects to Keycloak).
  if (!req.auth) {
    const loginUrl = new URL("/login", nextUrl);
    loginUrl.searchParams.set("callbackUrl", path + nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Cargar Datos is restricted to editors/database editors/admins (see canUpload).
  if (path.startsWith("/dashboard/upload") && !canUpload(req.auth.roles)) {
    return NextResponse.redirect(new URL("/dashboard?denied=cargar", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
