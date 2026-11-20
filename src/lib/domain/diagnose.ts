// 홈 맨 위 "지금 상황" 문장. 숫자를 읽지 않아도 최신 편이 어떤 상태인지 알 수 있게 쓴다.
import { GATES, YT_GATES } from "./constants";
import type { Delta } from "./delta";
import { formatAge, formatCount, formatDuration, formatPct, formatRate, formatSignedCount } from "./format";
import type { GateResult, YtGateResult } from "./gates";

export type Tone = "good" | "warn" | "bad" | "wait";

export interface Diagnosis {
  tone: Tone;
  headline: string;
  lines: string[];
  next: string | null;
}

export interface DiagnoseInput {
  label: string;
  gates: GateResult;
  skipRate: number | null;
  views: number | null;
  ageHours: number | null;
  viewsDelta?: Delta | null;
  benchmarks?: { epNo: number | null; viewsAtAge: number | null }[];
  retroMissing?: boolean;
}

const HOOK = GATES.hook.maxSkipRate;
const SAVE = GATES.spread.minSaveRate;
const SHARE = GATES.spread.minShareRate;

type Movement = Pick<DiagnoseInput, "views" | "ageHours" | "viewsDelta" | "benchmarks">;

/** 최근 조회 변화와 같은 시점 기준편 비교(인스타·유튜브 공통) */
function movementLines(d: Movement): string[] {
  const lines: string[] = [];
  if (d.viewsDelta) {
    lines.push(
      d.viewsDelta.abs > 0
        ? `최근 ${formatDuration(d.viewsDelta.windowMinutes)} 동안 조회 ${formatSignedCount(d.viewsDelta.abs)}.`
        : `최근 ${formatDuration(d.viewsDelta.windowMinutes)} 동안 조회가 늘지 않았다.`,
    );
  }
  const known = (d.benchmarks ?? []).filter((b) => b.viewsAtAge !== null && b.epNo !== null);
  if (known.length && d.views !== null && d.ageHours !== null) {
    const name = (b: (typeof known)[number]) => `${b.epNo}편(${formatCount(b.viewsAtAge)})`;
    const ahead = known.filter((b) => d.views! >= b.viewsAtAge!).map(name);
    const behind = known.filter((b) => d.views! < b.viewsAtAge!).map(name);
    const at = `같은 ${formatAge(d.ageHours)} 시점의`;
    if (!behind.length) lines.push(`${at} ${ahead.join("·")}보다 앞선다.`);
    else if (!ahead.length) lines.push(`${at} ${behind.join("·")}보다 뒤처진다.`);
    else lines.push(`${at} ${ahead.join("·")}보다는 앞서고 ${behind.join("·")}보다는 뒤처진다.`);
  }
  return lines;
}

export function diagnose(d: DiagnoseInput): Diagnosis {
  const { hook, spread, save, share, saveRate, shareRate } = d.gates;
  const lines: string[] = [];

  // 1차 관문
  if (hook === "pending" || d.skipRate === null) lines.push("도달이 적어 1차 관문(첫 3초)은 아직 판정하지 않는다.");
  else if (hook === "pass") lines.push(`건너뛰기 ${formatPct(d.skipRate)}로 1차 관문(${HOOK}% 이하)을 넘었다.`);
  else lines.push(`건너뛰기 ${formatPct(d.skipRate)}로 1차 관문(${HOOK}% 이하)보다 ${(d.skipRate - HOOK).toFixed(1)}%p 높다.`);

  // 2차 관문
  if (spread === "pending") lines.push("도달이 적어 2차 관문(저장·공유)은 아직 판정하지 않는다.");
  else {
    const nums = `저장 ${formatRate(saveRate)} · 공유 ${formatRate(shareRate)}`;
    if (spread === "pass") lines.push(`${nums}로 2차 관문(저장 ${SAVE}%·공유 ${SHARE}%)도 넘었다.`);
    else if (save === "pass") lines.push(`${nums}. 저장은 기준을 넘었지만 공유가 ${SHARE}%에 못 미친다.`);
    else if (share === "pass") lines.push(`${nums}. 공유는 기준을 넘었지만 저장이 ${SAVE}%에 못 미친다.`);
    else lines.push(`${nums}로 2차 관문(저장 ${SAVE}%·공유 ${SHARE}%)에 못 미친다.`);
  }

  lines.push(...movementLines(d));

  // 한 줄 요약과 다음에 해 볼 것
  let tone: Tone;
  let headline: string;
  let next: string | null;
  if (hook === "pending") {
    tone = "wait";
    headline = `${d.label}: 아직 판정하기 이르다`;
    next = "게시 후 몇 시간이 지나 도달이 쌓이면 다시 본다.";
  } else if (hook === "pass" && spread === "pass") {
    tone = "good";
    headline = `${d.label}: 첫 3초도 잡고, 저장·공유도 기준을 넘었다`;
    next = "이대로 두고 비교 화면에서 기준편보다 빨리 크는지 본다.";
  } else if (hook === "pass" && spread === "pending") {
    tone = "wait";
    headline = `${d.label}: 첫 3초는 잡았다. 확산은 더 지켜본다`;
    next = "도달이 500을 넘으면 저장·공유 판정이 나온다.";
  } else if (hook === "pass") {
    tone = "warn";
    headline = `${d.label}: 첫 3초는 잡았지만 아직 퍼지지 않는다`;
    next = "다음 편에는 저장해 둘 이유(정리·체크리스트·따라 하기)나 친구에게 보낼 만한 장면을 넣어 본다.";
  } else if (spread === "pass") {
    tone = "warn";
    headline = `${d.label}: 본 사람은 저장·공유했지만, 첫 3초에서 많이 넘긴다`;
    next = "다음 편은 첫 1초 대사와 첫 화면을 바꿔 본다(초점 하나, 2초 안에 소재가 드러나게).";
  } else if (spread === "pending") {
    tone = "warn";
    headline = `${d.label}: 첫 3초에서 많이 넘긴다`;
    next = "다음 편은 첫 1초 대사와 첫 화면을 바꿔 본다(초점 하나, 2초 안에 소재가 드러나게).";
  } else {
    tone = "bad";
    headline = `${d.label}: 첫 3초와 저장·공유 둘 다 기준에 못 미친다`;
    next = "첫 컷 훅과 저장할 이유를 둘 다 다시 잡는다.";
  }
  if (d.retroMissing && (d.ageHours ?? 0) >= 72) next = "게시 72시간이 지났다. 편 상세에서 복기를 적는다.";

  return { tone, headline, lines, next };
}

