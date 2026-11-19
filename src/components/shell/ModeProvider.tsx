"use client";

import { createContext, use, type ReactNode } from "react";
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
  return <ModeContext value={value}>{children}</ModeContext>;
}

export const useMode = () => use(ModeContext);
