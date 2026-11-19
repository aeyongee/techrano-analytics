import type { Metadata } from "next";
import { RanoGlyph } from "@/components/shell/Logo";

export const metadata: Metadata = { title: "오프라인" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="flex max-w-xs flex-col items-center gap-3">
        <RanoGlyph className="size-14 text-rano/70" />
        <h1 className="text-lg font-bold">인터넷에 연결되어 있지 않습니다</h1>
        <p className="text-sm text-muted-foreground">
          수치는 기기에 저장하지 않아서 연결된 뒤에만 볼 수 있습니다. 연결되면 아래 버튼을 눌러 주세요.
        </p>
        {/* 오프라인에서 돌아올 때는 클라이언트 이동이 아니라 새로 불러와야 한다 */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" className="mt-2 rounded-lg bg-rano px-4 py-2 text-sm font-bold text-primary-foreground">
          다시 시도
        </a>
      </div>
    </main>
  );
}