export interface DiagnoseYtInput extends Movement {
  label: string;
  gates: YtGateResult;
  hasAnalytics: boolean;
  retroMissing?: boolean;
}

const YT_HOOK = YT_GATES.hook.minEngagedRatio;
const YT_FINISH = YT_GATES.finish.minAvgViewPct;
const NEXT_HOOK = "다음 편은 첫 1초 대사와 첫 화면을 바꿔 본다(초점 하나, 2초 안에 소재가 드러나게).";

/** 유튜브 탭의 "지금 상황". 유튜브는 퍼짐보다 초반 이탈과 끝까지 보는지로 본다. */
export function diagnoseYt(d: DiagnoseYtInput): Diagnosis {
  const { hook, finish, engagedRatio, avgViewPct } = d.gates;
  const lines: string[] = [];

  if (!d.hasAnalytics) lines.push("유효 조회·평균 시청은 유튜브가 24~48시간 늦게 집계한다. 지금은 조회만 확인된다.");
  else if (hook === "pending" && finish === "pending") lines.push(`조회가 ${YT_GATES.minViews}회 미만이라 아직 판정하지 않는다.`);
  else {
    if (hook === "pass") lines.push(`유효 조회 비율 ${formatPct(engagedRatio)}로 1차 관문(${YT_HOOK}% 이상)을 넘었다.`);
    else if (hook === "fail") lines.push(`유효 조회 비율 ${formatPct(engagedRatio)}로 1차 관문(${YT_HOOK}% 이상)보다 ${(YT_HOOK - engagedRatio!).toFixed(1)}%p 낮다.`);
    if (finish === "pass") lines.push(`평균 시청률 ${formatPct(avgViewPct)}로 2차 관문(${YT_FINISH}% 이상)도 넘었다.`);
    else if (finish === "fail") lines.push(`평균 시청률 ${formatPct(avgViewPct)}로 2차 관문(${YT_FINISH}% 이상)에 못 미친다.`);
  }
  lines.push(...movementLines(d));

  let tone: Tone;
  let headline: string;
  let next: string | null;
  if (hook === "pending" || finish === "pending") {
    tone = "wait";
    headline = d.hasAnalytics ? `${d.label}: 아직 판정하기 이르다` : `${d.label}: 유튜브 판정은 집계 뒤에 나온다`;
    next = "게시 하루쯤 뒤 Analytics가 들어오면 다시 본다.";
  } else if (hook === "pass" && finish === "pass") {
    tone = "good";
    headline = `${d.label}: 초반도 넘기고 끝까지 본다`;
    next = "이대로 두고 비교 화면에서 기준편보다 조회가 빨리 크는지 본다.";
  } else if (hook === "pass") {
    tone = "warn";
    headline = `${d.label}: 초반은 넘겼지만 끝까지 보지 않는다`;
    next = "중반에 늘어지는 컷을 줄이거나 전체 길이를 줄여 본다.";
  } else if (finish === "pass") {
    tone = "warn";
    headline = `${d.label}: 남은 사람은 끝까지 보지만 초반에 많이 넘긴다`;
    next = NEXT_HOOK;
  } else {
    tone = "bad";
    headline = `${d.label}: 초반 이탈도 많고 끝까지 보지도 않는다`;
    next = "첫 컷 훅과 전체 길이를 둘 다 다시 잡는다.";
  }
  if (d.retroMissing && (d.ageHours ?? 0) >= 72) next = "게시 72시간이 지났다. 편 상세에서 복기를 적는다.";

  return { tone, headline, lines, next };
}
