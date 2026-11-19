"use client";

import { useEffect } from "react";

/** 배포본에서만 서비스 워커를 등록한다(개발 서버에서는 캐시가 방해된다). */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 등록에 실패해도 앱은 그대로 쓴다
    });
  }, []);
  return null;
}
