// 데모 편의 가상 표지. 채널 배너처럼 하늘·초록 땅·블록 티라노 위에 제목을 얹는다(실제 표지는 쓰지 않는다).

const SKIES = ["#2f80ed", "#3a86ff", "#1f6feb", "#4c6ef5", "#0ea5e9", "#2563eb", "#6366f1", "#0284c7"];
const GROUND = ["#5fbf3f", "#4caf50", "#65c25a", "#58b947"];

const DINO = [
  "......xxxxx.",
  ".....xx.xxxx",
  ".....xxxxxxx",
  ".....xxxx...",
  ".....xxxxxx.",
  "x...xxxxx...",
  "xx.xxxxxxx..",
  "xxxxxxxxx.x.",
  ".xxxxxxxx...",
  "..xxxxxx....",
  "...xx.xx....",
  "...x...x....",
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 띄어쓰기 기준으로 한 줄 8자 안팎, 최대 3줄 */
function wrap(title: string): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of title.split(/\s+/)) {
    if (cur && (cur + " " + word).length > 8) {
      lines.push(cur);
      cur = word;
    } else cur = cur ? `${cur} ${word}` : word;
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 3);
}

export function demoCover(title: string, seed: number): string {
  const sky = SKIES[seed % SKIES.length];
  const ground = GROUND[seed % GROUND.length];
  const dino = DINO.flatMap((row, y) =>
    [...row].map((c, x) => (c === "x" ? `<rect x="${126 + x * 3.2}" y="${196 + y * 3.2}" width="3.3" height="3.3"/>` : "")),
  ).join("");
  const lines = wrap(title);
  const text = lines
    .map(
      (l, i) =>
        `<text x="90" y="${58 + i * 30}" text-anchor="middle" font-size="22" font-weight="800" fill="#fff" stroke="#0b1220" stroke-width="5" paint-order="stroke" font-family="Apple SD Gothic Neo, Pretendard, Noto Sans KR, sans-serif">${esc(l)}</text>`,
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 320">
<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky}"/><stop offset="1" stop-color="#9ad0ff"/></linearGradient></defs>
<rect width="180" height="320" fill="url(#s)"/>
<rect x="18" y="130" width="40" height="14" rx="2" fill="#fff" opacity=".85"/><rect x="28" y="122" width="22" height="10" rx="2" fill="#fff" opacity=".85"/>
<path d="M0 236 L40 214 L78 232 L120 210 L180 228 L180 320 L0 320 Z" fill="${ground}"/>
<rect x="0" y="246" width="180" height="74" fill="${ground}" opacity=".9"/>
<g fill="#4ade80" stroke="#14532d" stroke-width=".3">${dino}</g>
${text}
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
