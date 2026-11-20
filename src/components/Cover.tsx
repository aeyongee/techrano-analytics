import { cn } from "cn";
import { RanoGlyph } from "@/components/shell/Logo";

const SIZES = {
  chip: "w-5",
  xs: "w-7",
  sm: "w-10",
  md: "w-14",
  lg: "w-[92px]",
  xl: "w-[120px]",
} as const;

/**
 * 편 표지(세로 9:16). 제목을 읽지 않아도 어느 편인지 알아보게 목록마다 붙인다.
 * 실데이터는 1시간짜리 서명 주소라 Next 이미지 최적화(주소별 캐시)를 쓰지 않고 그대로 불러온다.
 */
export function Cover({
  src,
  alt,
  size = "sm",
  className,
}: {
  src: string | null | undefined;
  alt: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn("relative block aspect-[9/16] shrink-0 overflow-hidden rounded-md border border-border bg-surface-2", SIZES[size], className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- 서명 주소·data URL이라 최적화 캐시가 의미 없다
        <img src={src} alt={alt} loading="lazy" decoding="async" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted-foreground/50" role="img" aria-label={`${alt} 표지 없음`}>
          <RanoGlyph className="w-1/2" />
        </span>
      )}
    </span>
  );
}
