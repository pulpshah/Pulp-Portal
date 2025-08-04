import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = !!token;
  const isAuthPage = request.nextUrl.pathname.startsWith("/auth");
  const isProtectedPage =
    request.nextUrl.pathname === "/" || // Protect the homepage
    request.nextUrl.pathname.startsWith("/home") ||
    request.nextUrl.pathname.startsWith("/profile");

  // Redirect unauthenticated users from protected pages to sign-in
  if (!isAuthenticated && isProtectedPage) {
    const redirectUrl = new URL("/auth/signin", request.url);
    redirectUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect authenticated users from auth pages to home
  if (isAuthenticated && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Specify which routes this middleware should run on
export const config = {
  matcher: [
    // Protected routes that require authentication
    "/", // Protect the homepage
    "/home/:path*",
    "/profile/:path*",
    // Auth routes (to redirect authenticated users away from)
    "/auth/:path*",
  ],
};
