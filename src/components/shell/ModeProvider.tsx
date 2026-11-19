"use client";

import { createContext, use, type ReactNode } from "react";
import { demoActions } from "@/lib/actions/demo";
import type { EpisodeActions } from "@/lib/actions/types";

export interface ModeContextValue {
  mode: "live" | "demo";
  /** 링크 앞에 붙일 경로: 실데이터 "", 데모 "/demo" */
  basePath: string;
  /** 관리자 동작. 실데이터는 Server Action, 데모는 저장하지 않는 흉내 */
  actions: EpisodeActions | null;
}

const ModeContext = createContext<ModeContextValue>({ mode: "demo", basePath: "/demo", actions: null });

export function ModeProvider({ value, children }: { value: ModeContextValue; children: ReactNode }) {
  // 데모는 서버에서 함수를 넘길 수 없으니 여기서 저장하지 않는 동작을 끼운다.
  const actions = value.actions ?? (value.mode === "demo" ? demoActions : null);
  return <ModeContext value={{ ...value, actions }}>{children}</ModeContext>;
}

export const useMode = () => use(ModeContext);
