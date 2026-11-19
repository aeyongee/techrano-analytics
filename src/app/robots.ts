import type { MetadataRoute } from "next";

// 개인 대시보드라 검색에 올리지 않는다(포트폴리오 링크로만 들어온다).
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", disallow: "/" }] };
}
