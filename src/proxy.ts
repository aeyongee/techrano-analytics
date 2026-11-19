import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 1층(편의용): 세션 쿠키를 갱신하고, 로그인 안 한 요청을 보호 경로에서 /login으로 돌린다.
 * 보안 경계로 보지 않는다. 실데이터는 requireAdmin()(2층)과 RLS(3층)가 막는다.
 * 데모·로그인·크론은 Supabase에 전혀 닿지 않게 그대로 통과시킨다.
 */
const PUBLIC_PREFIXES = ["/login", "/demo", "/api/cron/", "/auth/", "/offline"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)))) {
    return NextResponse.next();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return NextResponse.redirect(new URL("/login?e=config", request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    const to = NextResponse.redirect(new URL("/login", request.url));
    for (const c of response.cookies.getAll()) to.cookies.set(c);
    return to;
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons/|manifest.webmanifest|sw.js|robots.txt).*)"],
};
