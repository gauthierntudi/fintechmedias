import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "fy_seed";

function sessionSeed() {
  return String(100000 + Math.floor(Math.random() * 899_999_999));
}

/** Graine « Juste pour vous », stable pour la session du navigateur. */
export function middleware(request: NextRequest) {
  const current = request.cookies.get(COOKIE)?.value;
  const seed = current && /^\d{5,12}$/.test(current) ? current : sessionSeed();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-fy-seed", seed);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  if (seed !== current) {
    response.cookies.set(COOKIE, seed, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
