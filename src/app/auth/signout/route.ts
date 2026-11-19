import { hasLiveConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (hasLiveConfig()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }
  return Response.redirect(new URL("/login", request.url), 303);
}

export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
