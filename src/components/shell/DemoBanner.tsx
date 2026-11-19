import { FlaskConical } from "lucide-react";
import Link from "next/link";

export function DemoBanner() {
  return (
    <div
      role="note"
      className="border-b border-amber/25 bg-[#1f1a0e] pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] text-amber"
    >
      <div className="mx-auto flex min-h-9 max-w-[1240px] items-center gap-2 py-1.5 text-xs">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        <p className="min-w-0">
          <span className="font-semibold">데모 모드</span>
          <span className="text-amber/80"> · 가상 데이터<span className="hidden sm:inline"> · 바꾼 내용은 저장되지 않습니다</span></span>
        </p>
        <Link href="/login" className="ml-auto shrink-0 rounded px-1.5 py-1 font-semibold underline underline-offset-2 hover:text-foreground">
          관리자 로그인
        </Link>
      </div>
    </div>
  );
}
