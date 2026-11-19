import { ChartSpline, Clapperboard, LayoutDashboard, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  title: string;
  icon: LucideIcon;
}

/** basePath: 실데이터는 "", 데모는 "/demo" */
export function navItems(basePath: string): NavItem[] {
  return [
    { href: basePath || "/", label: "홈", title: "홈", icon: LayoutDashboard },
    { href: `${basePath}/compare`, label: "비교", title: "T+ 비교", icon: ChartSpline },
    { href: `${basePath}/episodes`, label: "편", title: "편", icon: Clapperboard },
    { href: `${basePath}/admin`, label: "관리", title: "관리", icon: SlidersHorizontal },
  ];
}

export function activeItem(items: NavItem[], pathname: string): NavItem | undefined {
  // 홈은 정확히 같을 때만, 나머지는 하위 경로까지
  return [...items].reverse().find((i) => (i.href === "/" || i.href === "/demo" ? pathname === i.href : pathname.startsWith(i.href)));
}
