// 홈 맨 위 "지금 상황" 문장. 숫자를 읽지 않아도 최신 편이 어떤 상태인지 알 수 있게 쓴다.
import { GATES } from "./constants";
import type { Delta } from "./delta";
import { formatAge, formatCount, formatDuration, formatPct, formatRate, formatSignedCount } from "./format";
import type { GateResult } from "./gates";

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

  // 움직임
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
