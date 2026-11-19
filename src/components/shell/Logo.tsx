// 블록 티라노. 12×12 칸을 사각형으로 찍는다(영상의 블록 톤).
const ROWS = [
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

export function RanoGlyph({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} shapeRendering="crispEdges">
      {title ? <title>{title}</title> : null}
      {ROWS.flatMap((row, y) =>
        [...row].map((c, x) => (c === "x" ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill="currentColor" /> : null)),
      )}
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="flex items-center gap-2">
      <span className="grid size-8 place-items-center rounded-md bg-rano/12 text-rano shadow-block">
        <RanoGlyph className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-tight">테크라노</span>
        <span className="block font-mono text-[10.5px] text-muted-foreground">analytics</span>
      </span>
    </span>
  );
}
