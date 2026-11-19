import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { loadShellStatus } from "@/lib/data/builders";
import { getDemoRepository } from "@/lib/data/demo/repository";

// 데모는 쿠키를 읽지 않고 한 시간마다 다시 만든다. 이 트리에서는 DB 모듈을 import할 수 없다(eslint).
export const revalidate = 3600;

export default async function DemoLayout({ children }: { children: ReactNode }) {
  const status = await loadShellStatus(getDemoRepository());
  return (
    <AppShell mode="demo" status={status}>
      {children}
    </AppShell>
  );
}
