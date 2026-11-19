import type { ReactNode } from "react";
import { cn } from "cn";

/** 블록 톤 카드: 단색 면, 1px 테두리, 번지지 않는 아래 그림자 */
export function Panel({ className, children, as: Tag = "section", ...rest }: {
  className?: string;
  children: ReactNode;
  as?: "section" | "div" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("rounded-xl border border-border bg-card shadow-block", className)} {...rest}>
      {children}
    </Tag>
  );
}

export function PanelHeader({ title, hint, action, className }: { title: ReactNode; hint?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn("flex items-start gap-3 px-4 pt-4 xl:px-5 xl:pt-5", className)}>
      <div className="min-w-0">
        <h2 className="text-[15px] font-bold">{title}</h2>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action ? <div className="ml-auto shrink-0">{action}</div> : null}
    </header>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end gap-3">
      <div className="min-w-0">
        <h1 className="hidden text-2xl font-bold tracking-tight xl:block">{title}</h1>
        {subtitle ? <p className="text-xs text-muted-foreground tabular-nums xl:mt-1 xl:text-sm">{subtitle}</p> : null}
      </div>
      {action ? <div className="ml-auto">{action}</div> : null}
    </div>
  );
}
