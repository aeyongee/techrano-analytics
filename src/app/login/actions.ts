"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isAdminClaims } from "@/lib/auth/claims";
import { adminEnv, hasLiveConfig } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SignInState {
  error: string | null;
}

const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
const GENERIC = "로그인할 수 없습니다. 이메일과 비밀번호를 확인해 주세요.";

export async function signIn(_: SignInState, formData: FormData): Promise<SignInState> {
  if (!hasLiveConfig()) return { error: "이 배포에는 실데이터 연결이 없습니다. 데모를 둘러봐 주세요." };
  const parsed = schema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return { error: GENERIC };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  // 관리자 claim과 이메일이 둘 다 맞아야 한다. 아니면 세션을 바로 지우고 같은 문구를 보여 준다(계정 존재 여부를 흘리지 않는다).
  if (error || !isAdminClaims({ ...data.user, is_anonymous: data.user?.is_anonymous }, adminEnv().ADMIN_EMAIL)) {
    if (!error) await supabase.auth.signOut();
    return { error: GENERIC };
  }
  redirect("/");
}
