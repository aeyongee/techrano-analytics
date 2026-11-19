// 데모용 가상 편. 실제 테크라노 편과 제목·수치가 겹치지 않게 만든 예시다.

export type Archetype = "breakout" | "saveWeak" | "hookWeak" | "rework";

export interface DemoEpisodeSpec {
  id: number;
  epNo: number | null;
  title: string;
  series: string;
  topic?: string;
  archetype: Archetype;
  /** 기준 시각에서 IG 게시까지 거슬러 간 시간 */
  ageHours: number;
  status: "published" | "draft";
  isBenchmark?: boolean;
  autoPaired?: boolean;
  /** 저장·공유 비율을 직접 정한다(△ 예시 등) */
  rates?: { skip: number; save: number; share: number };
  /** 2차 확산 곡선을 직접 정한다(진행 중 편) */
  spread?: { v2: number; t0: number; s: number };
  hookDesc?: string;
  hypothesis?: string;
  retro72h?: string;
}

const age = (k: number) => 20 + 60 * k; // D12가 20시간 전, 그 앞은 60시간 간격

export const DEMO_EPISODES: DemoEpisodeSpec[] = [
  { id: 1, epNo: 1, title: "비밀번호 1234의 최후", series: "보안 개념", topic: "비밀번호 재사용", archetype: "rework", ageHours: age(11), status: "published",
    hookDesc: "무음, 로그인 화면에 1234가 입력되는 클로즈업", retro72h: "첫 2초가 무음이라 건너뛰기가 높았다. 다음 편은 첫 문장부터 말한다." },
  { id: 2, epNo: 2, title: "공용 와이파이 공짜라며", series: "보안 개념", topic: "evil twin", archetype: "hookWeak", ageHours: age(10), status: "published",
    hookDesc: "카페 전경과 제목 자막만 2초" },
  { id: 3, epNo: 3, title: "깃허브에 키 올린 날", series: "공감", archetype: "breakout", ageHours: age(9), status: "published",
    rates: { skip: 36.6, save: 1.5, share: 0.9 },
    hookDesc: "\"푸시했는데 왜 메일이 100통 와?\" 한 문장으로 시작", retro72h: "첫날 1.2만, 이틀째 확산. 저장이 공유보다 두 배." },
  { id: 4, epNo: 4, title: "쿠키 하나로 로그인", series: "보안 개념", topic: "세션 하이재킹", archetype: "saveWeak", ageHours: age(8), status: "published" },
  { id: 5, epNo: 5, title: "SQL 한 줄의 무게", series: "보안 개념", topic: "SQL 인젝션", archetype: "breakout", ageHours: age(7), status: "published", isBenchmark: true,
    hookDesc: "\"로그인 창에 이거 한 줄 넣으면?\" 질문으로 시작", hypothesis: "질문형 첫 문장이 저장을 끌어올린다.", retro72h: "14시간 뒤 2차 확산 시작. 저장률이 가장 높았던 편." },
  { id: 6, epNo: 6, title: "새벽 3시 배포", series: "공감", archetype: "hookWeak", ageHours: age(6), status: "published" },
  { id: 7, epNo: 7, title: "AI가 짠 코드 리뷰", series: "공감", archetype: "saveWeak", ageHours: age(5), status: "published" },
  { id: 8, epNo: 8, title: "회사 노트북 USB", series: "보안 개념", topic: "배드 USB", archetype: "rework", ageHours: age(4), status: "published",
    hookDesc: "무음, 주차장에 떨어진 USB" },
  { id: 9, epNo: 9, title: "OTP 문자 보내 줄래?", series: "보안 개념", topic: "OTP 탈취", archetype: "breakout", ageHours: age(3), status: "published", isBenchmark: true,
    hookDesc: "1초 안에 \"방금 온 인증번호 좀 불러 줘\"" },
  { id: 10, epNo: 10, title: "프린터가 털렸다", series: "보안 개념", topic: "IoT 기본 비밀번호", archetype: "saveWeak", ageHours: age(2), status: "published",
    rates: { skip: 41.2, save: 1.4, share: 0.2 }, hypothesis: "사무실 소품이면 공유가 많을 것이다.", retro72h: "저장은 기준을 넘었지만 공유가 0.2%에서 멈췄다." },
  { id: 11, epNo: 11, title: "DNS가 뭐길래", series: "개념", topic: "DNS", archetype: "saveWeak", ageHours: age(1), status: "published" },
  { id: 12, epNo: null, title: "카톡 링크 하나 눌렀을 뿐", series: "보안 개념", topic: "스미싱", archetype: "breakout", ageHours: age(0), status: "draft", autoPaired: true,
    rates: { skip: 39.4, save: 1.15, share: 0.62 }, spread: { v2: 45_000, t0: 16, s: 5 } },
];

/** 예약 공개만 걸어 둔 다음 편(YT만 있는 초안) */
export const DEMO_SCHEDULED = { id: 13, title: "카페 와이파이 이름이 수상하다", scheduledInHours: 26 };
