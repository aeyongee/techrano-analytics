import { ArrowRight, LockKeyhole, ShieldCheck, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/shell/Logo";
import { getAdminSession } from "@/lib/auth/guard";
import { GATES } from "@/lib/domain/constants";
import { hasLiveConfig } from "@/lib/env";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "로그인" };

const NOTICE: Record<string, string> = {
  config: "이 배포에는 실데이터 연결이 없습니다. 데모를 둘러봐 주세요.",
};

const STACK = ["Next.js 16", "TypeScript", "Supabase RLS", "Recharts", "GitHub Actions", "Vercel"];

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const configured = hasLiveConfig();
  if (configured && (await getAdminSession())) redirect("/");
  const { e } = await searchParams;

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[1120px] items-center gap-10 py-10 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] xl:grid-cols-[1.15fr_1fr] xl:gap-16">
      <section className="flex flex-col gap-6">
        <Wordmark />
        <div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight xl:text-[40px]">
            릴스·쇼츠가 왜 퍼졌는지
            <br />
            <span className="text-rano">15분마다</span> 기록하는 대시보드
          </h1>
          <p className="mt-3 max-w-[34rem] text-sm leading-relaxed text-muted-foreground">
            1인 IT·보안 숏폼 채널 @tech.rano의 인스타 릴스와 유튜브 쇼츠 성과를 게시 직후부터 쌓아, 실제 운영 기록에서 찾은 두 관문으로 읽습니다.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li className="rounded-xl border border-border bg-card p-4 shadow-block">
            <p className="text-xs font-semibold text-muted-foreground">1차 관문 · 3초 훅</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              건너뛰기 <span className="text-rano">≤ {GATES.hook.maxSkipRate}%</span>
            </p>
          </li>
          <li className="rounded-xl border border-border bg-card p-4 shadow-block">
            <p className="text-xs font-semibold text-muted-foreground">2차 관문 · 확산</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              저장 <span className="text-rano">≥ {GATES.spread.minSaveRate}%</span> · 공유 <span className="text-rano">≥ {GATES.spread.minShareRate}%</span>
            </p>
          </li>
        </ul>
        <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex gap-2">
            <Timer className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden />
            맥북이 꺼져 있어도 GitHub Actions가 15분마다 수집하고, 게시 후 경과 시간에 맞춰 간격을 늘립니다.
          </li>
          <li className="flex gap-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-sky" aria-hidden />
            실데이터는 관리자만 봅니다. 데모는 코드 안에서 만든 가상 데이터만 쓰고 DB에 한 번도 닿지 않습니다.
          </li>
        </ul>
        <ul className="flex flex-wrap gap-1.5" aria-label="기술 스택">
          {STACK.map((s) => (
            <li key={s} className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {s}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-block xl:p-7" aria-labelledby="enter-title">
        <h2 id="enter-title" className="text-lg font-bold">
          들어가기
        </h2>
        <Link
          href="/demo"
          className="mt-4 flex h-14 items-center justify-between rounded-xl bg-rano px-5 text-base font-bold text-primary-foreground shadow-block transition-transform active:translate-y-px"
        >
          게스트 데모 체험하기
          <ArrowRight className="size-5" aria-hidden />
        </Link>
        <p className="mt-2 text-xs text-muted-foreground">가상 데이터로 모든 화면과 동작을 써 볼 수 있습니다. 바꾼 내용은 저장되지 않습니다.</p>

        <div className="my-6 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          <span className="inline-flex items-center gap-1">
            <LockKeyhole className="size-3" aria-hidden />
            관리자
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <LoginForm configured={configured} notice={!configured ? NOTICE.config : e ? NOTICE[e] ?? null : null} />
      </section>
    </main>
  );
}
