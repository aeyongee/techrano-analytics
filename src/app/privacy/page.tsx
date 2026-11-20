import type { Metadata } from "next";
import { RanoGlyph } from "@/components/shell/Logo";

export const metadata: Metadata = { title: "개인정보처리방침" };

// Google OAuth 앱 게시에 필요한 공개 페이지. 이 앱이 읽는 데이터와 쓰는 방식을 적는다.
export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-6 px-4 py-12 text-sm leading-relaxed text-muted-foreground">
      <header className="flex items-center gap-3">
        <RanoGlyph className="size-10 text-rano" />
        <h1 className="text-xl font-bold text-foreground">개인정보처리방침</h1>
      </header>
      <p>
        테크라노 analytics는 운영자 한 명이 자기 채널(@tech.rano)의 릴스·쇼츠 성과를 보려고 만든 개인 대시보드입니다. 운영자 외의 사용자 계정은
        만들 수 없습니다.
      </p>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">읽는 데이터</h2>
        <ul className="list-disc pl-5">
          <li>YouTube Data API·YouTube Analytics API: 운영자 채널의 영상 목록과 조회·좋아요·댓글·공유·시청 시간 같은 집계 통계(읽기 전용)</li>
          <li>Instagram Graph API: 운영자 계정 릴스의 집계 인사이트</li>
        </ul>
        <p>시청자 개인을 식별하는 정보는 받지 않습니다.</p>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">쓰는 방식</h2>
        <ul className="list-disc pl-5">
          <li>받은 통계는 성과 그래프를 그리는 데만 쓰고, 운영자만 로그인해서 볼 수 있는 데이터베이스에 저장합니다.</li>
          <li>제3자에게 팔거나 넘기지 않고, 광고에 쓰지 않습니다.</li>
          <li>Google API에서 받은 정보는 Google API 서비스 사용자 데이터 정책(제한적 사용 요건 포함)을 따릅니다.</li>
          <li>게스트 데모는 코드 안에서 만든 가상 데이터만 보여 줍니다.</li>
        </ul>
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold text-foreground">삭제와 문의</h2>
        <p>
          연결을 끊으려면 Google 계정의 서드파티 액세스에서 이 앱을 삭제하면 됩니다. 문의는{" "}
          <a href="https://github.com/aeyongee/techrano-analytics/issues" className="text-sky underline">
            GitHub 이슈
          </a>
          로 받습니다.
        </p>
      </section>
      <p className="text-xs">최종 수정: 2026-11-20</p>
    </main>
  );
}
