import { z } from "zod";

/**
 * 환경 변수는 쓰는 순간에 검증한다. 그래서 비밀값이 없는 CI·Preview에서도 빌드와 데모는 동작한다.
 * 오류 메시지에는 빠진 이름만 담고 값은 담지 않는다.
 */
export class EnvError extends Error {
  constructor(readonly missing: string[]) {
    super(`환경 변수가 없거나 형식이 맞지 않습니다: ${missing.join(", ")}`);
    this.name = "EnvError";
  }
}

const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const required = z.preprocess(blankToUndefined, z.string().trim().min(1));

function parse<S extends z.ZodType>(schema: S, source: Record<string, unknown>): z.infer<S> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError([...new Set(result.error.issues.map((i) => String(i.path[0] ?? "?")))]);
  }
  return result.data;
}

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankToUndefined, z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: required,
});

// NEXT_PUBLIC_ 값은 정적으로 참조해야 번들에 들어간다.
export function publicEnv() {
  return parse(publicSchema, {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function hasLiveConfig(): boolean {
  try {
    publicEnv();
    adminEnv();
    return true;
  } catch {
    return false;
  }
}

export function adminEnv() {
  return parse(z.object({ ADMIN_EMAIL: z.preprocess(blankToUndefined, z.email()) }), {
    ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  });
}

export function cronEnv() {
  return parse(z.object({ CRON_SECRET: z.preprocess(blankToUndefined, z.string().min(32)) }), {
    CRON_SECRET: process.env.CRON_SECRET,
  });
}

/** 수집기·시드·검증 스크립트 전용. 화면 조회에는 쓰지 않는다. */
export function supabaseSecretEnv() {
  return parse(
    z.object({ NEXT_PUBLIC_SUPABASE_URL: z.preprocess(blankToUndefined, z.url()), SUPABASE_SECRET_KEY: required }),
    {
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    },
  );
}
