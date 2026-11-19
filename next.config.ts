import type { NextConfig } from "next";

// cacheComponents는 끈다. 데모는 revalidate로 한 시간마다 다시 만들고, 실데이터 화면은 쿠키를 읽어 요청마다 렌더한다.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
