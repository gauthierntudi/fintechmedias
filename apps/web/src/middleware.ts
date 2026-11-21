import { NextResponse, type NextRequest } from "next/server";
import { parseEventsPath } from "@/app/(site)/evenements/events-path";
import { parseJobsPath } from "@/app/(site)/jobs/jobs-query";

const COOKIE = "fy_seed";

function sessionSeed() {
  return String(100000 + Math.floor(Math.random() * 899_999_999));
}

/**
 * URL de filtres sous forme de chemin → page liste, en interne :
 *   /jobs/cdi-cdd/teletravail        → /jobs?f=cdi-cdd/teletravail
 *   /evenements/ville-kinshasa/passes → /evenements?f=ville-kinshasa/passes
 * Un chemin qui n’est pas fait que de filtres reste une fiche ([slug]).
 */
function filterRewrite(request: NextRequest): URL | null {
  const { pathname } = request.nextUrl;
  const m = pathname.match(/^\/(jobs|evenements)\/(.+?)\/?$/);
  if (!m) return null;
  const segments = m[2].split("/");
  const ok =
    m[1] === "jobs" ? parseJobsPath(segments) : parseEventsPath(segments);
  if (!ok) return null;
  const url = request.nextUrl.clone();
  url.pathname = `/${m[1]}`;
  url.search = "";
  url.searchParams.set("f", m[2]);
  return url;
}

/** Graine « Juste pour vous », stable pour la session du navigateur. */
export function middleware(request: NextRequest) {
  const current = request.cookies.get(COOKIE)?.value;
  const seed = current && /^\d{5,12}$/.test(current) ? current : sessionSeed();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-fy-seed", seed);
  const rewrite = filterRewrite(request);
  const response = rewrite
    ? NextResponse.rewrite(rewrite, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
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
