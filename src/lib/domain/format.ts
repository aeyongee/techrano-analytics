import { TIME_ZONE } from "./constants";

const nf = new Intl.NumberFormat("ko-KR");

/** 8,640 · 1.2만 · 3.2만 · 128만 (만 단위는 소수 한 자리, .0은 뺀다) */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs < 10_000) return nf.format(Math.round(n));
  const man = n / 10_000;
  const digits = Math.abs(man) >= 100 ? 0 : 1;
  return `${Number(man.toFixed(digits))}만`;
}

export const formatCountFull = (n: number | null | undefined) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : nf.format(Math.round(n));

/** 건너뛰기 같은 큰 비율: 38.1% */
export const formatPct = (n: number | null | undefined, digits = 1) =>
  n === null || n === undefined || !Number.isFinite(n) ? "—" : `${n.toFixed(digits)}%`;

/** 저장률·공유율: 기준이 0.5·1.0이라 소수 두 자리 */
export const formatRate = (n: number | null | undefined) => formatPct(n, 2);

/** +120 · −3 (빼기는 진짜 마이너스 기호) */
export function formatSignedCount(n: number): string {
  if (n === 0) return "±0";
  return `${n > 0 ? "+" : "−"}${formatCount(Math.abs(n))}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}분`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes - h * 60);
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 게시 후 경과: 45분 · 18시간 · 3일 6시간 */
export function formatAge(hours: number | null): string {
  if (hours === null || !Number.isFinite(hours)) return "—";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}분`;
  if (hours < 48) return `${Math.floor(hours)}시간`;
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours - d * 24);
  return h ? `${d}일 ${h}시간` : `${d}일`;
}

const dateTime = new Intl.DateTimeFormat("ko-KR", {
  timeZone: TIME_ZONE,
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** 11/21(금) 06:15 — 서버(UTC)에서도 항상 한국 시각으로 */
export function formatKst(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parts = Object.fromEntries(dateTime.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${parts.month}/${parts.day}(${parts.weekday}) ${parts.hour}:${parts.minute}`;
}

export function formatRelative(iso: string | null | undefined, now: Date | string): string {
  if (!iso) return "—";
  const min = (new Date(now).getTime() - Date.parse(iso)) / 60_000;
  if (min < 1) return "방금";
  if (min < 60) return `${Math.floor(min)}분 전`;
  if (min < 48 * 60) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / 1440)}일 전`;
}

/** 차트 X축: T+6h, 48시간부터는 D+2 */
export const formatHoursTick = (h: number) => (h >= 48 && h % 24 === 0 ? `D+${h / 24}` : `T+${h}h`);

export const episodeLabel = (e: { epNo: number | null }) => (e.epNo !== null ? `${e.epNo}편` : "초안");
